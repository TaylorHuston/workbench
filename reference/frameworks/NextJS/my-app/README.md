# Next.js Reference App

A code-first Next.js App Router reference app written in TypeScript. It is meant to sit beside the React reference app and show what Next.js adds on top of React: file-system routing, layouts, Server Components, Client Components, async data fetching, Server Actions, streaming UI, and simple local SQLite persistence.

This app assumes you can already read basic React syntax. If JSX, components, props, `className`, or `key` are new, read the React reference app first or treat `src/app/page.tsx` as a tiny primer before continuing.

If React is new, use these definitions while reading this app:

| Term | Meaning |
|---|---|
| Component | A function that returns JSX. Components start with capital letters. |
| JSX | JavaScript syntax that describes UI with HTML-like tags. |
| Props | Values passed into a component, similar to function arguments. |
| `children` | The nested JSX passed between a component's opening and closing tags. |
| `className` | JSX uses `className` instead of HTML's `class` attribute. |
| `key` | A stable identifier React needs when rendering arrays of elements. |
| Server Component | A component that renders on the server unless its file starts with `"use client"`. |

This app was scaffolded with `create-next-app@16.2.4` and uses:

| Tool | Version |
|---|---|
| `next` | `16.2.4` |
| `react` | `19.2.4` |
| `react-dom` | `19.2.4` |
| `tailwindcss` | `^4` |
| `better-sqlite3` | `^12.9.0` |

## Running

```bash
npm install
npm run dev
```

Use these checks after changes:

```bash
npm run lint
npm run build
```

The database lesson writes local runtime data to `data/next-reference.sqlite`. That file is ignored by git.
`src/lib/notes.ts` creates that file on first read/write. `next.config.mjs` keeps `better-sqlite3` as a server external because it is a native Node package and must not be bundled for the browser.

Imports that start with `@/` resolve from the `src` directory. For example, `@/lib/learning-path` means `src/lib/learning-path.ts`.

## App Router vs Pages Router

This app uses the modern App Router, where route files live under `src/app`. Older Next.js tutorials may use the Pages Router under `src/pages`.

The Pages Router is still supported, but it teaches a different mental model: page files map directly to routes, layouts are usually custom components, API routes often live under `pages/api`, and data fetching often uses functions like `getServerSideProps`.

For this reference app, follow only the App Router path. It is the current default in `create-next-app` and is where Server Components, nested layouts, Server Actions, and route segment conventions are taught.

## TypeScript Notes

The TypeScript version adds explicit contracts around the same Next.js concepts:

| Area | Example |
|---|---|
| Lesson data | `Lesson` in `src/lib/learning-path.ts` |
| Component props | `LessonShellProps`, `RootLayoutProps`, `SubmitButtonProps` |
| Dynamic routes | `DynamicLessonPageProps` with async `params` |
| Server data | `Profile`, `Stats`, and `ServerFact` result types |
| SQLite rows | `Note` in `src/lib/notes.ts` |
| Server Actions | `FormData` parameters and `Promise<void>` return types |

TypeScript checks code structure before runtime, but it does not validate user input by itself. The Server Actions still trim and validate `FormData` values before writing to SQLite.

## Start Here

Read the support files first:

1. `src/app/page.tsx`
2. `src/lib/learning-path.ts`
3. `src/components/lesson-shell.tsx`
4. `src/app/layout.tsx`

Then read the lesson route files and their supporting files in this order:

1. `src/app/routes-and-layouts/page.tsx`
2. `src/app/dashboard/layout.tsx`
3. `src/app/dashboard/page.tsx`
4. `src/app/dashboard/activity/page.tsx`
5. `src/app/dashboard/settings/page.tsx`
6. `src/app/lessons/[slug]/page.tsx`
7. `src/app/server-components/page.tsx`
8. `src/app/client-islands/page.tsx`
9. `src/app/client-islands/counter.tsx`
10. `src/app/data-fetching/page.tsx`
11. `src/app/database/page.tsx`
12. `src/app/database/actions.ts`
13. `src/lib/notes.ts`
14. `src/app/database/submit-button.tsx`
15. `src/app/streaming/page.tsx`

The live app mirrors the numbered lesson order from `src/lib/learning-path.ts`. Some lessons have extra support files; comments inside those lesson files guide the support-file reading order.

## Code Map

| Path | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout, metadata, fonts, and global document shell. |
| `src/app/page.tsx` | Home route and first reading entry point. Server Component by default. |
| `src/lib/learning-path.ts` | Canonical lesson order used by the home page and lesson shell. |
| `src/components/lesson-shell.tsx` | Shared Server Component wrapper for lesson pages. |
| `src/app/routes-and-layouts/page.tsx` | File-system routing and layout explanation. |
| `src/app/dashboard/layout.tsx` | Nested dashboard layout shared by dashboard child pages. |
| `src/app/dashboard/page.tsx` | Dashboard overview child page rendered inside the nested layout. |
| `src/app/dashboard/activity/page.tsx` | Dashboard activity child page rendered inside the nested layout. |
| `src/app/dashboard/settings/page.tsx` | Dashboard settings child page rendered inside the nested layout. |
| `src/app/lessons/[slug]/page.tsx` | Dynamic route example using typed async `params` and `generateStaticParams`. |
| `src/app/server-components/page.tsx` | Server Component example with typed server-only data creation. |
| `src/app/client-islands/page.tsx` | Server page that imports a small Client Component island. |
| `src/app/client-islands/counter.tsx` | Client Component with `"use client"`, state, and event handling. |
| `src/app/data-fetching/page.tsx` | Async Server Component that runs independent typed data work in parallel. |
| `src/app/database/page.tsx` | SQLite-backed page that reads local notes on the server. |
| `src/app/database/actions.ts` | Typed Server Actions that mutate SQLite and call `revalidatePath`. |
| `src/app/database/submit-button.tsx` | Client Component using `useFormStatus` for pending form UI. |
| `src/lib/notes.ts` | Server-only local SQLite access through `better-sqlite3`. |
| `src/app/streaming/page.tsx` | Suspense example for streaming slower server-rendered UI. |
| `next.config.mjs` | Keeps `better-sqlite3` external to the server bundle. |

## Concepts

| Lesson | Concept |
|---|---|
| App Router Entry | Next owns app bootstrap; routes are files in `src/app`. |
| Routes and Layouts | Folders create URLs; `layout.tsx` wraps pages. |
| Nested Layouts | Segment-level layouts wrap only their child route subtree. |
| Dynamic Routes | `[slug]` folders render many URLs from one page file. |
| Server Components | App Router components run on the server unless marked otherwise. |
| Client Islands | Add `"use client"` only where browser interactivity is needed. |
| Server Data Fetching | Start independent promises before awaiting to avoid waterfalls. |
| Server Actions and SQLite | Mutate server data from forms without a client API route. |
| Streaming and Suspense | Use Suspense boundaries to stream slow UI separately. |

## Notes

- Keep SQLite access inside server-only files. Do not import `src/lib/notes.ts` into Client Components.
- Prefer Server Components until a component needs browser state, effects, refs, or event handlers.
- Keep Client Components small so the app sends less JavaScript to the browser.
- For mutations, validate `FormData` on the server and call `revalidatePath` when the current route should refresh.
