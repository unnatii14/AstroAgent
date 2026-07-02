import { useState } from "react";

// Birth details are the key to every reading, so this screen asks for them
// once, gently, before the conversation begins.
export default function WelcomeForm({ initial, onSave }) {
  const [date, setDate] = useState(initial?.date || "");
  const [time, setTime] = useState(initial?.time || "");
  const [timeUnknown, setTimeUnknown] = useState(initial ? initial.time === null : false);
  const [place, setPlace] = useState(initial?.place || "");
  const [errors, setErrors] = useState({});

  function validate() {
    const errs = {};
    if (!date) {
      errs.date = "Please share your birth date.";
    } else {
      const d = new Date(date + "T00:00:00");
      if (Number.isNaN(d.getTime())) errs.date = "That date doesn't look right.";
      else if (d > new Date()) errs.date = "A birth date can't be in the future.";
      else if (d.getFullYear() < 1500) errs.date = "Please use a year after 1500.";
    }
    if (!timeUnknown && !time) {
      errs.time = "Add your birth time, or tick the box below if you don't know it.";
    }
    if (!place.trim()) errs.place = "Please share the city you were born in.";
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSave({ date, time: timeUnknown ? null : time, place: place.trim() });
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-card fade-up">
        <div className="welcome-mark">✦</div>
        <h1>AstroAgent</h1>
        <p className="welcome-sub">
          A quiet companion for reading your stars. Share your birth details
          once, and we can begin.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label>
            Date of birth
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
            />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </label>

          <label>
            Time of birth
            <input
              type="time"
              value={time}
              disabled={timeUnknown}
              onChange={(e) => setTime(e.target.value)}
              aria-invalid={!!errors.time}
            />
            {errors.time && <span className="field-error">{errors.time}</span>}
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={timeUnknown}
              onChange={(e) => setTimeUnknown(e.target.checked)}
            />
            <span>I don't know my birth time</span>
          </label>
          {timeUnknown && (
            <p className="field-hint">
              No trouble — signs will still be accurate, though the ascendant
              and houses need an exact time.
            </p>
          )}

          <label>
            Place of birth
            <input
              type="text"
              placeholder="e.g. Jaipur, India"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              aria-invalid={!!errors.place}
            />
            {errors.place && <span className="field-error">{errors.place}</span>}
          </label>

          <button type="submit" className="primary-btn">
            Begin the reading
          </button>
        </form>
      </div>
    </div>
  );
}
