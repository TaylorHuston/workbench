import { useEffect, useState } from "react";

// A custom hook is a regular JavaScript function whose name starts with `use`.
// It lets you package React hook logic into a reusable unit.

function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function useToggle(initialValue) {
  const [value, setValue] = useState(initialValue);

  function toggle() {
    setValue((currentValue) => !currentValue);
  }

  return [value, toggle];
}

export default function CustomHooks() {
  const [isOpen, toggleIsOpen] = useToggle(false);

  // The component does not need to know how the title is updated internally.
  // It only uses the custom hook's API.
  useDocumentTitle(isOpen ? "Panel open" : "Panel closed");

  return (
    <section>
      <p>
        Custom hooks do not add new React features. They let you reuse stateful
        logic without duplicating the same hook code in many components.
      </p>

      <button type="button" onClick={toggleIsOpen}>
        {isOpen ? "Hide details" : "Show details"}
      </button>

      {isOpen ? <p>The page title now reflects that this panel is open.</p> : null}
    </section>
  );
}
