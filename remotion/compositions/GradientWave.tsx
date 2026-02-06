import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TransitionProps, COLOR_SCHEMES } from "./schema";

export const GradientWave: React.FC<TransitionProps> = ({
  title,
  subtitle,
  colorScheme,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const colors = COLOR_SCHEMES[colorScheme];

  // 波浪层数
  const WAVE_COUNT = 5;

  // 生成波浪路径（SVG path）
  const waves = useMemo(() => {
    return Array.from({ length: WAVE_COUNT }, (_, i) => ({
      amplitude: 30 + i * 12,
      frequency: 0.003 + i * 0.001,
      speed: 0.06 + i * 0.02,
      yBase: height * 0.55 + i * 35,
      opacity: 0.15 + (WAVE_COUNT - i) * 0.08,
    }));
  }, [height]);

  // 标题弹入
  const titleScale = spring({ frame: frame - 18, fps, config: { damping: 10, mass: 0.6 } });
  const titleOpacity = interpolate(frame, [15, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 副标题
  const subOpacity = interpolate(frame, [32, 48], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [32, 48], [25, 0], {
    extrapolateRight: "clamp",
  });

  // 背景渐变旋转
  const gradAngle = interpolate(frame, [0, 90], [0, 360], {
    extrapolateRight: "clamp",
  });

  // 顶部光晕
  const topGlow = interpolate(frame, [0, 20, 60, 85], [0, 0.6, 0.4, 0], {
    extrapolateRight: "clamp",
  });

  // 全局淡出
  const fadeOut = interpolate(frame, [72, 90], [1, 0], {
    extrapolateRight: "clamp",
  });

  // 浮动圆形装饰
  const circles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      x: 10 + (i * 13) % 80,
      y: 15 + (i * 17) % 65,
      r: 40 + (i * 23) % 80,
      phase: i * 0.8,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      {/* 旋转渐变背景 */}
      <div
        style={{
          position: "absolute",
          inset: "-50%",
          background: `conic-gradient(from ${gradAngle}deg at 50% 50%, ${colors.primary}11, ${colors.secondary}11, ${colors.bg}, ${colors.primary}11)`,
        }}
      />

      {/* 浮动装饰圆 */}
      {circles.map((c, i) => {
        const floatY = Math.sin(frame * 0.04 + c.phase) * 15;
        const circOp = interpolate(frame, [5 + i * 3, 20 + i * 3], [0, 0.08], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: c.r,
              height: c.r,
              borderRadius: "50%",
              border: `1px solid ${colors.primary}33`,
              transform: `translateY(${floatY}px)`,
              opacity: circOp,
            }}
          />
        );
      })}

      {/* 波浪层 */}
      <svg
        style={{ position: "absolute", bottom: 0, left: 0 }}
        width={width}
        height={height * 0.55}
        viewBox={`0 0 ${width} ${height * 0.55}`}
      >
        {waves.map((wave, wi) => {
          const points: string[] = [];
          const h = height * 0.55;
          const waveEnter = interpolate(frame, [wi * 4, wi * 4 + 20], [h, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });

          for (let x = 0; x <= width; x += 4) {
            const y =
              waveEnter +
              h * 0.3 -
              wave.amplitude *
                Math.sin(x * wave.frequency + frame * wave.speed + wi);
            points.push(`${x},${y}`);
          }
          points.push(`${width},${h}`);
          points.push(`0,${h}`);

          return (
            <polygon
              key={wi}
              points={points.join(" ")}
              fill={wi % 2 === 0 ? colors.primary : colors.secondary}
              opacity={wave.opacity}
            />
          );
        })}
      </svg>

      {/* 顶部光晕 */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "30%",
          width: "40%",
          height: "60%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.glow}, transparent 70%)`,
          opacity: topGlow,
        }}
      />

      {/* 标题 */}
      <div
        style={{
          position: "absolute",
          top: "32%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${titleScale})`,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            fontFamily: "sans-serif",
            color: "#fff",
            letterSpacing: 4,
            textShadow: `0 0 40px ${colors.glow}, 0 2px 20px rgba(0,0,0,0.5)`,
          }}
        >
          {title}
        </div>
      </div>

      {/* 副标题 */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: `translate(-50%, ${subY}px)`,
          opacity: subOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 400,
            fontFamily: "sans-serif",
            color: colors.primary,
            letterSpacing: 8,
            textShadow: `0 0 15px ${colors.glow}`,
          }}
        >
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
