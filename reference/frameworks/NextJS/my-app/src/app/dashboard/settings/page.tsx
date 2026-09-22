// This child page renders at /dashboard/settings.
// It is the last file in the nested-layout lesson. Next file to read:
// src/app/lessons/[slug]/page.tsx.

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Dashboard settings</h2>
      <p>
        This page proves the nested layout is shared by multiple child pages. The
        parent dashboard layout supplies the frame; this page supplies only settings content.
      </p>
    </div>
  );
}
