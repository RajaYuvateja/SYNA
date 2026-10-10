import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        syna: {
          bg: "#E8EDF2",
          surface: "#E8EDF2",
          surfaceAlt: "#DFE5EC",
          blue: "#2563EB",
          blueDark: "#1E40AF",
          blueLight: "#DBEAFE",
          text: "#172033",
          muted: "#5B6575",
          success: "#16805B",
          successLight: "#DCFCE7",
          warning: "#B7791F",
          warningLight: "#FEF3C7",
          danger: "#C24141",
          dangerLight: "#FEE2E2",
          border: "rgba(255, 255, 255, 0.65)",
        },
      },
      boxShadow: {
        "neu-raised": "10px 10px 20px rgba(163, 177, 198, 0.45), -10px -10px 20px rgba(255, 255, 255, 0.9)",
        "neu-raised-sm": "5px 5px 12px rgba(163, 177, 198, 0.35), -5px -5px 12px rgba(255, 255, 255, 0.85)",
        "neu-raised-lg": "16px 16px 32px rgba(163, 177, 198, 0.5), -16px -16px 32px rgba(255, 255, 255, 0.95)",
        "neu-pressed": "inset 6px 6px 12px rgba(163, 177, 198, 0.35), inset -6px -6px 12px rgba(255, 255, 255, 0.8)",
        "neu-pressed-sm": "inset 3px 3px 8px rgba(163, 177, 198, 0.3), inset -3px -3px 8px rgba(255, 255, 255, 0.75)",
        "neu-btn": "6px 6px 14px rgba(163, 177, 198, 0.4), -6px -6px 14px rgba(255, 255, 255, 0.85)",
        "neu-btn-pressed": "inset 4px 4px 8px rgba(163, 177, 198, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.85)",
        "neu-blue": "6px 6px 16px rgba(37, 99, 235, 0.35), -6px -6px 16px rgba(255, 255, 255, 0.8)",
      },
      borderRadius: {
        "neu-sm": "14px",
        "neu": "18px",
        "neu-lg": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
