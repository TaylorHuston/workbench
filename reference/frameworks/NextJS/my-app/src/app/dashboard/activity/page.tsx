// This child page renders at /dashboard/activity.
// It reuses the same dashboard layout as /dashboard, so only this inner activity
// content changes when navigating between dashboard child routes.
// Next file to read: src/app/dashboard/settings/page.tsx.

export default function DashboardActivityPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Recent activity</h2>
      <ul className="list-disc space-y-2 pl-6 text-slate-300">
        <li>Read the nested layout lesson.</li>
        <li>Visited a child dashboard route.</li>
        <li>Kept the same dashboard frame around changing page content.</li>
      </ul>
    </div>
  );
}
