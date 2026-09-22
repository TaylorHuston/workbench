// React automatically passes nested JSX into a component through the special
// children prop. This lets one component wrap or arrange other UI without
// needing to know exactly what that UI is ahead of time.

function Panel({ title, children }) {
  return (
    <section>
      <h3>{title}</h3>

      {/* children is just another prop, but React fills it with nested JSX. */}
      <div>{children}</div>
    </section>
  );
}

export default function ChildrenAndComposition() {
  return (
    <div>
      <p>
        Some components are more useful as containers than as fixed widgets.
        They provide structure, and the parent decides what goes inside.
      </p>

      <Panel title="Profile summary">
        <p>Hedy Lamarr</p>
        <p>Inventor and actor</p>
      </Panel>

      <Panel title="Next step">
        <button type="button">Open details</button>
      </Panel>
    </div>
  );
}
