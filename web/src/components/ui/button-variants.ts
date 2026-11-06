import { cva } from "class-variance-authority";

// Flat pills: one solid fill, no shadow or edge. Press feedback is a slight scale. Kept apart from button.tsx so server
// components can style a link as a button.
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap select-none",
    "rounded-control font-display font-medium",
    "transition-[scale,background-color,color] duration-[var(--dur-micro)] ease-out active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-45 data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:bg-accent-hover",
        secondary: "bg-paper-3 text-ink hover:bg-rule-2",
        ghost:
          "text-ink-2 hover:bg-paper-3 hover:text-ink data-[popup-open]:bg-paper-3 data-[popup-open]:text-ink",
        outline: "border border-edge text-ink hover:border-muted data-[popup-open]:border-muted",
      },
      size: {
        sm: "h-[var(--control-sm)] px-3 text-sm",
        md: "h-[var(--control-md)] px-4 text-md",
        icon: "size-[var(--control-sm)] p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

/** Shared by every floating panel: grows from its trigger, fades out. */
export const floatingPanelClass = [
  "glass rounded-[12px] border border-rule-2 p-1 shadow-float outline-none",
  "origin-[var(--transform-origin)] transition-[opacity,scale] duration-[var(--dur-micro)] ease-out",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
].join(" ");
