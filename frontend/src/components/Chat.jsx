import { useEffect, useState } from "react";
import { sendChatMessage, checkHealth } from "../api.js";
import MessageList from "./MessageList.jsx";
import Composer from "./Composer.jsx";

// The main conversation screen. History is persisted per session so a
// returning user finds their conversation where they left it.
export default function Chat({ birthDetails, sessionId, onEditDetails }) {
  const storageKey = `astro_history_${sessionId}`;

  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch {
      return [];
    }
  });
  const [pending, setPending] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  // Proactive health check: tell the user the sky is unreachable BEFORE they
  // type a message into the void.
  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled) setOffline(!ok);
    });
    return () => { cancelled = true; };
  }, []);

  async function send(text) {
    setMessages((m) => [...m, { role: "user", content: text }]);
    setPending(true);
    try {
      const reply = await sendChatMessage({
        message: text,
        sessionId,
        birthDetails,
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      setOffline(false); // a successful call proves we're connected
    } catch (err) {
      // Soft in-chat error with a retry affordance — never a crash.
      setMessages((m) => [
        ...m,
        { role: "system", content: err.message, retryText: text },
      ]);
      checkHealth().then((ok) => setOffline(!ok));
    } finally {
      setPending(false);
    }
  }

  // Retry resends the failed text and clears old error notes to keep the
  // conversation tidy.
  function retry(text) {
    setMessages((m) => m.filter((msg) => msg.role !== "system"));
    send(text);
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <div className="chat-title">
          <span className="title-star">✦</span>
          <div>
            <h1>AstroAgent</h1>
            <p className="chat-sub">
              {birthDetails.place} · {birthDetails.date}
              {birthDetails.time ? ` · ${birthDetails.time}` : ""}
            </p>
          </div>
        </div>
        <button className="ghost-btn" onClick={onEditDetails}>
          Edit birth details
        </button>
      </header>

      {offline && (
        <div className="offline-banner">
          The stars are out of reach — the backend isn't responding. Start it
          with <code>python main.py</code> in the backend folder.
        </div>
      )}

      <MessageList messages={messages} pending={pending} onRetry={retry} />
      <Composer onSend={send} disabled={pending} />
    </div>
  );
}
