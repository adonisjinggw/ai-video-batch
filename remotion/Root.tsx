import React from "react";
import { Composition } from "remotion";
import { ParticleBurst } from "./compositions/ParticleBurst";
import { NeonText } from "./compositions/NeonText";
import { CinematicBars } from "./compositions/CinematicBars";
import { Starfield } from "./compositions/Starfield";
import { GradientWave } from "./compositions/GradientWave";
import { TransitionSchema } from "./compositions/schema";

export const RemotionRoot: React.FC = () => {
  const defaultProps = {
    title: "RollRoll",
    subtitle: "AI 视频创作平台",
    colorScheme: "gold" as const,
  };

  return (
    <>
      <Composition
        id="ParticleBurst"
        component={ParticleBurst}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        schema={TransitionSchema}
        defaultProps={defaultProps}
      />
      <Composition
        id="NeonText"
        component={NeonText}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        schema={TransitionSchema}
        defaultProps={defaultProps}
      />
      <Composition
        id="CinematicBars"
        component={CinematicBars}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        schema={TransitionSchema}
        defaultProps={defaultProps}
      />
      <Composition
        id="Starfield"
        component={Starfield}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        schema={TransitionSchema}
        defaultProps={defaultProps}
      />
      <Composition
        id="GradientWave"
        component={GradientWave}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
        schema={TransitionSchema}
        defaultProps={defaultProps}
      />
    </>
  );
};
