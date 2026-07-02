// All backend communication lives here. The UI streams by default and falls
// back to the non-streaming endpoint if the stream can't start.

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function sendChatMessage({ message, sessionId, birthDetails }) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      birth_details: birthDetails,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error || "The connection to the stars faltered. Please try again."
    );
  }
  return data.reply;
}

// Reads the SSE stream and invokes callbacks as events arrive:
//   onToken(text)            - a piece of assistant text
//   onTool({type,name,ok?})  - tool_call / tool_result activity
// Resolves when the server sends {type:"done"}; throws on {type:"error"}.
export async function streamChatMessage({
  message,
  sessionId,
  birthDetails,
  onToken,
  onTool,
}) {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      birth_details: birthDetails,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error("stream-unavailable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line; keep any tail fragment.
    const events = buffer.split("\n\n");
    buffer = events.pop();

    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      let evt;
      try {
        evt = JSON.parse(line.slice(5));
      } catch {
        continue; // never let one bad frame kill the stream
      }
      if (evt.type === "token") onToken(evt.text);
      else if (evt.type === "tool_call" || evt.type === "tool_result") onTool(evt);
      else if (evt.type === "error") throw new Error(evt.message);
      else if (evt.type === "done") return;
    }
  }
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
