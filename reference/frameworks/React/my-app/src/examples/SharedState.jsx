import { useState } from "react";

export default function SharedState() {
  // When multiple children need to show or change the same value, put that state
  // in their closest shared parent. This is called "lifting state up."
  const [count, setCount] = useState(0);

  function incrementCount() {
    setCount((count) => count + 1);
  }

  return (
    <section>
      <p>
        Both buttons receive the same count value and the same update function
        from their parent. They stay synchronized because there is only one
        source of truth.
      </p>

      <SharedCounter label="First shared button" count={count} onIncrement={incrementCount} />
      <br />
      <SharedCounter label="Second shared button" count={count} onIncrement={incrementCount} />
    </section>
  );
}

function SharedCounter({ label, count, onIncrement }) {
  // Props are read-only from the child component's point of view. This child can
  // display count and call onIncrement, but it does not own the state itself.
  return (
    <div>
      <p>{label}</p>
      <button className="green-button" type="button" onClick={onIncrement}>
        Shared count is {count}
      </button>
    </div>
  );
}
