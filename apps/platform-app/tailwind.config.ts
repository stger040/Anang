import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        anang: {
          teal: { 50: "#f0fdfa", 700: "#0f766e", 800: "#115e59" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
