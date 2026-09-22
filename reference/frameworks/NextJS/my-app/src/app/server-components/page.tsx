import { LessonShell } from "@/components/lesson-shell";

// This page introduces Server Components.
// In the App Router, page files are Server Components unless a file starts with
// "use client". Next file to read: src/app/client-islands/page.tsx.

type ServerFact = {
  // This is a literal type. runtime can only be the exact string "server".
  runtime: "server";
  message: string;
};

// Promise<ServerFact> tells TypeScript this async function resolves to an object
// with the ServerFact shape before the component renders it.
async function getServerFact(): Promise<ServerFact> {
  return {
    runtime: "server",
    message: "This object was created before any browser JavaScript ran.",
  };
}

export default async function ServerComponentsPage() {
  const fact = await getServerFact();

  return (
    <LessonShell lessonId="server-components">
      <div className="space-y-6 leading-7">
        <p>
          Files in <code>src/app</code> are Server Components by default. They can read
          server-only data, await promises, and send already-rendered HTML to the browser.
        </p>

        <p>
          Because this component does not use browser state or event handlers, it does
          not need <code>&quot;use client&quot;</code> and does not add component code to the client bundle.
        </p>

        <pre className="overflow-auto rounded-2xl bg-slate-950 p-5 text-sm text-cyan-100">
          {JSON.stringify(fact, null, 2)}
        </pre>
      </div>
    </LessonShell>
  );
}
