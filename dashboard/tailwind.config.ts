import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f172a',
          raised: '#1e293b',
          overlay: '#334155',
        },
        category: {
          income: '#22C55E',
          housing: '#8B5CF6',
          food: '#F59E0B',
          transport: '#3B82F6',
          health: '#EF4444',
          utilities: '#06B6D4',
          entertainment: '#EC4899',
          shopping: '#F97316',
          travel: '#14B8A6',
          education: '#6366F1',
          financial: '#64748B',
          investments: '#10B981',
          transfers: '#94A3B8',
          uncategorised: '#9CA3AF',
        },
      },
    },
  },
  plugins: [],
};

export default config;
