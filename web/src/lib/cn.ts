import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The project's own type sizes (globals.css), so `text-section` reads as a size and isn't dropped beside a colour.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["md", "title", "display", "section", "lead"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
