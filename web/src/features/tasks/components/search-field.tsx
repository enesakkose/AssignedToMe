"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Kbd } from "@/components/ui/kbd";

const DEBOUNCE_MS = 250;

/** Search as you type, kept in the URL (`q`). "/" focuses it from anywhere on the page. */
export function SearchField({
  label,
  clearLabel,
  initial,
}: {
  label: string;
  clearLabel: string;
  initial: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [filled, setFilled] = useState(initial !== "");

  const commit = (value: string) => {
    const next = new URLSearchParams(search.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    startTransition(() =>
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false }),
    );
  };

  // The URL changed from elsewhere (a "clear" link): follow it, unless the person is typing.
  useEffect(() => {
    const el = input.current;
    if (el && document.activeElement !== el) {
      el.value = initial;
      setFilled(initial !== "");
    }
  }, [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.key !== "/" ||
        e.metaKey ||
        e.ctrlKey ||
        target.closest("input, textarea, [contenteditable]")
      )
        return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full sm:w-64">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        ref={input}
        type="search"
        name="q"
        defaultValue={initial}
        placeholder={label}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setFilled(e.target.value !== "");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(e.target.value), DEBOUNCE_MS);
        }}
        className="h-[var(--control-sm)] w-full rounded-control border border-edge bg-paper pr-9 pl-9 text-md text-ink transition-colors duration-[var(--dur-micro)] placeholder:text-muted hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-0 [&::-webkit-search-cancel-button]:hidden"
      />
      {!filled && (
        <Kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 pointer-coarse:hidden"
        >
          /
        </Kbd>
      )}
      {filled && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            if (input.current) input.current.value = "";
            setFilled(false);
            commit("");
            input.current?.focus();
          }}
          className="absolute top-1/2 right-1 grid size-[var(--control-sm)] -translate-y-1/2 place-items-center rounded-full text-muted transition-colors duration-[var(--dur-micro)] hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
