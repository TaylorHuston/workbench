import { useRef } from "react";

// Refs let React components hold a mutable value that does not trigger re-renders.
// They are commonly used to read or control a DOM node.

export default function RefsAndDom() {
  // The initial ref value is null because the input does not exist until after
  // React renders it and attaches the ref.
  const inputRef = useRef(null);

  function focusInput() {
    // React sets inputRef.current to the underlying DOM element after render.
    inputRef.current?.focus();
  }

  return (
    <section>
      <p>
        Refs are an escape hatch for interacting with DOM APIs directly when that
        is easier than expressing the behavior declaratively.
      </p>

      <input ref={inputRef} type="text" placeholder="Click the button to focus me" />
      <button type="button" onClick={focusInput}>
        Focus input
      </button>
    </section>
  );
}
