import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#7C3AED", light: "#8B5CF6", dark: "#6D28D9" },
        accent:  { pink: "#C026D3", rose: "#EF4444" },
        ochre:   "#A8652A",
        success: "#087443",
        warning: "#A8652A",
        danger:  "#B42318",
        escalation: "#9F1C16",
        neutral: {
          900: "#17252D", 700: "#40505A", 500: "#64747B",
          200: "#E7E0F1", 150: "#F0ECF7", 100: "#F8F6FC", 50: "#FCFBFF",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        aloud: ["18px", { lineHeight: "1.65", fontWeight: "500" }],
        quote: ["16px", { lineHeight: "1.55", fontWeight: "500" }],
        gloss: ["13px", { lineHeight: "1.5",  fontWeight: "400" }],
      },
      keyframes: {
        pulseHalo: {
          "0%,100%": { opacity: "0.3",  transform: "scale(1)"    },
          "50%":     { opacity: "0.75", transform: "scale(1.14)" },
        },
        cardIn:   { from: { opacity:"0", transform:"translateY(5px)" }, to: { opacity:"1", transform:"none" } },
        escalate: { from: { opacity:"0" }, to: { opacity:"1" } },
        floatIn:  { from: { opacity:"0", transform:"translateY(10px) scale(.98)" }, to: { opacity:"1", transform:"none" } },
        slideUp:  { from: { opacity:"0", transform:"translateY(8px)" }, to: { opacity:"1", transform:"none" } },
        orbFloat: { "0%,100%": { transform:"translateY(0)" }, "50%": { transform:"translateY(-5px)" } },
        shimmer:  { "0%": { backgroundPosition:"-600px 0" }, "100%": { backgroundPosition:"600px 0" } },
      },
      animation: {
        "pulse-halo": "pulseHalo 1.4s ease-in-out infinite",
        "card-in":    "cardIn   200ms ease both",
        "escalate":   "escalate 120ms linear both",
        "float-in":   "floatIn  300ms ease both",
        "slide-up":   "slideUp  260ms ease both",
        "orb-float":  "orbFloat 5s ease-in-out infinite",
        "shimmer":    "shimmer  1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
