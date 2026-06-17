import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  // Category colours are NOT defined here. Single source of truth:
  //   1. DB `categories.colour` column (primary — joined into queries)
  //   2. lib/chartColors.ts (fallback by name + distinct subcategory palette)
  // These tailwind tokens were unused and have been removed to avoid a third source.
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
