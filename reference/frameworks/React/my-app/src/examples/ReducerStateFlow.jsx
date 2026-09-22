import { useReducer, useState } from "react";

// useReducer is useful when several UI events all update the same shared state.
// Instead of scattering update logic across many handlers, the parent keeps one
// reducer and children dispatch plain action objects that describe what happened.

const initialTasks = [
  { id: 1, text: "Read the lesson", done: true },
  { id: 2, text: "Dispatch an action from a child", done: false },
];

// This is only simple ID bookkeeping for the demo. It is not React state and it
// is not part of the reducer pattern itself.
let nextTaskId = 3;

function tasksReducer(tasks, action) {
  switch (action.type) {
    case "added":
      return [...tasks, { id: action.id, text: action.text, done: false }];
    case "toggled":
      return tasks.map((task) => {
        if (task.id !== action.id) {
          return task;
        }

        return { ...task, done: !task.done };
      });
    case "removed":
      return tasks.filter((task) => task.id !== action.id);
    default:
      return tasks;
  }
}

function AddTaskForm({ dispatch }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    dispatch({ type: "added", id: nextTaskId, text: trimmedText });
    nextTaskId += 1;
    setText("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        New task
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a task"
        />
      </label>
      <button type="submit">Add task</button>
    </form>
  );
}

function TaskList({ tasks, dispatch }) {
  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>
          <label>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => dispatch({ type: "toggled", id: task.id })}
            />
            {task.done ? <s>{task.text}</s> : task.text}
          </label>
          <button type="button" onClick={() => dispatch({ type: "removed", id: task.id })}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ReducerStateFlow() {
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);

  return (
    <section>
      <p>
        The parent owns the task list, but child components send actions back up
        to request changes. This keeps one shared workflow while letting each
        child stay focused on its own UI.
      </p>

      <p>
        The main new idea here is the state-flow pattern: children send actions
        upward, and one reducer in the parent decides how state changes.
      </p>

      <p>
        Notice that the children do not know how tasks are updated internally.
        They only dispatch actions like `added`, `toggled`, and `removed`.
      </p>

      <AddTaskForm dispatch={dispatch} />
      <TaskList tasks={tasks} dispatch={dispatch} />
    </section>
  );
}
