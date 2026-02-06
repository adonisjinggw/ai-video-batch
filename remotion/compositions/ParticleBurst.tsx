import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { TransitionProps, COLOR_SCHEMES } from "./schema";

interface Particle {
  angle: number;
  speed: number;
  size: number;
  delay: number;
  color: string;
}

export const ParticleBurst: React.FC<TransitionProps> = ({
  title,
  subtitle,
  colorScheme,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const colors = COLOR_SCHEMES[colorScheme];

  // 生成 80 个粒子
  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < 80; i++) {
      arr.push({
        angle: (i / 80) * Math.PI * 2 + Math.random() * 0.5,
        speed: 3 + Math.random() * 8,
        size: 3 + Math.random() * 8,
        delay: Math.random() * 8,
        color:
          Math.random() > 0.5 ? colors.primary : colors.secondary,
      });
    }
    return arr;
  }, [colors]);

  // 标题弹性出现
  const titleScale = spring({ frame: frame - 15, fps, config: { damping: 12, mass: 0.8 } });
  const titleOpacity = interpolate(frame, [12, 22], [0, 1], { extrapolateRight: "clamp" });

  // 副标题淡入
  const subOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(frame, [30, 45], [20, 0], { extrapolateRight: "clamp" });

  // 中心光晕
  const glowScale = interpolate(frame, [0, 10, 25, 50], [0, 1.5, 0.8, 0.4], {
    extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(frame, [0, 10, 60, 90], [0, 1, 0.5, 0], {
    extrapolateRight: "clamp",
  });

  // 全局淡出
  const fadeOut = interpolate(frame, [70, 90], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      {/* 中心发光 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${glowScale})`,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.glow}, transparent 70%)`,
          opacity: glowOpacity,
        }}
      />

      {/* 粒子 */}
      {particles.map((p, i) => {
        const t = Math.max(0, frame - p.delay);
        const dist = t * p.speed;
        const x = width / 2 + Math.cos(p.angle) * dist;
        const y = height / 2 + Math.sin(p.angle) * dist;
        const opacity = interpolate(t, [0, 5, 40, 60], [0, 1, 0.8, 0], {
          extrapolateRight: "clamp",
        });
        const scale = interpolate(t, [0, 5, 50], [0, 1, 0.3], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              opacity,
              transform: `scale(${scale})`,
            }}
          />
        );
      })}

      {/* 标题 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -60%) scale(${titleScale})`,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#fff",
            textShadow: `0 0 30px ${colors.glow}, 0 0 60px ${colors.glow}`,
            letterSpacing: 4,
            fontFamily: "sans-serif",
          }}
        >
          {title}
        </div>
      </div>

      {/* 副标题 */}
      <div
        style={{
          position: "absolute",
          top: "58%",
          left: "50%",
          transform: `translate(-50%, ${subY}px)`,
          opacity: subOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: colors.primary,
            letterSpacing: 6,
            fontFamily: "sans-serif",
          }}
        >
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
