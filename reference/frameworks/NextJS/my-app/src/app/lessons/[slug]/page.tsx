import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonShell } from "@/components/lesson-shell";

// This page introduces dynamic routes.
// The [slug] folder tells Next to pass the matching URL segment into params.
// You should arrive here after the nested layout lesson.
// Next file to read: src/app/server-components/page.tsx.

type LessonDetail = {
  title: string;
  body: string;
};

// Record<string, LessonDetail> means this object is keyed by URL slugs, and each
// value must have the LessonDetail shape. Unknown slugs still produce undefined,
// which is why the page checks lesson below and calls notFound().
const lessonDetails: Record<string, LessonDetail> = {
  "example-slug": {
    title: "Example Slug",
    body: "This neutral slug keeps the focus on routing instead of another lesson topic.",
  },
  "another-example": {
    title: "Another Example",
    body: "Dynamic routes are useful for docs, products, user profiles, and any repeated page shape.",
  },
};

type DynamicLessonPageProps = {
  // Next passes params to dynamic route pages. In this Next version params is a
  // Promise, so the page awaits it before reading slug.
  params: Promise<{
    slug: string;
  }>;
};

// generateStaticParams lists the known slugs that Next can prerender at build time.
// The returned objects must match the dynamic route params shape: { slug: string }.
export function generateStaticParams() {
  return Object.keys(lessonDetails).map((slug) => ({ slug }));
}

export default async function DynamicLessonPage({ params }: DynamicLessonPageProps) {
  // In current Next.js, params is asynchronous. Await it before reading slug.
  const { slug } = await params;
  const lesson = lessonDetails[slug];

  if (!lesson) {
    // notFound renders the nearest not-found UI for unknown dynamic route values.
    notFound();
  }

  return (
    <LessonShell lessonId="dynamic-routes">
      <div className="space-y-6 leading-7">
        <p>
          This page lives at <code>src/app/lessons/[slug]/page.tsx</code>. The bracketed
          folder means this one file can render many URLs.
        </p>

        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Current slug</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{lesson.title}</h2>
          <p className="mt-3 text-slate-300">{lesson.body}</p>
        </div>

        <p>
          Try another slug: <Link className="text-cyan-300" href="/lessons/another-example">another-example</Link>.
        </p>
      </div>
    </LessonShell>
  );
}
