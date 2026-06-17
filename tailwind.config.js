/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ocean: {
          50: "#E6F0FF",
          100: "#C2D9FF",
          200: "#8FB8FF",
          300: "#5C96F5",
          400: "#3E7CE6",
          500: "#2E63C7",
          600: "#1E4BA6",
          700: "#0A2463",
          800: "#081C4F",
          900: "#051429",
          950: "#030B1A",
        },
        marine: {
          cyan: "#3E92CC",
          teal: "#2FB6B0",
          mint: "#4ECDC4",
          sand: "#F4D35E",
          coral: "#F46036",
          rust: "#D62828",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '"Source Sans Pro"', 'system-ui', 'sans-serif'],
        mono: ['"Source Code Pro"', '"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'ocean-gradient': 'linear-gradient(180deg, #051429 0%, #0A2463 50%, #1E4BA6 100%)',
        'ocean-vertical': 'linear-gradient(135deg, #051429 0%, #081C4F 40%, #0A2463 100%)',
        'glass': 'linear-gradient(135deg, rgba(62,146,204,0.08) 0%, rgba(10,36,99,0.12) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'ocean': '0 8px 32px rgba(5, 20, 41, 0.4)',
        'cyan-glow': '0 0 20px rgba(62, 146, 204, 0.3)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
