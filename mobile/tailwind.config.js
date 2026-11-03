const { hairlineWidth } = require("nativewind/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          text: "hsl(var(--accent-text))",
          wash: "hsl(var(--accent-wash))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
        },
        // Desktop token names (desktop/DESIGN.md). Note: desktop's text-muted is text-muted-foreground here,
        // because React Native Reusables already uses `muted` for a fill.
        paper: {
          DEFAULT: "hsl(var(--paper))",
          2: "hsl(var(--paper-2))",
          3: "hsl(var(--paper-3))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          2: "hsl(var(--ink-2))",
        },
        rule: {
          DEFAULT: "hsl(var(--rule))",
          2: "hsl(var(--rule-2))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          wash: "hsl(var(--error-wash))",
        },
        success: "hsl(var(--success))",
        progress: "hsl(var(--progress))",
        warning: "hsl(var(--warning))",
        graphite: {
          DEFAULT: "hsl(var(--graphite))",
          ink: "hsl(var(--graphite-ink))",
        },
        track: "hsl(var(--track))",
        thumb: "hsl(var(--thumb))",
        brand: {
          tile: "hsl(var(--brand-tile))",
          mark: "hsl(var(--brand-mark))",
        },
      },
      fontFamily: {
        sans: ["InstrumentSans_400Regular"],
        mono: ["JetBrainsMono_400Regular"],
      },
      // Desktop shapes: pills for buttons and inputs (rounded-full), 10px cards, 8px small panels, 4px chips.
      borderRadius: {
        lg: "var(--radius)",
        md: "8px",
        sm: "4px",
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require("tailwindcss-animate")],
};
