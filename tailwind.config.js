/** @type {import('tailwindcss').Config} */

// Semantic colors are driven by CSS custom properties (see src/app.css) holding
// space-separated RGB channels, so Tailwind opacity modifiers (e.g. bg-accent/60)
// keep working AND every token flips automatically under the `.dark` class.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte}'],
  theme: {
    extend: {
      colors: {
        // Canvas + surfaces (Chakra UI gray/zinc scale)
        canvas: token('canvas'),
        'canvas-deep': token('canvas-deep'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        'line-strong': token('line-strong'),
        // Foreground text (Chakra fg / fg.muted / fg.subtle)
        ink: token('ink'),
        'ink-soft': token('ink-soft'),
        'ink-faint': token('ink-faint'),
        // Interactive / brand accent (Chakra teal)
        accent: token('accent'),
        'accent-soft': token('accent-soft'),
        'accent-deep': token('accent-deep'),
        'on-accent': token('on-accent'),
        // Amber callout
        amber: token('amber'),
        'amber-soft': token('amber-soft'),
        'amber-ink': token('amber-ink'),
        // Success green (成立)
        success: token('success'),
        'success-soft': token('success-soft'),
        'success-ink': token('success-ink'),
        // Heat tints (cards sitting too long)
        'heat-warm': token('heat-warm'),
        'heat-hot': token('heat-hot')
      },
      fontFamily: {
        // Chakra v3 body/heading font is Inter; JP fonts inserted for this app,
        // then Chakra's exact fallback stack.
        sans: [
          'Inter',
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"'
        ]
      },
      borderRadius: {
        // Chakra semantic radii: l1 = 0.25rem (badges), l2 = 0.375rem (controls),
        // l3 = 0.5rem (cards/menus/dialogs). `card` drives every card/menu surface.
        badge: '0.25rem',
        control: '0.375rem',
        card: '0.5rem',
        pill: '9999px'
      },
      boxShadow: {
        // Chakra semantic shadows (gray.900 = #18181b = rgb(24 24 27))
        card: '0px 1px 2px rgba(24,24,27,0.10), 0px 0px 1px rgba(24,24,27,0.20)', // xs
        'card-hover': '0px 4px 8px rgba(24,24,27,0.10), 0px 0px 1px rgba(24,24,27,0.30)', // md
        drawer: '0px 8px 16px rgba(24,24,27,0.10), 0px 0px 1px rgba(24,24,27,0.30)' // lg
      }
    }
  },
  plugins: []
};
