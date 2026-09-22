// Ignore the import block when reading this file.
// The learningPath array below is the only place that defines lesson order.
import ChildrenAndComposition from "./ChildrenAndComposition.jsx";
import ControlledForms from "./ControlledForms.jsx";
import Conditional from "./Conditional.jsx";
import Counter from "./Counter.jsx";
import DerivedUI from "./DerivedUI.jsx";
import ImmutableUpdates from "./ImmutableUpdates.jsx";
import IndependentState from "./IndependentState.jsx";
import Lists from "./Lists.jsx";
import MultiStepForm from "./MultiStepForm.jsx";
import OptimisticUI from "./OptimisticUI.jsx";
import PreservingState from "./PreservingState.jsx";
import Profile from "./Profile.jsx";
import PropsAndComposition from "./PropsAndComposition.jsx";
import ReducerStateFlow from "./ReducerStateFlow.jsx";
import SharedState from "./SharedState.jsx";
import EffectBasics from "./EffectBasics.jsx";
import EffectCleanup from "./EffectCleanup.jsx";
import RefsAndDom from "./RefsAndDom.jsx";
import ContextBasics from "./ContextBasics.jsx";
import CustomHooks from "./CustomHooks.jsx";

// This array is the canonical reading order for the reference app.
// The live UI uses the same list, so the app and the source code stay aligned.
export const learningPath = [
  {
    id: "rendering-jsx",
    step: 1,
    title: "Rendering JSX",
    sourcePath: "src/examples/Profile.jsx",
    summary: "JSX expressions, attributes, image rendering, and inline style objects.",
    component: Profile,
  },
  {
    id: "props-composition",
    step: 2,
    title: "Props and Composition",
    sourcePath: "src/examples/PropsAndComposition.jsx",
    summary: "Passing data into child components and reusing component structure.",
    component: PropsAndComposition,
  },
  {
    id: "children-composition",
    step: 3,
    title: "Children and Composition",
    sourcePath: "src/examples/ChildrenAndComposition.jsx",
    summary: "Using the special children prop to build wrapper components.",
    component: ChildrenAndComposition,
  },
  {
    id: "conditional-rendering",
    step: 4,
    title: "Conditional Rendering",
    sourcePath: "src/examples/Conditional.jsx",
    summary: "Choosing what UI to render from ordinary JavaScript conditions.",
    component: Conditional,
  },
  {
    id: "lists-keys",
    step: 5,
    title: "Lists and Keys",
    sourcePath: "src/examples/Lists.jsx",
    summary: "Rendering arrays with stable keys and item-specific styling.",
    component: Lists,
  },
  {
    id: "events-state",
    step: 6,
    title: "Events and State",
    sourcePath: "src/examples/Counter.jsx",
    summary: "State updates, event handlers, and React's re-render cycle.",
    component: Counter,
  },
  {
    id: "independent-state",
    step: 7,
    title: "Independent State",
    sourcePath: "src/examples/IndependentState.jsx",
    summary: "Two component instances, each owning its own state value.",
    component: IndependentState,
  },
  {
    id: "shared-state",
    step: 8,
    title: "Shared State",
    sourcePath: "src/examples/SharedState.jsx",
    summary: "Lifting state up so sibling components stay synchronized.",
    component: SharedState,
  },
  {
    id: "controlled-forms",
    step: 9,
    title: "Controlled Forms",
    sourcePath: "src/examples/ControlledForms.jsx",
    summary: "Keeping form inputs in React state so UI and data stay in sync.",
    component: ControlledForms,
  },
  {
    id: "reducer-state-flow",
    step: 10,
    title: "Reducer-Based State Flow",
    sourcePath: "src/examples/ReducerStateFlow.jsx",
    summary: "Letting multiple children dispatch actions back to one parent reducer.",
    component: ReducerStateFlow,
  },
  {
    id: "multi-step-form",
    step: 11,
    title: "Multi-Step Form",
    sourcePath: "src/examples/MultiStepForm.jsx",
    summary: "Coordinating several child steps while the parent owns the full draft.",
    component: MultiStepForm,
  },
  {
    id: "derived-ui",
    step: 12,
    title: "Derived UI",
    sourcePath: "src/examples/DerivedUI.jsx",
    summary: "Filtering and grouping UI from state without duplicating data.",
    component: DerivedUI,
  },
  {
    id: "immutable-updates",
    step: 13,
    title: "Immutable Updates",
    sourcePath: "src/examples/ImmutableUpdates.jsx",
    summary: "Immutable arrays, history state, and deriving UI from previous moves.",
    component: ImmutableUpdates,
  },
  {
    id: "preserving-resetting-state",
    step: 14,
    title: "Preserving and Resetting State",
    sourcePath: "src/examples/PreservingState.jsx",
    summary: "How component position and keys affect whether state is kept or reset.",
    component: PreservingState,
  },
  {
    id: "effects-basics",
    step: 15,
    title: "Effects Basics",
    sourcePath: "src/examples/EffectBasics.jsx",
    summary: "Running side effects after render to synchronize with external systems.",
    component: EffectBasics,
  },
  {
    id: "effect-cleanup",
    step: 16,
    title: "Effect Cleanup",
    sourcePath: "src/examples/EffectCleanup.jsx",
    summary: "Cleaning up subscriptions and timers when effects re-run or unmount.",
    component: EffectCleanup,
  },
  {
    id: "optimistic-ui",
    step: 17,
    title: "Optimistic UI",
    sourcePath: "src/examples/OptimisticUI.jsx",
    summary: "Showing an immediate UI change, then confirming or rolling it back after async work.",
    component: OptimisticUI,
  },
  {
    id: "refs-dom",
    step: 18,
    title: "Refs and DOM Access",
    sourcePath: "src/examples/RefsAndDom.jsx",
    summary: "Using refs to read or control DOM nodes without triggering re-renders.",
    component: RefsAndDom,
  },
  {
    id: "context-basics",
    step: 19,
    title: "Context Basics",
    sourcePath: "src/examples/ContextBasics.jsx",
    summary: "Sharing values across a subtree without passing the same prop through every layer.",
    component: ContextBasics,
  },
  {
    id: "custom-hooks",
    step: 20,
    title: "Custom Hooks",
    sourcePath: "src/examples/CustomHooks.jsx",
    summary: "Packaging reusable hook logic into regular JavaScript functions that start with use.",
    component: CustomHooks,
  },
];
