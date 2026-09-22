import Link from "next/link";
import { learningPath } from "@/lib/learning-path";

// Start here when reading the Next.js examples.
//
// Unlike the React-only app, there is no src/main.jsx. Next owns the browser
// bootstrap and calls this app/page.tsx file because the App Router maps files to
// routes. This page is a Server Component by default.
//
// This app uses the App Router. Older tutorials may use src/pages instead;
// ignore those Pages Router patterns while following this reference app.
//
// React syntax note: functions that return JSX are components. JSX looks like
// HTML, but it is JavaScript. Use className instead of class, pass values through
// props, and provide key when mapping arrays into UI.
//
// Next file to read: src/lib/learning-path.ts.

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-10 sm:px-10">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-8 shadow-2xl shadow-cyan-950/30">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Next.js Reference App</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          App Router examples for React developers learning Next.js.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Read this app from <code>src/app/page.tsx</code>, then follow the ordered lessons below.
          Each lesson highlights what Next.js adds on top of React: routing, server rendering,
          client islands, data fetching, Server Actions, and a small SQLite-backed workflow.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {learningPath.map((lesson) => (
          <Link
            className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-slate-900"
            href={lesson.href}
            key={lesson.id}
          >
            <p className="text-sm font-medium text-cyan-300">Lesson {lesson.step}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white group-hover:text-cyan-100">{lesson.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{lesson.summary}</p>
            <p className="mt-4 font-mono text-xs text-slate-500">Read: {lesson.sourcePath}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
