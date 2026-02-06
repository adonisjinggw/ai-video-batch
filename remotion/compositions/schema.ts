import { z } from "zod";

export const TransitionSchema = z.object({
  title: z.string().default("RollRoll"),
  subtitle: z.string().optional().default("AI 视频创作平台"),
  colorScheme: z
    .enum(["gold", "neon", "sunset", "ocean", "galaxy"])
    .default("gold"),
});

export type TransitionProps = z.infer<typeof TransitionSchema>;

export const COLOR_SCHEMES = {
  gold: {
    primary: "#fbbf24",
    secondary: "#f97316",
    bg: "#0a0a0f",
    glow: "rgba(251, 191, 36, 0.6)",
  },
  neon: {
    primary: "#00ff88",
    secondary: "#00aaff",
    bg: "#050510",
    glow: "rgba(0, 255, 136, 0.6)",
  },
  sunset: {
    primary: "#ff6b6b",
    secondary: "#ffa500",
    bg: "#0f0508",
    glow: "rgba(255, 107, 107, 0.6)",
  },
  ocean: {
    primary: "#0ea5e9",
    secondary: "#06b6d4",
    bg: "#020810",
    glow: "rgba(14, 165, 233, 0.6)",
  },
  galaxy: {
    primary: "#a855f7",
    secondary: "#ec4899",
    bg: "#08050f",
    glow: "rgba(168, 85, 247, 0.6)",
  },
};
