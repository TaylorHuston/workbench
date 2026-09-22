import { LessonShell } from "@/components/lesson-shell";

// This page introduces data fetching in async Server Components.
// The key idea is starting independent async work before awaiting it.
// Next file to read: src/app/database/page.tsx.

type Profile = {
  name: string;
  role: string;
};

type Stats = {
  lessons: number;
  database: string;
};

function wait(ms: number): Promise<void> {
  // Promise<void> means this async helper resolves later but does not return data.
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Promise<Profile> and Promise<Stats> document the data each async server helper
// must eventually return. The component below can rely on those shapes.
async function getProfile(): Promise<Profile> {
  await wait(150);
  return { name: "Ada Lovelace", role: "Server Component reader" };
}

async function getStats(): Promise<Stats> {
  await wait(150);
  return { lessons: 9, database: "SQLite" };
}

export default async function DataFetchingPage() {
  // Start independent work before awaiting so the requests run in parallel.
  const profilePromise = getProfile();
  const statsPromise = getStats();
  const [profile, stats] = await Promise.all([profilePromise, statsPromise]);

  return (
    <LessonShell lessonId="data-fetching">
      <div className="space-y-6 leading-7">
        <p>
          Async Server Components can fetch data before rendering. When two pieces of
          data are independent, start both promises first and await them together to
          avoid a request waterfall.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <pre className="rounded-2xl bg-slate-950 p-5 text-sm text-cyan-100">{JSON.stringify(profile, null, 2)}</pre>
          <pre className="rounded-2xl bg-slate-950 p-5 text-sm text-cyan-100">{JSON.stringify(stats, null, 2)}</pre>
        </div>
      </div>
    </LessonShell>
  );
}
