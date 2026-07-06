import { useState } from "react";
import StarField from "./components/StarField.jsx";
import WelcomeForm from "./components/WelcomeForm.jsx";
import Chat from "./components/Chat.jsx";

// App = one decision: do we know the birth details yet?
// No  -> welcome screen (the form).
// Yes -> chat. "Edit birth details" flips back without losing history.
const DETAILS_KEY = "astro_birth_details";
const SESSION_KEY = "astro_session_id";

function loadDetails() {
  try {
    return JSON.parse(localStorage.getItem(DETAILS_KEY));
  } catch {
    return null;
  }
}

function loadOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function App() {
  const [birthDetails, setBirthDetails] = useState(loadDetails);
  const [editing, setEditing] = useState(false);
  const [sessionId, setSessionId] = useState(loadOrCreateSessionId);

  function saveDetails(details) {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
    setBirthDetails(details);
    setEditing(false);
  }

  // "New chat" must reset BOTH memories: the browser history AND the
  // server-side graph thread. Rotating the session_id achieves the second -
  // the backend keys its conversation memory by thread_id, so a fresh id
  // means a genuinely blank slate. Birth details are kept (no re-asking).
  function startNewChat() {
    localStorage.removeItem(`astro_history_${sessionId}`);
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, fresh);
    setSessionId(fresh);
  }

  const showWelcome = !birthDetails || editing;

  return (
    <div className="app">
      <StarField />
      {showWelcome ? (
        <WelcomeForm initial={birthDetails} onSave={saveDetails} />
      ) : (
        <Chat
          key={sessionId} /* remount on new session -> clean state */
          birthDetails={birthDetails}
          sessionId={sessionId}
          onEditDetails={() => setEditing(true)}
          onNewChat={startNewChat}
        />
      )}
    </div>
  );
}
