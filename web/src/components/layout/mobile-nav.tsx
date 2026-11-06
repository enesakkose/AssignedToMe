"use client";

import { Menu } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/** Below 1024px the sidebar waits behind a menu button, and closes again once a board is picked. */
export function MobileNav({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const query = useSearchParams().toString();
  const [seen, setSeen] = useState(query);
  if (query !== seen) {
    setSeen(query);
    setOpen(false);
  }
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={label}
      trigger={
        <Button variant="ghost" size="icon" aria-label={label} className="-ml-1.5 lg:hidden">
          <Menu />
        </Button>
      }
    >
      {children}
    </Sheet>
  );
}
