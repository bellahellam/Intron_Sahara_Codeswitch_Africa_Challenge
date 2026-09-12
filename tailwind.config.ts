import type { Config } from "tailwindcss";

/**
 * §16.3 colour direction. Sourced from a deliberate reading of Kenyan public-health visual
 * language — calm institutional greens and earth neutrals — rather than a generic health-tech
 * blue, and deliberately not MOH-official, because we must not imply an endorsement we do not
 * have.
 *
 * The whole palette is low-saturation for one reason: so that the escalation state, the single
 * loud moment in the product, is unmistakable by contrast rather than by shouting continuously.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1B5E4A", // actions, recording state, brand
          light: "#2E8B6F", // hover, active, meter fill
        },
        // The mother's voice. Earth-toned, warm, and distinguishable from amber warning.
        ochre: "#C77D2E",
        neutral: {
          900: "#1A1A1A",
          700: "#4A4A4A",
          500: "#8A8A8A",
          200: "#E4E4E4",
          50: "#FAFAF8", // off-white ground, never pure white — glare on a phone outdoors
        },
        success: "#2E7D52",
        warning: "#B8860B",
        danger: "#A4262C",
        // Used on exactly one screen in the entire product. Its scarcity is what makes it work.
        escalation: "#7A1620",
      },
      fontFamily: {
        sans: ["Inter", "Source Sans 3", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        // §16.4: read-aloud text is a distinct type role, not a heading. It exists to be spoken
        // from a phone held at arm's length, sometimes in poor light.
        aloud: ["1.125rem", { lineHeight: "1.6", fontWeight: "500" }],
        quote: ["1.125rem", { lineHeight: "1.55", fontWeight: "500" }],
        gloss: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
      },
      keyframes: {
        // §16.6: three animations exist. Nothing else moves.
        pulseHalo: {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.12)" },
        },
        cardIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        escalate: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        // 0.8 Hz = 1.25 s. Its job is legibility across a room, not decoration.
        "pulse-halo": "pulseHalo 1.25s ease-in-out infinite",
        "card-in": "cardIn 180ms ease-out both",
        // 120 ms, no easing, deliberately abrupt. The only animation meant to feel jarring.
        escalate: "escalate 120ms linear both",
      },
    },
  },
  plugins: [],
};

export default config;
