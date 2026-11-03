import { getFontFamilyForClassName } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText, type Role } from "react-native";

const textVariants = cva(
  cn(
    "text-foreground text-base leading-6 tracking-normal",
    Platform.select({
      web: "select-text",
    }),
  ),
  {
    variants: {
      variant: {
        default: "",
        h1: cn(
          "text-left text-4xl font-bold leading-[1.08]",
          Platform.select({ web: "scroll-m-20 text-balance" }),
        ),
        h2: cn(
          "text-3xl font-bold leading-[1.1]",
          Platform.select({ web: "scroll-m-20 first:mt-0" }),
        ),
        h3: cn("text-2xl font-bold leading-tight", Platform.select({ web: "scroll-m-20" })),
        h4: cn("text-xl font-bold leading-snug", Platform.select({ web: "scroll-m-20" })),
        p: "mt-3 leading-7 sm:mt-5",
        blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
        code: cn(
          "bg-muted relative rounded-sm px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        ),
        lead: "text-muted-foreground text-xl leading-8",
        large: "text-lg font-semibold",
        small: "text-sm font-semibold leading-none",
        muted: "text-muted-foreground text-sm leading-5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps["variant"]>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  blockquote: Platform.select({ web: "blockquote" as Role }),
  code: Platform.select({ web: "code" as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: "1",
  h2: "2",
  h3: "3",
  h4: "4",
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  style,
  variant = "default",
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  const resolvedClassName = cn(textVariants({ variant }), textClass, className);

  return (
    <Component
      className={resolvedClassName}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      style={[{ fontFamily: getFontFamilyForClassName(resolvedClassName) }, style]}
      {...props}
    />
  );
}

export { Text, TextClassContext };
