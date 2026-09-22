import Link from "next/link";
import { LessonShell } from "@/components/lesson-shell";

// This page introduces file-system routing and layouts.
// The URL comes from this file path: src/app/routes-and-layouts/page.tsx.
// In the App Router, a folder creates the URL segment and page.tsx is the file
// Next renders for that segment. A random file like hello.tsx would not become a route.
// You already read the root layout support file. Next file to read:
// src/app/dashboard/layout.tsx.

export default function RoutesAndLayoutsPage() {
  return (
    <LessonShell lessonId="routes-layouts">
      <div className="space-y-6 leading-7">
        <p>
          In the App Router, folders inside <code>src/app</code> become route segments.
          This file lives at <code>src/app/routes-and-layouts/page.tsx</code>, so it renders
          the <code>/routes-and-layouts</code> URL.
        </p>

        <p>
          The root <code>src/app/layout.tsx</code> wraps every page. Layouts are the right
          place for shared HTML structure, metadata, fonts, and navigation that should
          survive across route changes.
        </p>

        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
          <p className="font-semibold text-white">Try a nested layout next:</p>
          <Link className="mt-3 inline-block text-cyan-300 hover:text-cyan-100" href="/dashboard">
            Open /dashboard
          </Link>
        </div>
      </div>
    </LessonShell>
  );
}
