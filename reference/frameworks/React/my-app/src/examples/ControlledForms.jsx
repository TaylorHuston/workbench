import { useState } from "react";

// Form controls are usually "controlled" in React: the current input value
// lives in state, and onChange events push user edits back into that state.

export default function ControlledForms() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [subscribe, setSubscribe] = useState(true);

  function handleSubmit(event) {
    // Prevent the browser's default full page form submission so this example
    // can stay fully client-side.
    event.preventDefault();
  }

  return (
    <section>
      <p>
        The main idea in this lesson is that form fields can be treated like any
        other stateful UI. React state is the source of truth, and the browser
        input just reflects that state.
      </p>

      <p>
        The repeating pattern is: state, then the input prop, then `onChange`,
        then updated state again.
      </p>

      <p>
        Text inputs and selects are usually controlled with `value`, while
        checkboxes are controlled with `checked`. Those two browser-specific
        properties are the main details to notice here.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Submit handling is secondary here; the form just prevents Enter from reloading the page. */}
        <div>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
            />
          </label>
        </div>

        <div>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="guest">Guest</option>
            </select>
          </label>
        </div>

        <label>
          <input
            type="checkbox"
            checked={subscribe}
            onChange={(event) => setSubscribe(event.target.checked)}
          />
          Subscribe to updates
        </label>
      </form>

      {/* This preview is derived from the current form state. */}
      <p>
        Preview: {name || "Anonymous"} is a {role} and {subscribe ? "is" : "is not"} subscribed.
      </p>
    </section>
  );
}
