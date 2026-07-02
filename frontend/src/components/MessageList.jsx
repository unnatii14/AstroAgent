import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders the conversation. Assistant messages arrive as markdown
// (headings, tables, lists) so they get a real markdown renderer.
export default function MessageList({ messages, pending, onRetry }) {
  const endRef = useRef(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  return (
    <div className="message-list">
      {messages.length === 0 && !pending && (
        <div className="empty-state fade-up">
          <span className="empty-star">✦</span>
          <p>The sky is listening.</p>
          <p className="empty-hint">
            Ask about your chart, today's energy, or what a placement means.
          </p>
        </div>
      )}

      {messages.map((m, i) =>
        m.role === "system" ? (
          <div key={i} className="system-message fade-up">
            <p>{m.content}</p>
            {m.retryText && (
              <button className="retry-btn" onClick={() => onRetry(m.retryText)}>
                Try again
              </button>
            )}
          </div>
        ) : (
          <div key={i} className={`bubble-row ${m.role}`}>
            <div className={`bubble ${m.role} fade-up`}>
              {m.role === "assistant" ? (
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        )
      )}

      {pending && (
        <div className="bubble-row assistant">
          <div className="bubble assistant thinking">
            <span className="thinking-label">consulting the stars</span>
            <span className="dots"><i /><i /><i /></span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
