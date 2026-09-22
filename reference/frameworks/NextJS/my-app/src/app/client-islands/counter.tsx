"use client";

// "use client" must be the first statement in the file. It tells Next this
// component runs in the browser, so it can use state and click handlers.

import { useState } from "react";

export function CounterIsland() {
  // useState stores browser-side component state. count is the current value, and
  // setCount asks React to update that value and rerender this client island.
  // TypeScript infers count is a number because the initial state is 0.
  const [count, setCount] = useState(0);

  return (
    <div className="rounded-2xl border border-cyan-900 bg-slate-950 p-5">
      <p className="text-slate-300">
        This component needs browser state and a click handler, so this file starts
        with <code>&quot;use client&quot;</code>.
      </p>

      <button
        className="mt-4"
        type="button"
        // The updater function receives the latest value and returns the next value.
        onClick={() => setCount((value) => value + 1)}
      >
        Count is {count}
      </button>
    </div>
  );
}
