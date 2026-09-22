# React App

A canonical React reference app built from small examples pulled from React tutorials and documentation. The goal is informational: each example should isolate one React concept and make the source easy to inspect.

## Running

```bash
npm install
npm run dev
```

Use these checks after changes:

```bash
npm run lint
npm run build
```

## Code Map

| Path | Purpose |
|---|---|
| `index.html` | Vite HTML shell with the `#root` mount point. |
| `src/main.jsx` | React entry point. Creates the root and renders `<App />` inside `<StrictMode>`. Read this first, then move into `src/examples/learningPath.js`. |
| `src/App.jsx` | Example gallery shell. Owns the active-example state, navigation metadata, and selected example rendering. Useful after the first pass through the examples. |
| `src/examples/learningPath.js` | Canonical example order used by both the code-reading path and the live UI. |
| `src/App.css` | App-specific layout and minimal dark theme styles. |
| `src/index.css` | Global document defaults, base font, and dark background. |
| `src/examples/` | Individual concept demos. Each file should focus on one React idea. |
| `src/assets/` | Static assets imported by components. |
| `public/` | Static assets served directly by Vite. |

## Example Components

This table matches the intended learning order from `src/examples/learningPath.js`.

| File | Concept |
|---|---|
| `src/examples/Profile.jsx` | JSX expressions, attributes, image rendering, and inline styles. |
| `src/examples/PropsAndComposition.jsx` | Passing data into child components and reusing component structure. |
| `src/examples/ChildrenAndComposition.jsx` | Using the `children` prop to build wrapper components. |
| `src/examples/Conditional.jsx` | Conditional rendering with ordinary JavaScript. |
| `src/examples/Lists.jsx` | Rendering arrays and using stable keys. |
| `src/examples/Counter.jsx` | Basic `useState`, event handling, and re-rendering. |
| `src/examples/IndependentState.jsx` | Separate component instances owning separate state. |
| `src/examples/SharedState.jsx` | Lifting state up and passing state through props. |
| `src/examples/ControlledForms.jsx` | Controlled inputs where React state is the source of truth. |
| `src/examples/ReducerStateFlow.jsx` | Multiple children dispatching actions back to one parent reducer. |
| `src/examples/MultiStepForm.jsx` | Parent-owned draft state coordinated across several child steps. |
| `src/examples/DerivedUI.jsx` | Derived UI: filtering, component decomposition, and recalculating visible rows from state. |
| `src/examples/ImmutableUpdates.jsx` | Immutable updates: history state and deriving the current board from past moves. |
| `src/examples/PreservingState.jsx` | How component position and keys affect whether state is preserved or reset. |
| `src/examples/EffectBasics.jsx` | Running side effects after render to synchronize with something outside React. |
| `src/examples/EffectCleanup.jsx` | Cleaning up timers or subscriptions when an effect re-runs or unmounts. |
| `src/examples/OptimisticUI.jsx` | Immediate UI updates that later confirm or roll back after async work. |
| `src/examples/RefsAndDom.jsx` | Using refs to hold mutable values and interact with DOM nodes directly. |
| `src/examples/ContextBasics.jsx` | Sharing values across a subtree without prop drilling through every layer. |
| `src/examples/CustomHooks.jsx` | Extracting reusable stateful logic into functions that use Hooks. |

## Start Here

Read the app in this order:

Steps 12-13 extend controlled forms into parent-coordinated workflows. Step 19
returns to workflows after the effects lessons, using an async optimistic update
flow that is intentionally more advanced.

1. `src/main.jsx`
2. `src/examples/learningPath.js`
3. `src/examples/Profile.jsx`
4. `src/examples/PropsAndComposition.jsx`
5. `src/examples/ChildrenAndComposition.jsx`
6. `src/examples/Conditional.jsx`
7. `src/examples/Lists.jsx`
8. `src/examples/Counter.jsx`
9. `src/examples/IndependentState.jsx`
10. `src/examples/SharedState.jsx`
11. `src/examples/ControlledForms.jsx`
12. `src/examples/ReducerStateFlow.jsx`
13. `src/examples/MultiStepForm.jsx`
14. `src/examples/DerivedUI.jsx`
15. `src/examples/ImmutableUpdates.jsx`
16. `src/examples/PreservingState.jsx`
17. `src/examples/EffectBasics.jsx`
18. `src/examples/EffectCleanup.jsx`
19. `src/examples/OptimisticUI.jsx`
20. `src/examples/RefsAndDom.jsx`
21. `src/examples/ContextBasics.jsx`
22. `src/examples/CustomHooks.jsx`

The live app mirrors that same order so you can compare the code and behavior side by side.
`src/App.jsx` powers that gallery, but it is not part of the first-pass lesson sequence.

## Adding An Example

1. Create a focused component in `src/examples/ExampleName.jsx`.
2. Export the component as the default export.
3. Import it in `src/examples/learningPath.js`.
4. Add one entry to `src/examples/learningPath.js` with `id`, `title`, `summary`, `sourcePath`, and `component`.
5. Run `npm run lint` and `npm run build`.

Keep comments educational. Explain React-specific decisions such as state ownership, props, keys, effects, and immutable updates. Avoid comments that only restate the syntax.
