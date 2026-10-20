/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./app.js"],
  theme: {
    extend: {
      fontFamily: {
        cinema: ['"DM Mono"', "monospace"],
        display: ['"Bebas Neue"', "system-ui"],
      },
      colors: {
        cinema: {
          white: "#FAFAFA",
          "off-white": "#E8E8E8",
          gray: "#888888",
          "dark-gray": "#333333",
          black: "#0A0A0A",
        },
      },
      boxShadow: {
        cinema: "0 8px 32px rgba(0,0,0,0.8)",
      },
      keyframes: {
        borderPulse: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.05)" },
        },
        voicePulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        ripple: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(1.3)", opacity: "0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        celebrateZoom: {
          "0%": { transform: "scale(0) rotate(-10deg)", opacity: "0" },
          "50%": { transform: "scale(1.2) rotate(5deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "0" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        borderPulse: "borderPulse 0.6s ease-out",
        voicePulse: "voicePulse 2s infinite",
        ripple: "ripple 2s infinite",
        blink: "blink 1.5s infinite",
        slideIn: "slideIn 0.4s ease-out",
        celebrateZoom: "celebrateZoom 1s ease-out",
        fadeOut: "fadeOut 1s ease-out forwards",
      },
    },
  },
};
