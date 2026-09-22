import Link from "next/link";
import type { ReactNode } from "react";
import { getNextLesson, learningPath } from "@/lib/learning-path";

// Shared lesson wrapper. It is a support file, not a numbered lesson route.
// Next support file to read: src/app/layout.tsx.

type LessonShellProps = {
  // lessonId must match one of the ids in src/lib/learning-path.ts.
  // This connects each route page to the shared lesson metadata.
  lessonId: string;

  // ReactNode means "anything React can render", including JSX, text, null, or arrays.
  // Here it represents the individual lesson page content wrapped by this shell.
  children: ReactNode;
};

export function LessonShell({ lessonId, children }: LessonShellProps) {
  // The shell looks up the current lesson and the next lesson from the canonical
  // list so every lesson page gets consistent headings and navigation.
  const lesson = learningPath.find((item) => item.id === lessonId);
  const nextLesson = getNextLesson(lessonId);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10">
      <nav className="flex flex-wrap gap-3 text-sm text-slate-400">
        <Link className="text-cyan-300 hover:text-cyan-100" href="/">Home</Link>
        <span>/</span>
        <span>{lesson?.title ?? "Lesson"}</span>
      </nav>

      {lesson ? (
        <header className="rounded-3xl border border-slate-800 bg-slate-950 p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Lesson {lesson.step}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">{lesson.title}</h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-300">{lesson.summary}</p>
          <p className="mt-4 font-mono text-xs text-slate-500">Read: {lesson.sourcePath}</p>
        </header>
      ) : null}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-7 text-slate-200">
        {children}
      </section>

      <footer className="rounded-2xl border border-slate-800 p-5 text-sm text-slate-300">
        {nextLesson ? (
          <Link className="text-cyan-300 hover:text-cyan-100" href={nextLesson.href}>
            Next lesson route: {nextLesson.sourcePath}
          </Link>
        ) : (
          <span>You are at the final lesson.</span>
        )}
      </footer>
    </main>
  );
}
