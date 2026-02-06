import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TransitionProps, COLOR_SCHEMES } from "./schema";

export const NeonText: React.FC<TransitionProps> = ({
  title,
  subtitle,
  colorScheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = COLOR_SCHEMES[colorScheme];

  // 霓虹灯闪烁序列（模拟真实霓虹灯启动）
  const flicker = useMemo(() => {
    const seq = [0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    return seq;
  }, []);

  const flickerIndex = Math.min(Math.floor(frame / 2), flicker.length - 1);
  const isOn = frame >= flicker.length * 2 || flicker[flickerIndex] === 1;
  const textOpacity = isOn ? 1 : 0.05;

  // 发光强度渐增
  const glowIntensity = interpolate(frame, [0, 30, 50], [0, 0.6, 1], {
    extrapolateRight: "clamp",
  });

  // 标题弹入
  const titleSpring = spring({ frame: frame - 5, fps, config: { damping: 15 } });

  // 副标题滑入
  const subOffset = interpolate(frame, [35, 50], [40, 0], {
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 底部扫光线
  const scanX = interpolate(frame, [20, 60], [-100, 110], {
    extrapolateRight: "clamp",
  });

  // 背景呼吸光
  const bgPulse = Math.sin(frame * 0.08) * 0.15 + 0.85;

  // 全局淡出
  const fadeOut = interpolate(frame, [72, 90], [1, 0], {
    extrapolateRight: "clamp",
  });

  const glowSize = 20 + glowIntensity * 40;
  const glowColor = colors.glow;

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      {/* 背景渐变呼吸 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${colors.primary}11, transparent 70%)`,
          opacity: bgPulse * glowIntensity,
        }}
      />

      {/* 水平扫光线 */}
      <div
        style={{
          position: "absolute",
          top: "48%",
          left: `${scanX}%`,
          width: 120,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
          boxShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
          opacity: glowIntensity * 0.7,
        }}
      />

      {/* 标题 - 霓虹灯效果 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -60%) scale(${titleSpring})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            fontFamily: "sans-serif",
            letterSpacing: 8,
            color: isOn ? colors.primary : `${colors.primary}22`,
            opacity: textOpacity,
            textShadow: isOn
              ? `0 0 ${glowSize * 0.5}px ${glowColor},
                 0 0 ${glowSize}px ${glowColor},
                 0 0 ${glowSize * 1.5}px ${glowColor},
                 0 0 ${glowSize * 2.5}px ${colors.primary}44`
              : "none",
            transition: "opacity 0.05s, text-shadow 0.1s",
          }}
        >
          {title}
        </div>
      </div>

      {/* 副标题 */}
      <div
        style={{
          position: "absolute",
          top: "60%",
          left: "50%",
          transform: `translate(-50%, ${subOffset}px)`,
          opacity: subOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 300,
            fontFamily: "sans-serif",
            letterSpacing: 12,
            color: colors.secondary,
            textShadow: `0 0 10px ${colors.secondary}88`,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* 装饰横线 */}
      {[0.42, 0.68].map((top, i) => {
        const lineW = interpolate(
          frame,
          [10 + i * 15, 40 + i * 15],
          [0, 40],
          { extrapolateRight: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${top * 100}%`,
              left: "50%",
              transform: "translateX(-50%)",
              width: `${lineW}%`,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${colors.primary}66, transparent)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
