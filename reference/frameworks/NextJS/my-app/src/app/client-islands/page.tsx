import { LessonShell } from "@/components/lesson-shell";
import { CounterIsland } from "./counter";

// This page introduces Client Component islands.
// The page stays server-rendered, while counter.tsx is the small interactive part.
// Next file to read: src/app/client-islands/counter.tsx.

export default function ClientIslandsPage() {
  return (
    <LessonShell lessonId="client-islands">
      <div className="space-y-6 leading-7">
        <p>
          Keep most of a route as Server Components, then create small Client Components
          only where the browser needs interactivity. This keeps the client bundle smaller.
        </p>

        <p>
          This page is still a Server Component. Only <code>counter.tsx</code> is a client island.
        </p>

        <CounterIsland />
      </div>
    </LessonShell>
  );
}
