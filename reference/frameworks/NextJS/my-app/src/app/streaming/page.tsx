import { Suspense } from "react";
import { LessonShell } from "@/components/lesson-shell";

// This page introduces Suspense streaming for slow UI.
// It focuses on loading behavior only; error boundaries would be a separate lesson.
// This is the final lesson in the current path.

function wait(ms: number): Promise<void> {
  // This helper creates an artificial delay so the Suspense fallback is visible.
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function SlowPanel() {
  // SlowPanel is an async Server Component, so React can pause this part of the
  // tree while the rest of the page renders.
  await wait(700);

  return (
    <div className="rounded-2xl border border-cyan-900 bg-slate-950 p-5">
      <p className="text-cyan-100">This slower Server Component streamed in after the fallback.</p>
    </div>
  );
}

export default function StreamingPage() {
  return (
    <LessonShell lessonId="streaming-suspense">
      <div className="space-y-6 leading-7">
        <p>
          Suspense lets a route show fast content immediately while slower pieces keep
          loading. In a full app, route-level <code>loading.tsx</code> and <code>error.tsx</code>
          files provide similar boundaries at the segment level.
        </p>

        <Suspense fallback={<p className="rounded-2xl border border-slate-700 bg-slate-950 p-5">Loading slow panel...</p>}>
          {/* Suspense shows fallback first, then streams SlowPanel when its await finishes. */}
          <SlowPanel />
        </Suspense>
      </div>
    </LessonShell>
  );
}
