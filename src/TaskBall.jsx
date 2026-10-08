import React from "react";

// One material for chamber balls, floor decorations and the drawn prize.
// Base colors follow the original category assets; shadows shape the sphere.
const palettes = {
  work: ["#acdfff", "#8bcfff", "#589fce", "#3d769f"],
  health: ["#b6f5e9", "#99ede1", "#60b7ad", "#40897f"],
  study: ["#fff394", "#ffe967", "#e7b83f", "#b98d29"],
  life: ["#e0bbfa", "#d1a1f1", "#aa79cb", "#8059a0"],
  creative: ["#ffc2e5", "#ffa5d8", "#d979b1", "#a95384"],
};
const colorCategories = { blue: "work", mint: "health", yellow: "study", purple: "life", pink: "creative" };

export default function TaskBall({ category, color, className = "", style, ...props }) {
  const [light, base, shade, dark] = palettes[category || colorCategories[color]] || palettes.work;
  return (
    <span
      {...props}
      className={`task-ball-render ${className}`}
      aria-hidden="true"
      style={{ "--sphere-light": light, "--sphere-base": base, "--sphere-shade": shade, "--sphere-dark": dark, ...style }}
    >
      <span className="task-ball-surface">
        <span className="resin-ball-details">
          <i className="task-ball-dimple dimple-one" />
          <i className="task-ball-dimple dimple-two" />
          <i className="task-ball-dimple dimple-three" />
        </span>
      </span>
    </span>
  );
}
