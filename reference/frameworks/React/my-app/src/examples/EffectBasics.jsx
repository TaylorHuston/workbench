import { useEffect, useState } from "react";

// Effects let a component synchronize with something outside React's render
// output, such as the document title, a timer, or a browser API.

export default function EffectBasics() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Render should stay pure. Updating document.title is a side effect, so it
    // belongs in useEffect instead of directly in the component body.
    document.title = `Count: ${count}`;
  }, [count]);
  // The dependency array says: re-run this effect whenever count changes.

  return (
    <section>
      <p>
        Click the button, then look at the browser tab title. The effect runs
        after React commits the updated UI.
      </p>

      <button type="button" onClick={() => setCount((currentCount) => currentCount + 1)}>
        Count is {count}
      </button>
    </section>
  );
}
