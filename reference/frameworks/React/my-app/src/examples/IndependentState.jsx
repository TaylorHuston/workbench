import { useState } from "react";

export default function IndependentState() {
  return (
    <section>
      <p>
        Rendering the same component twice creates two separate component
        instances. Each instance gets its own state because the state belongs to
        that position in the rendered React tree.
      </p>

      <IndependentCounter label="First counter" />
      <br />
      <IndependentCounter label="Second counter" />
    </section>
  );
}

function IndependentCounter({ label }) {
  // This useState call runs once for each rendered IndependentCounter instance.
  // Clicking one button updates only that instance's count.
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount((currentCount) => currentCount + 1);
  }

  return (
    <div>
      <p>{label}</p>
      <button className="purple-button" type="button" onClick={handleClick}>
        Clicked {count} times
      </button>
    </div>
  );
}
