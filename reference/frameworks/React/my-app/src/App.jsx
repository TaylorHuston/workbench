import { useState } from "react";
import "./App.css";
import { learningPath } from "./examples/learningPath.js";

// App is the root component for this project. main.jsx starts React; App.jsx
// describes the UI that React should render after startup. Keeping this separate
// makes main.jsx a clean entry point and makes App.jsx the place to study app
// composition, state, and rendering.
export default function App() {
  const [activeExampleId, setActiveExampleId] = useState(learningPath[0].id);
  const activeExample = learningPath.find((example) => example.id === activeExampleId) ?? learningPath[0];
  const activeExampleIndex = learningPath.findIndex((example) => example.id === activeExample.id);
  const nextExample = learningPath[activeExampleIndex + 1] ?? null;
  const ActiveExampleComponent = activeExample.component;

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <p className="eyebrow">Canonical React App</p>
        <h1>Examples for the core React mental model.</h1>
        <p className="hero-copy">
          Start in <code>src/main.jsx</code>, then follow the ordered learning path
          through the source files. The UI mirrors that same order for quick checks.
        </p>
      </header>

      <section className="workspace" aria-label="React examples">
        <nav className="example-nav" aria-label="Example picker">
          {learningPath.map((example) => {
            const isActive = example.id === activeExample.id;

            return (
              <button
                className={isActive ? "example-tab active" : "example-tab"}
                type="button"
                key={example.id}
                onClick={() => setActiveExampleId(example.id)}
                aria-pressed={isActive}
              >
                <span>{example.step}. {example.title}</span>
                <small>{example.summary}</small>
              </button>
            );
          })}
        </nav>

        <article className="example-stage">
          <div className="example-heading">
            <p className="eyebrow">Selected example</p>
            <h2>{activeExample.title}</h2>
            <p>{activeExample.summary}</p>
            <p className="source-path">Read: <code>{activeExample.sourcePath}</code></p>
            <p className="source-path">
              Next: {nextExample ? <code>{nextExample.sourcePath}</code> : "You are at the final lesson."}
            </p>
          </div>

          <div className="example-card">
            <ActiveExampleComponent />
          </div>
        </article>
      </section>
    </main>
  );
}
