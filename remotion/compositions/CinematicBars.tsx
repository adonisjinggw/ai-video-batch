import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TransitionProps, COLOR_SCHEMES } from "./schema";

export const CinematicBars: React.FC<TransitionProps> = ({
  title,
  subtitle,
  colorScheme,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const colors = COLOR_SCHEMES[colorScheme];

  // 电影遮幅从全屏收窄到宽银幕比例
  const barH = interpolate(frame, [0, 25], [height / 2, height * 0.12], {
    extrapolateRight: "clamp",
  });

  // 中央光束扫过
  const beamX = interpolate(frame, [8, 35], [-200, width + 200], {
    extrapolateRight: "clamp",
  });
  const beamOpacity = interpolate(frame, [8, 18, 30, 35], [0, 0.8, 0.6, 0], {
    extrapolateRight: "clamp",
  });

  // 标题从底部升起
  const titleY = interpolate(frame, [20, 40], [50, 0], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleScale = spring({ frame: frame - 25, fps, config: { damping: 14 } });

  // 副标题打字机效果
  const subChars = subtitle || "";
  const visibleChars = Math.min(
    subChars.length,
    Math.max(0, Math.floor((frame - 40) * 0.6))
  );
  const subOpacity = interpolate(frame, [40, 48], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 胶片噪点闪烁
  const grainOpacity = interpolate(
    Math.sin(frame * 1.7),
    [-1, 1],
    [0.02, 0.06]
  );

  // 左右装饰线
  const lineW = interpolate(frame, [30, 50], [0, 180], {
    extrapolateRight: "clamp",
  });

  // 全局淡出
  const fadeOut = interpolate(frame, [72, 90], [1, 0], {
    extrapolateRight: "clamp",
  });

  // 底部时间码
  const timecode = `00:00:${String(Math.floor(frame / 30)).padStart(2, "0")}:${String(frame % 30).padStart(2, "0")}`;

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      {/* 背景氛围光 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${colors.bg}, #000)`,
        }}
      />

      {/* 胶片噪点 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
          opacity: grainOpacity,
          mixBlendMode: "overlay",
        }}
      />

      {/* 光束扫过 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: beamX,
          width: 3,
          height: "100%",
          background: `linear-gradient(180deg, transparent 10%, ${colors.primary} 50%, transparent 90%)`,
          boxShadow: `0 0 40px 15px ${colors.glow}`,
          opacity: beamOpacity,
        }}
      />

      {/* 标题区域 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) translateY(${titleY}px) scale(${titleScale})`,
          opacity: titleOpacity,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* 左右装饰线 + 标题 */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: lineW,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${colors.primary})`,
            }}
          />
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              fontFamily: "sans-serif",
              color: "#fff",
              letterSpacing: 6,
              textShadow: `0 0 20px ${colors.glow}`,
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
          <div
            style={{
              width: lineW,
              height: 1,
              background: `linear-gradient(270deg, transparent, ${colors.primary})`,
            }}
          />
        </div>

        {/* 副标题（打字机） */}
        <div
          style={{
            fontSize: 22,
            fontFamily: "monospace",
            color: colors.primary,
            letterSpacing: 4,
            opacity: subOpacity,
            minHeight: 30,
          }}
        >
          {subChars.slice(0, visibleChars)}
          {visibleChars < subChars.length && (
            <span
              style={{
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                color: colors.secondary,
              }}
            >
              ▌
            </span>
          )}
        </div>
      </div>

      {/* 时间码 */}
      <div
        style={{
          position: "absolute",
          bottom: barH + 8,
          right: 40,
          fontSize: 12,
          fontFamily: "monospace",
          color: `${colors.primary}66`,
          letterSpacing: 2,
        }}
      >
        {timecode}
      </div>

      {/* 上遮幅 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: barH,
          background: "#000",
        }}
      />
      {/* 下遮幅 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: barH,
          background: "#000",
        }}
      />
    </AbsoluteFill>
  );
};
