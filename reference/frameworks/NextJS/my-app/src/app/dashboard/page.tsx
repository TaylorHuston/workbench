// This page is the /dashboard index route.
// It renders inside src/app/dashboard/layout.tsx, so the dashboard explanation
// and dashboard nav stay visible around this child content.
// Next file to read: src/app/dashboard/activity/page.tsx.

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Dashboard overview</h2>
      <p>
        This child page only defines the overview content. The nested layout owns the
        shared dashboard frame, which keeps the page focused and avoids repeating nav.
      </p>
    </div>
  );
}
