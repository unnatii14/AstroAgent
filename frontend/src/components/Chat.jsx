import { useEffect, useRef, useState } from "react";
import { sendChatMessage, streamChatMessage, checkHealth } from "../api.js";
import MessageList from "./MessageList.jsx";
import Composer from "./Composer.jsx";

// The main conversation screen. Streams replies token-by-token with live
// tool activity; falls back to the non-streaming endpoint if the stream
// can't start. History is persisted per session.
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
  const [activity, setActivity] = useState([]); // live tool events this turn
  const [offline, setOffline] = useState(false);
  const gotTextRef = useRef(false);

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

  function appendToken(text) {
    gotTextRef.current = true;
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        copy[copy.length - 1] = { ...last, content: last.content + text };
      } else {
        copy.push({ role: "assistant", content: text, streaming: true });
      }
      return copy;
    });
  }

  function finishStreamingMessage() {
    setMessages((m) =>
      m.map((msg) => (msg.streaming ? { ...msg, streaming: undefined } : msg))
    );
  }

  async function send(text) {
    setMessages((m) => [...m, { role: "user", content: text }]);
    setPending(true);
    setActivity([]);
    gotTextRef.current = false;

    try {
      await streamChatMessage({
        message: text,
        sessionId,
        birthDetails,
        onToken: appendToken,
        onTool: (evt) => setActivity((a) => [...a, evt]),
      });
      setOffline(false);
    } catch (err) {
      // If the stream never delivered text, try the simple endpoint once;
      // only if that also fails do we show an error note.
      if (!gotTextRef.current) {
        try {
          const reply = await sendChatMessage({ message: text, sessionId, birthDetails });
          setMessages((m) => [...m, { role: "assistant", content: reply }]);
          setOffline(false);
        } catch (err2) {
          setMessages((m) => [
            ...m,
            { role: "system", content: err2.message, retryText: text },
          ]);
          checkHealth().then((ok) => setOffline(!ok));
        }
      } else {
        setMessages((m) => [
          ...m,
          { role: "system", content: err.message, retryText: text },
        ]);
      }
    } finally {
      finishStreamingMessage();
      setActivity([]);
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

      <MessageList
        messages={messages}
        pending={pending}
        activity={activity}
        onRetry={retry}
      />
      <Composer onSend={send} disabled={pending} />
    </div>
  );
}
