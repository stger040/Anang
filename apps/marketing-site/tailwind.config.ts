import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          navy: { DEFAULT: "#13264C", dark: "#0B1428", light: "#1e3d6e" },
          coral: { DEFAULT: "#E24E42", hover: "#C63F36" },
          cream: "#F7F5F2",
          sky: "#E8F4FC",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
