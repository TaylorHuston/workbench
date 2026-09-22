import Link from "next/link";
import type { ReactNode } from "react";
import { LessonShell } from "@/components/lesson-shell";

// This nested layout wraps only the /dashboard route segment and its children.
// The root src/app/layout.tsx still wraps the entire site first. Then this file
// adds dashboard-specific navigation around dashboard/page.tsx, dashboard/activity/page.tsx,
// and dashboard/settings/page.tsx.
// Render tree example for /dashboard/activity:
// RootLayout -> DashboardLayout -> LessonShell -> dashboard frame -> {children}.
// For /dashboard/activity, Next supplies dashboard/activity/page.tsx as children;
// dashboard/layout.tsx does not manually import that child page.
// Next file to read: src/app/dashboard/page.tsx.

type DashboardLayoutProps = {
  // children is whichever dashboard child page is active for the current URL.
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <LessonShell lessonId="nested-layouts">
      <div className="space-y-6 leading-7">
        <p>
          This content comes from <code>src/app/dashboard/layout.tsx</code>. It appears on
          every route inside <code>/dashboard</code>, while each child page changes below.
        </p>

        <nav className="flex flex-wrap gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm">
          <Link className="text-cyan-300 hover:text-cyan-100" href="/dashboard">Overview</Link>
          <Link className="text-cyan-300 hover:text-cyan-100" href="/dashboard/activity">Activity</Link>
          <Link className="text-cyan-300 hover:text-cyan-100" href="/dashboard/settings">Settings</Link>
        </nav>

        <section className="rounded-2xl border border-cyan-900 bg-slate-950 p-5">
          {children}
        </section>
      </div>
    </LessonShell>
  );
}
