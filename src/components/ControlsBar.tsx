"use client";

import { ColorMode } from "@/lib/types";

interface ControlsBarProps {
  tick: number;
  population: number;
  initialPopulation: number;
  running: boolean;
  speed: number;
  colorMode: ColorMode;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onColorModeChange: (mode: ColorMode) => void;
}

export default function ControlsBar({
  tick,
  population,
  initialPopulation,
  running,
  speed,
  colorMode,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
  onColorModeChange,
}: ControlsBarProps) {
  return (
    <div className="controls-bar">
      {/* Playback Controls */}
      <div className="controls-group">
        {running ? (
          <button onClick={onPause} className="control-btn" title="Pause">
            <span className="control-icon">⏸</span>
          </button>
        ) : (
          <button onClick={onPlay} className="control-btn control-btn-play" title="Play">
            <span className="control-icon">▶</span>
          </button>
        )}
        <button onClick={onStep} disabled={running} className="control-btn" title="Step">
          <span className="control-icon">⏭</span>
        </button>
        <button onClick={onReset} className="control-btn" title="Reset">
          <span className="control-icon">🔄</span>
        </button>
      </div>

      {/* Speed Slider */}
      <div className="controls-group">
        <label className="control-label">Speed</label>
        <input
          type="range"
          min={1}
          max={50}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="speed-slider"
        />
        <span className="control-value">{speed}/s</span>
      </div>

      {/* Stats */}
      <div className="controls-group">
        <div className="stat-badge">
          <span className="stat-label">Tick</span>
          <span className="stat-value">{tick}</span>
        </div>
        <div className="stat-badge">
          <span className="stat-label">Alive</span>
          <span className="stat-value">
            {population}/{initialPopulation}
          </span>
        </div>
      </div>

      {/* Color Mode */}
      <div className="controls-group">
        <label className="control-label">Color by</label>
        <div className="color-mode-toggle">
          {(["type", "health", "wealth"] as ColorMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onColorModeChange(mode)}
              className={`color-mode-btn ${
                colorMode === mode ? "color-mode-btn-active" : ""
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
