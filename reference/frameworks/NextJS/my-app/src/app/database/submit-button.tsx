"use client";

// This small Client Component reads form pending state with useFormStatus.
// It stays separate so the database page can remain a Server Component.
// Next file to read: src/app/streaming/page.tsx.

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
};

export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  // useFormStatus reads the status of the nearest parent <form>. Because each
  // database form has its own SubmitButton, create and delete can show separate
  // pending labels.
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
