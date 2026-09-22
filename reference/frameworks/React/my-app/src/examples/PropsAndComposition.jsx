// Components become reusable when they receive data from their parent.
// In React, that input data is called props. Props are read-only from the child
// component's point of view, similar to function arguments in JavaScript.

function GreetingCard({ name, profession, achievement }) {
  return (
    <section>
      {/* Each use of GreetingCard renders the same structure with different data. */}
      <h3>{name}</h3>
      <p>{profession}</p>
      <p>{achievement}</p>
    </section>
  );
}

export default function PropsAndComposition() {
  return (
    <div>
      <p>
        Composition means building larger UI from smaller components. Here,
        <code> PropsAndComposition</code> renders multiple <code>GreetingCard</code>
        components and passes different props into each one.
      </p>

      <p>
        Props flow from parent to child. The child reads them, but it should not
        try to change them.
      </p>

      <GreetingCard
        name="Hedy Lamarr"
        profession="Inventor and actor"
        achievement="Helped pioneer spread-spectrum communication."
      />

      <GreetingCard
        name="Grace Hopper"
        profession="Computer scientist"
        achievement="Helped shape early compiler design."
      />
    </div>
  );
}
