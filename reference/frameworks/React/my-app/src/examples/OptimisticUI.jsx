import { useState } from "react";

// Optimistic UI updates the screen before the server confirms the change. This
// makes the interface feel immediate, but the parent still needs a rollback path
// if the request fails.
// Read this file in four stages: child submit, optimistic insert, success
// replacement, and failure rollback.

function CommentComposer({ onSubmit }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    onSubmit(trimmedText);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        New comment
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='Try "Ship it" or include "error" to simulate failure'
        />
      </label>
      <button type="submit">Post comment</button>
    </form>
  );
}

function CommentList({ comments }) {
  return (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id}>
          {comment.text} {comment.status === "sending" ? <em>(sending...)</em> : null}
        </li>
      ))}
    </ul>
  );
}

function saveComment(text) {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (text.toLowerCase().includes("error")) {
        reject(new Error("The server rejected that comment."));
        return;
      }

      resolve({ id: `saved-${Date.now()}`, text, status: "saved" });
    }, 900);
  });
}

export default function OptimisticUI() {
  const [comments, setComments] = useState([
    { id: "saved-1", text: "Looks good to me.", status: "saved" },
  ]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAddComment(text) {
    const optimisticId = `pending-${Date.now()}`;

    setErrorMessage("");

    // Show the new comment immediately so the UI feels responsive.
    setComments((currentComments) => [
      { id: optimisticId, text, status: "sending" },
      ...currentComments,
    ]);

    try {
      const savedComment = await saveComment(text);

      setComments((currentComments) => currentComments.map((comment) => {
        if (comment.id !== optimisticId) {
          return comment;
        }

        return savedComment;
      }));
    } catch (error) {
      // If the request fails, remove the optimistic item and explain what happened.
      setComments((currentComments) => currentComments.filter((comment) => comment.id !== optimisticId));
      setErrorMessage(error.message);
    }
  }

  return (
    <section>
      <p>
        This is a capstone workflow example. Focus on four stages: the child form
        submits text, the parent inserts an optimistic comment immediately, a
        successful request replaces that temporary item, and a failed request
        removes it again.
      </p>

      <p>
        Type a normal comment to simulate success. Include the word `error` to see
        the rollback path.
      </p>

      <CommentComposer onSubmit={handleAddComment} />

      {errorMessage ? <p>Save failed: {errorMessage}</p> : null}

      <CommentList comments={comments} />
    </section>
  );
}
