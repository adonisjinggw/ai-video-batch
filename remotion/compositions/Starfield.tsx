import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TransitionProps, COLOR_SCHEMES } from "./schema";

interface Star {
  x: number;      // 起始比例 0~1
  y: number;
  z: number;      // 深度 0~1（远→近）
  size: number;
  bright: number;  // 亮度
}

export const Starfield: React.FC<TransitionProps> = ({
  title,
  subtitle,
  colorScheme,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const colors = COLOR_SCHEMES[colorScheme];

  const STAR_COUNT = 200;

  // 预生成星星
  const stars = useMemo<Star[]>(() => {
    const arr: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      arr.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        size: 1 + Math.random() * 2.5,
        bright: 0.4 + Math.random() * 0.6,
      });
    }
    return arr;
  }, []);

  // 穿越速度：先慢后快再减速
  const speed = interpolate(frame, [0, 20, 55, 75], [0.2, 1.5, 2.5, 0.5], {
    extrapolateRight: "clamp",
  });

  // 中心光晕
  const coreGlow = interpolate(frame, [15, 40, 65, 80], [0, 0.8, 0.6, 0], {
    extrapolateRight: "clamp",
  });

  // 标题
  const titleScale = spring({ frame: frame - 30, fps, config: { damping: 12 } });
  const titleOpacity = interpolate(frame, [28, 38], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 副标题
  const subOpacity = interpolate(frame, [42, 55], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 全局淡出
  const fadeOut = interpolate(frame, [72, 90], [1, 0], {
    extrapolateRight: "clamp",
  });

  // 径向运动模糊强度
  const motionBlur = interpolate(frame, [0, 20, 55, 75], [0, 3, 6, 1], {
    extrapolateRight: "clamp",
  });

  const cx = width / 2;
  const cy = height / 2;

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      {/* 星星 */}
      {stars.map((star, i) => {
        // 每帧向前推进星星（z减小=向观察者靠近）
        const progress = (frame * speed * 0.015 + star.z) % 1;
        const depth = 1 - progress; // 0=近, 1=远

        // 透视投影：越近越偏离中心
        const perspScale = 1 / (depth * 3 + 0.1);
        const sx = cx + (star.x - 0.5) * width * perspScale;
        const sy = cy + (star.y - 0.5) * height * perspScale;

        // 越近越大越亮
        const sz = star.size * (1 + (1 - depth) * 4);
        const opacity = star.bright * interpolate(depth, [0, 0.1, 0.8, 1], [0, 1, 0.4, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // 拖尾（径向方向拉长）
        const dx = sx - cx;
        const dy = sy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const tailLen = Math.min(motionBlur * (1 - depth) * 8, 30);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // 超出画面的跳过
        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: sx,
              top: sy,
              width: sz,
              height: sz + tailLen,
              borderRadius: `${sz / 2}px ${sz / 2}px 0 0`,
              background: `linear-gradient(to bottom, ${colors.primary}, transparent)`,
              boxShadow: depth < 0.4 ? `0 0 ${sz * 2}px ${colors.glow}` : "none",
              opacity,
              transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
            }}
          />
        );
      })}

      {/* 中心光晕 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.glow}, ${colors.primary}22, transparent 70%)`,
          opacity: coreGlow,
        }}
      />

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
            fontFamily: "sans-serif",
            color: "#fff",
            letterSpacing: 6,
            textShadow: `0 0 30px ${colors.glow}, 0 0 60px ${colors.primary}44`,
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
          transform: "translate(-50%, 0)",
          opacity: subOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 300,
            fontFamily: "sans-serif",
            color: colors.primary,
            letterSpacing: 8,
          }}
        >
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
