"""AstroAgent API.

Endpoints:
    GET  /health       -> liveness check
    POST /chat         -> one conversational turn (non-streaming fallback)
    POST /chat/stream  -> same turn as Server-Sent Events:
                          {type:"token", text}        assistant text, token by token
                          {type:"tool_call", name}    agent decided to use a tool
                          {type:"tool_result", name, ok}  tool finished
                          {type:"done"} | {type:"error", message}

Crash-safety rules:
    - request body validated by Pydantic (bad input -> clean 422)
    - every turn wrapped in try/except -> friendly error, never a stack trace
    - recursion_limit is the hard step budget for the agent loop
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from the repo root (one level above backend/)
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from langgraph.errors import GraphRecursionError
from pydantic import BaseModel, Field

from app.graph import build_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("astroagent")

app = FastAPI(title="AstroAgent API", version="0.2.0")

# Allow the React dev server to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = build_graph()

RECURSION_LIMIT = 12
TANGLED = (
    "I got a little tangled in the stars trying to work that out. "
    "Could you rephrase, or give me your birth details again?"
)
WENT_WRONG = "Something went wrong on our side. Please try again in a moment."


class BirthDetailsIn(BaseModel):
    date: str = Field(..., examples=["1998-03-14"])
    time: Optional[str] = Field(None, examples=["08:45"])
    place: str = Field(..., examples=["Jaipur, India"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field("default", max_length=100)
    birth_details: Optional[BirthDetailsIn] = None


def _state_update(req: ChatRequest) -> dict:
    update = {"messages": [{"role": "user", "content": req.message}]}
    if req.birth_details:
        update["birth_details"] = req.birth_details.model_dump()
    return update


def _config(req: ChatRequest) -> dict:
    return {
        "configurable": {"thread_id": req.session_id},
        "recursion_limit": RECURSION_LIMIT,
    }


@app.get("/health")
def health():
    return {"status": "ok", "model": os.getenv("AGENT_MODEL", "openai/gpt-oss-120b")}


@app.post("/chat")
def chat(req: ChatRequest):
    try:
        result = agent.invoke(_state_update(req), _config(req))
        return {"reply": result["messages"][-1].content, "session_id": req.session_id}
    except GraphRecursionError:
        logger.warning("step budget exceeded for session %s", req.session_id)
        return {"reply": TANGLED, "session_id": req.session_id}
    except Exception:
        logger.exception("chat turn failed")
        return JSONResponse(
            status_code=500,
            content={"error": WENT_WRONG, "session_id": req.session_id},
        )


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """Stream a turn as SSE. Two LangGraph stream modes at once:
    - "messages": token-level chunks from any LLM call inside the graph
    - "updates":  node outputs, used to announce tool calls/results live
    """

    def gen():
        sent_text = False
        try:
            for mode, payload in agent.stream(
                _state_update(req), _config(req),
                stream_mode=["messages", "updates"],
            ):
                if mode == "messages":
                    chunk, meta = payload
                    # Only surface real assistant text (tool-call argument
                    # chunks arrive with empty content and are skipped).
                    text = getattr(chunk, "content", "")
                    if meta.get("langgraph_node") == "reasoner" and isinstance(text, str) and text:
                        sent_text = True
                        yield _sse({"type": "token", "text": text})

                else:  # updates
                    if "reasoner" in payload:
                        msg = payload["reasoner"]["messages"][-1]
                        for tc in getattr(msg, "tool_calls", []) or []:
                            yield _sse({"type": "tool_call", "name": tc["name"]})
                    if "tools" in payload:
                        for tm in payload["tools"]["messages"]:
                            try:
                                ok = json.loads(tm.content).get("ok", True)
                            except Exception:
                                ok = True
                            yield _sse({"type": "tool_result", "name": tm.name, "ok": ok})

            # Safety net: if no tokens streamed (e.g. the reasoner's fallback
            # message, which is built without an LLM call), send the final
            # answer as one block so the client is never left empty-handed.
            if not sent_text:
                snapshot = agent.get_state(_config(req))
                msgs = snapshot.values.get("messages", [])
                if msgs and getattr(msgs[-1], "content", ""):
                    yield _sse({"type": "token", "text": msgs[-1].content})

            yield _sse({"type": "done"})

        except GraphRecursionError:
            logger.warning("step budget exceeded for session %s", req.session_id)
            yield _sse({"type": "token", "text": TANGLED})
            yield _sse({"type": "done"})
        except Exception:
            logger.exception("stream failed")
            yield _sse({"type": "error", "message": WENT_WRONG})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn

    if not os.getenv("GROQ_API_KEY"):
        raise SystemExit(
            "GROQ_API_KEY is not set. Copy .env.example to .env in the repo "
            "root and add your key (free at console.groq.com)."
        )
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))
