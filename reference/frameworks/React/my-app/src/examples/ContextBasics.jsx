import { createContext, useContext, useState } from "react";

// Context lets data skip past intermediate components when many parts of the tree
// need the same value. It is useful for themes, current user info, or language.

// The default value is used only when no matching provider exists above.
const ThemeContext = createContext("dark");

function ThemePreview() {
  const theme = useContext(ThemeContext);

  return <p>Current theme from context: {theme}</p>;
}

function Toolbar() {
  // Toolbar does not receive theme as a prop. useContext reads it from the nearest
  // ThemeContext provider above in the tree.
  return <ThemePreview />;
}

export default function ContextBasics() {
  const [theme, setTheme] = useState("dark");

  return (
    <section>
      <p>
        Context helps avoid passing the same prop through many layers when lots of
        nested components need the same value.
      </p>

      <button
        type="button"
        onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
      >
        Toggle theme
      </button>

      <ThemeContext.Provider value={theme}>
        <Toolbar />
      </ThemeContext.Provider>
    </section>
  );
}
