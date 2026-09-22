"use server";

// Server Actions run on the server even though a form in the browser can submit
// to them. Next serializes the form submission, calls this function on the
// server, then lets us revalidate the route that should show fresh data.
// Next file to read: src/lib/notes.ts.

import { revalidatePath } from "next/cache";
import { insertNote, removeNote } from "@/lib/notes";

export async function createNote(formData: FormData): Promise<void> {
  // FormData values can be strings, files, or null. Convert the body to a string,
  // default missing values to "", and trim whitespace before saving.
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    return;
  }

  // Keep the demo database small. TypeScript checks that insertNote receives a string,
  // but runtime validation still happens here because users control FormData.
  insertNote(body.slice(0, 200));

  // Promise<void> means this action does not return data to the page. It mutates
  // server state, then asks Next to render /database again with fresh notes.
  revalidatePath("/database");
}

export async function deleteNote(formData: FormData): Promise<void> {
  // Hidden form inputs also arrive as FormData. Convert the id and validate it
  // before passing it to the database helper.
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id)) {
    return;
  }

  removeNote(id);
  revalidatePath("/database");
}
