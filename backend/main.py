"""AstroAgent API — Phase 1.

Endpoints:
    GET  /health  -> liveness check
    POST /chat    -> one conversational turn (non-streaming; streaming in a later phase)

Crash-safety rules applied here:
    - request body validated by Pydantic (bad input -> clean 422, not a crash)
    - every /chat call wrapped in try/except -> friendly error, never a stack trace
    - missing API key detected at startup with a clear message
"""

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from the repo root (one level above backend/)
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.graph import build_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("astroagent")

app = FastAPI(title="AstroAgent API", version="0.1.0")

# Allow the React dev server (Phase 3) to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = build_graph()


class BirthDetailsIn(BaseModel):
    date: str = Field(..., examples=["1998-03-14"])
    time: Optional[str] = Field(None, examples=["08:45"])
    place: str = Field(..., examples=["Jaipur, India"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field("default", max_length=100)
    birth_details: Optional[BirthDetailsIn] = None


@app.get("/health")
def health():
    return {"status": "ok", "model": os.getenv("AGENT_MODEL", "openai/gpt-oss-120b")}


@app.post("/chat")
def chat(req: ChatRequest):
    try:
        state_update = {"messages": [{"role": "user", "content": req.message}]}
        if req.birth_details:
            state_update["birth_details"] = req.birth_details.model_dump()

        config = {"configurable": {"thread_id": req.session_id}}
        result = agent.invoke(state_update, config)

        reply = result["messages"][-1].content
        return {"reply": reply, "session_id": req.session_id}

    except Exception:
        logger.exception("chat turn failed")
        return JSONResponse(
            status_code=500,
            content={
                "error": "Something went wrong on our side. Please try again in a moment.",
                "session_id": req.session_id,
            },
        )


if __name__ == "__main__":
    import uvicorn

    if not os.getenv("GROQ_API_KEY"):
        raise SystemExit(
            "GROQ_API_KEY is not set. Copy .env.example to .env in the repo "
            "root and add your key (free at console.groq.com)."
        )
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))
