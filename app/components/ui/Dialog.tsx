"use client";

import * as RadixDialog from "@radix-ui/react-dialog";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-40"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        />
        <RadixDialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-6 focus:outline-none"
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <div
            className="rounded-3xl p-6 shadow-xl"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <RadixDialog.Title
              className="text-sm tracking-widest mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {title}
            </RadixDialog.Title>

            {description && (
              <RadixDialog.Description
                id="dialog-description"
                className="text-xs leading-relaxed mb-5"
                style={{ color: "var(--text-muted)" }}
              >
                {description}
              </RadixDialog.Description>
            )}

            {children}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
