"use client";

import { ColorMode, Experiment, EXPERIMENT_PRESETS } from "@/lib/types";

interface ControlsBarProps {
  tick: number;
  population: number;
  initialPopulation: number;
  running: boolean;
  speed: number;
  colorMode: ColorMode;
  activeExperiment: Experiment | null;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onColorModeChange: (mode: ColorMode) => void;
  onExperimentChange: (experiment: Experiment | null) => void;
}

export default function ControlsBar({
  tick,
  population,
  initialPopulation,
  running,
  speed,
  colorMode,
  activeExperiment,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
  onColorModeChange,
  onExperimentChange,
}: ControlsBarProps) {
  const handleExperimentSelect = (id: string) => {
    const preset = EXPERIMENT_PRESETS.find((e) => e.id === id) ?? null;
    onExperimentChange(preset);
  };

  // Find next scheduled event for active experiment
  const nextEvent = activeExperiment?.events.find((e) => e.trigger_tick > tick);

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

      {/* Experiment Dropdown */}
      <div className="controls-group">
        <label className="control-label">Experiment</label>
        <select
          className="experiment-select"
          value={activeExperiment?.id ?? "baseline"}
          onChange={(e) => handleExperimentSelect(e.target.value)}
          disabled={running}
          title={activeExperiment?.description ?? "Select an experiment preset"}
        >
          {EXPERIMENT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        {nextEvent && (
          <span className="experiment-next" title={`Next: ${nextEvent.type} at tick ${nextEvent.trigger_tick}`}>
            ⚡{nextEvent.trigger_tick}
          </span>
        )}
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
