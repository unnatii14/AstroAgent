// All backend communication lives here, isolated so that when the backend
// gains streaming (Phase 4), only this file needs to change.

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

  // The backend returns friendly JSON errors; surface them, never crash.
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error || "The connection to the stars faltered. Please try again."
    );
  }
  return data.reply;
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
