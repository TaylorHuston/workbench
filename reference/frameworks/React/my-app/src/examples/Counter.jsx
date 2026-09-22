import { useState } from "react";

export default function Counter() {
  // useState lets a component remember a value between renders.
  // count is the current value. setCount asks React to render again with a new value.
  const [count, setCount] = useState(0);

  function handleClick() {
    // Use the functional updater form when the next value depends on the previous
    // value. React passes the latest count into this callback.
    setCount((currentCount) => currentCount + 1);
  }

  function handleReset() {
    setCount(0);
  }

  return (
    <section>
      <p>
        React re-runs this component function after state changes, then updates
        the DOM to match the new JSX result.
      </p>

      <div className="card">
        {/* Event prop names use camelCase, so React uses onClick instead of onclick. */}
        <button type="button" onClick={handleClick}>
          Count is {count}
        </button>

        <button type="button" onClick={handleReset}>
          Reset
        </button>
      </div>

      <p>
        Do not assign directly to <code>count</code>. State is updated through
        <code> setCount</code> so React knows it needs to render again.
      </p>
    </section>
  );
}
