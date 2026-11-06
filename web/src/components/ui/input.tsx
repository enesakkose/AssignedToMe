"use client";

import { Input as BaseInput } from "@base-ui/react/input";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** The desktop input: a pill with a hairline edge; focus draws the accent ring, an invalid field draws it in red. */
export const inputClass = cn(
  "h-[var(--control-md)] w-full min-w-0 rounded-control border border-edge bg-paper px-4 text-md text-ink",
  "placeholder:text-muted/70 transition-[border-color,box-shadow] duration-[var(--dur-micro)] ease-out hover:border-muted",
  "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_18%,transparent)] focus-visible:outline-none",
  "aria-[invalid=true]:border-error disabled:cursor-not-allowed disabled:bg-paper-2 disabled:text-muted",
);

export function Input({ className, ...props }: ComponentProps<typeof BaseInput>) {
  return (
    <BaseInput
      className={cn(inputClass, className)}
      spellCheck={false}
      autoComplete="off"
      {...props}
    />
  );
}

/** A secret field with a reveal toggle. The value stays in the field; it is never echoed anywhere else. */
export function SecretInput({
  className,
  showLabel,
  hideLabel,
  ...props
}: Omit<ComponentProps<typeof BaseInput>, "type"> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  const label = visible ? hideLabel : showLabel;
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11 font-mono", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-1 grid w-9 place-items-center rounded-full text-muted transition-colors duration-[var(--dur-micro)] hover:text-ink"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
