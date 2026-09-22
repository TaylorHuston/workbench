// Canonical lesson list for the whole app.
// HomePage renders this data as cards, and LessonShell uses the same ids to show
// the current lesson header plus the next-lesson footer link. When a lesson page
// passes lessonId="server-components", that string must match an id here.

// TypeScript types describe code shape during development and build time. They
// are erased before JavaScript runs in the browser or on the server.
export type Lesson = {
  // id is the stable key other files use to find this lesson.
  id: string;
  step: number;
  title: string;
  href: string;
  sourcePath: string;
  summary: string;
};

export const learningPath: Lesson[] = [
  {
    id: "home-entry",
    step: 1,
    title: "App Router Entry",
    href: "/",
    sourcePath: "src/app/page.tsx",
    summary: "The home page is a Server Component route created by the app directory.",
  },
  {
    id: "routes-layouts",
    step: 2,
    title: "Routes and Layouts",
    href: "/routes-and-layouts",
    sourcePath: "src/app/routes-and-layouts/page.tsx",
    summary: "Folders become route segments, and layout.tsx wraps pages in shared UI.",
  },
  {
    id: "nested-layouts",
    step: 3,
    title: "Nested Layouts",
    href: "/dashboard",
    sourcePath: "src/app/dashboard/layout.tsx",
    summary: "A dashboard layout wraps only the dashboard route segment and its child pages.",
  },
  {
    id: "dynamic-routes",
    step: 4,
    title: "Dynamic Routes",
    href: "/lessons/example-slug",
    sourcePath: "src/app/lessons/[slug]/page.tsx",
    summary: "Bracket folders read URL params and render different content from one page file.",
  },
  {
    id: "server-components",
    step: 5,
    title: "Server Components",
    href: "/server-components",
    sourcePath: "src/app/server-components/page.tsx",
    summary: "App Router components run on the server by default and can await data before rendering.",
  },
  {
    id: "client-islands",
    step: 6,
    title: "Client Islands",
    href: "/client-islands",
    sourcePath: "src/app/client-islands/page.tsx",
    summary: "Use 'use client' only around interactive UI that needs browser state or events.",
  },
  {
    id: "data-fetching",
    step: 7,
    title: "Server Data Fetching",
    href: "/data-fetching",
    sourcePath: "src/app/data-fetching/page.tsx",
    summary: "Async Server Components can start independent data work in parallel before rendering.",
  },
  {
    id: "server-actions",
    step: 8,
    title: "Server Actions and SQLite",
    href: "/database",
    sourcePath: "src/app/database/page.tsx",
    summary: "A form posts to a Server Action that writes to local SQLite and revalidates the route.",
  },
  {
    id: "streaming-suspense",
    step: 9,
    title: "Streaming and Suspense",
    href: "/streaming",
    sourcePath: "src/app/streaming/page.tsx",
    summary: "Suspense boundaries stream slower UI while keeping the rest of the page responsive.",
  },
];

export function getNextLesson(currentId: string): Lesson | null {
  // TypeScript knows currentId is a string, but it cannot know whether the string
  // exists in learningPath. Returning null handles unknown ids safely.
  const currentIndex = learningPath.findIndex((lesson) => lesson.id === currentId);

  if (currentIndex === -1) {
    return null;
  }

  return learningPath[currentIndex + 1] ?? null;
}
