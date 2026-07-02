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
  const [sessionId] = useState(loadOrCreateSessionId);

  function saveDetails(details) {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
    setBirthDetails(details);
    setEditing(false);
  }

  const showWelcome = !birthDetails || editing;

  return (
    <div className="app">
      <StarField />
      {showWelcome ? (
        <WelcomeForm initial={birthDetails} onSave={saveDetails} />
      ) : (
        <Chat
          birthDetails={birthDetails}
          sessionId={sessionId}
          onEditDetails={() => setEditing(true)}
        />
      )}
    </div>
  );
}
