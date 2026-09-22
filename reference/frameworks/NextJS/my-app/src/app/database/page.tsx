import { LessonShell } from "@/components/lesson-shell";
import { getNotes } from "@/lib/notes";
import { createNote, deleteNote } from "./actions";
import { SubmitButton } from "./submit-button";

// This page introduces Server Actions with a local SQLite database.
// Read the flow here first, then read src/app/database/actions.ts, then
// src/lib/notes.ts, then src/app/database/submit-button.tsx.
//
// Full data flow for this lesson:
// 1. This Server Component calls getNotes() from src/lib/notes.ts while rendering.
// 2. The create form submits directly to createNote() in actions.ts.
// 3. createNote() receives FormData on the server, validates it, and calls insertNote().
// 4. insertNote() writes to SQLite in src/lib/notes.ts.
// 5. revalidatePath("/database") makes the next render call getNotes() again.
// 6. SubmitButton is the only Client Component here; it only reads pending form state.

// This route reads local SQLite at request time, so it should render dynamically
// instead of being treated as static content from the build.
export const dynamic = "force-dynamic";

export default function DatabasePage() {
  // getNotes() runs on the server during render. The returned Note[] is used to
  // build HTML before the browser receives this route.
  const notes = getNotes();

  return (
    <LessonShell lessonId="server-actions">
      <div className="space-y-6 leading-7">
        <p>
          This route reads from local SQLite in a Server Component. The form posts to
          a Server Action, which runs on the server, writes to SQLite, and calls
          <code>revalidatePath(&quot;/database&quot;)</code> so the refreshed page shows the new data.
        </p>

        <ol className="list-decimal space-y-2 pl-6 text-slate-300">
          <li>The browser submits the form.</li>
          <li>Next invokes the Server Action on the server.</li>
          <li>The action reads <code>FormData</code> and writes through <code>src/lib/notes.ts</code>.</li>
          <li><code>revalidatePath</code> tells Next to refresh this route&apos;s server-rendered data.</li>
        </ol>

        <form action={createNote} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-5">
          {/*
            action={createNote} is a Next.js Server Action convention, not ordinary
            HTML or a normal React onSubmit handler. Next turns this form submission
            into a server call to the createNote function in actions.ts.
          */}
          <label>
            Note body
            <textarea name="body" placeholder="Write a local SQLite note" required rows={3} />
          </label>
          {/* SubmitButton is a tiny client island inside this Server Component. */}
          <SubmitButton pendingLabel="Saving...">Save note</SubmitButton>
        </form>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">Latest notes</h2>
          {notes.length === 0 ? <p>No notes yet. Add one above.</p> : null}

          {notes.map((note) => (
            <article className="rounded-2xl border border-slate-700 bg-slate-950 p-5" key={note.id}>
              <p className="text-white">{note.body}</p>
              <p className="mt-2 text-xs text-slate-500">Created at {note.created_at}</p>
              <form action={deleteNote} className="mt-4">
                {/* Hidden inputs are included in FormData, so deleteNote can read this id on the server. */}
                <input name="id" type="hidden" value={note.id} />
                <SubmitButton pendingLabel="Deleting...">Delete</SubmitButton>
              </form>
            </article>
          ))}
        </div>
      </div>
    </LessonShell>
  );
}
