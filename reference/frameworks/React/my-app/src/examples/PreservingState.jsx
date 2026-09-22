import { useState } from "react";

// React preserves state by component position. If the same component stays in
// the same place in the tree, its state is kept. Changing a component's key tells
// React to treat it as a new instance and reset its state.

function ScoreCounter({ label }) {
  const [score, setScore] = useState(0);

  return (
    <div>
      <p>{label}</p>
      <button type="button" onClick={() => setScore((currentScore) => currentScore + 1)}>
        Score is {score}
      </button>
    </div>
  );
}

export default function PreservingState() {
  const [player, setPlayer] = useState("Taylor");

  return (
    <section>
      <p>
        The counter below resets when you switch players because the <code>key</code>
        changes. Without that key, React would preserve the same component state.
      </p>

      <p>
        The key is not just for lists. It can also tell React, "this should count
        as a different component instance now."
      </p>

      <button
        type="button"
        onClick={() => setPlayer((currentPlayer) => (currentPlayer === "Taylor" ? "Alex" : "Taylor"))}
      >
        Switch player
      </button>

      <ScoreCounter key={player} label={`Current player: ${player}`} />
    </section>
  );
}
