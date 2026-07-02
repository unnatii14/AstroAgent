import { useRef, useState } from "react";

// Enter sends, Shift+Enter adds a newline. Disabled while a reply is pending
// so the user can't double-send into the same turn. The textarea grows with
// its content up to a max height, then scrolls.
export default function Composer({ onSend, disabled }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  function autoGrow() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    requestAnimationFrame(() => {
      autoGrow();
      ref.current?.focus();
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer">
      <textarea
        ref={ref}
        rows={1}
        placeholder="Ask the sky…"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          autoGrow();
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        className="send-btn"
        onClick={submit}
        disabled={disabled || !text.trim()}
        aria-label="Send"
      >
        ↑
      </button>
    </div>
  );
}
