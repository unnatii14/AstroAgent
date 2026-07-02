import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Friendly labels for live tool activity — the user sees what the agent is
// doing in plain, in-world language instead of function names.
const TOOL_LABELS = {
  geocode_place: "finding your birthplace",
  compute_birth_chart: "casting your birth chart",
  get_daily_transits: "reading today's sky",
};

function activityLabel(evt) {
  const base = TOOL_LABELS[evt.name] || evt.name;
  if (evt.type === "tool_result") {
    return evt.ok === false ? `${base} — hit a snag` : `${base} — done`;
  }
  return `${base}…`;
}

// Renders the conversation. Assistant messages arrive as markdown
// (headings, tables, lists) so they get a real markdown renderer.
export default function MessageList({ messages, pending, activity, onRetry }) {
  const endRef = useRef(null);

  // Keep the newest content in view as the conversation grows/streams.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, activity]);

  const last = messages[messages.length - 1];
  const isStreamingText = last?.role === "assistant" && last.streaming && last.content;

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
                  {m.streaming && <span className="cursor" />}
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        )
      )}

      {/* Waiting bubble: shown until the first token arrives. Displays live
          tool activity so the agent's work is visible, as the brief asks. */}
      {pending && !isStreamingText && (
        <div className="bubble-row assistant">
          <div className="bubble assistant thinking">
            <div>
              <div className="thinking-head">
                <span className="thinking-label">consulting the stars</span>
                <span className="dots"><i /><i /><i /></span>
              </div>
              {activity.length > 0 && (
                <ul className="activity-list">
                  {activity.map((evt, i) => (
                    <li key={i} className={evt.type === "tool_result" && evt.ok === false ? "failed" : ""}>
                      ✦ {activityLabel(evt)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
