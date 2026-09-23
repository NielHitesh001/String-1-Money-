import React, { useEffect, useState } from "react";

export const defaultMilestones = [
  { date: "2024-09-01", label: "Initial Ingestion", type: "system", detail: "Baseline corporate registry sync (SEC EDGAR / Companies House)" },
  { date: "2025-01-15", label: "BlackRock-JFS JV", type: "equity", detail: "50:50 Asset Management Joint Venture capital commitment announced" },
  { date: "2025-06-20", label: "EU DMA Audit", type: "regulatory", detail: "Antitrust inquiry launched on app store cross-border billing flows" },
  { date: "2025-11-10", label: "Baltic Route Spike", type: "anomaly", detail: "Volume velocity surge detected across NordEast OÜ corridor" },
  { date: "2026-04-05", label: "New CFO Hired", type: "personnel", detail: "Executive transition announced at Apple Inc." },
  { date: "2026-08-29", label: "Real-time Live", type: "active", detail: "Present network state and live interbank transfer streams" },
];

export default function TimelineSlider({
  startDate = "2024-09-01",
  endDate = "2026-08-29",
  currentDate = "2026-08-29",
  onDateChange,
  milestones = defaultMilestones,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 0.5x, 1x, 2x
  const [activeMilestone, setActiveMilestone] = useState(null);

  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(endDate).getTime();
  const currentTimestamp = new Date(currentDate).getTime();

  // Progress percentage (0 - 100)
  const progressPct = Math.min(
    100,
    Math.max(0, ((currentTimestamp - startTimestamp) / (endTimestamp - startTimestamp)) * 100)
  );

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 150 / playbackSpeed;
    const stepMs = (endTimestamp - startTimestamp) / 80; // 80 steps for 24 months

    const timer = setInterval(() => {
      onDateChange((prevDate) => {
        const nextTime = new Date(prevDate).getTime() + stepMs;
        if (nextTime >= endTimestamp) {
          setIsPlaying(false);
          return endDate;
        }
        return new Date(nextTime).toISOString().split("T")[0];
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, startTimestamp, endTimestamp, endDate, onDateChange]);

  const handleSliderChange = (e) => {
    const pct = Number(e.target.value);
    const newTimestamp = startTimestamp + ((endTimestamp - startTimestamp) * pct) / 100;
    onDateChange(new Date(newTimestamp).toISOString().split("T")[0]);
  };

  const formatDisplayDate = (dString) => {
    try {
      const d = new Date(dString);
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric", day: "numeric" });
    } catch {
      return dString;
    }
  };

  return (
    <div className="timeline-slider-bar">
      <div className="timeline-controls-left">
        <button
          type="button"
          className={`timeline-play-btn ${isPlaying ? "playing" : ""}`}
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? "Pause network animation" : "Play network evolution animation (24 months)"}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play (24 Mo)"}
        </button>

        <div className="timeline-speed-toggles">
          {[0.5, 1, 2].map((spd) => (
            <button
              key={spd}
              type="button"
              className={`speed-chip ${playbackSpeed === spd ? "active" : ""}`}
              onClick={() => setPlaybackSpeed(spd)}
            >
              {spd}x
            </button>
          ))}
        </div>

        <div className="timeline-date-display">
          <small>TEMPORAL SNAPSHOT</small>
          <strong>{formatDisplayDate(currentDate)}</strong>
        </div>
      </div>

      <div className="timeline-track-container">
        <input
          aria-label="Timeline historical date slider"
          type="range"
          min="0"
          max="100"
          step="0.5"
          value={progressPct}
          onChange={handleSliderChange}
          className="timeline-range-input"
        />

        {/* Milestone Pins */}
        <div className="timeline-milestones-layer">
          {milestones.map((m) => {
            const mTime = new Date(m.date).getTime();
            const mPct = ((mTime - startTimestamp) / (endTimestamp - startTimestamp)) * 100;
            const isPassed = mTime <= currentTimestamp;

            return (
              <button
                key={m.date}
                type="button"
                className={`milestone-pin ${m.type} ${isPassed ? "passed" : ""}`}
                style={{ left: `${mPct}%` }}
                onClick={() => onDateChange(m.date)}
                onMouseEnter={() => setActiveMilestone(m)}
                onMouseLeave={() => setActiveMilestone(null)}
                title={`${m.label} (${m.date})`}
              >
                <span className="pin-head"></span>
              </button>
            );
          })}
        </div>

        {/* Milestone Tooltip */}
        {activeMilestone && (
          <div className="milestone-tooltip-card">
            <strong>{activeMilestone.label}</strong>
            <small>{activeMilestone.date} · {activeMilestone.type.toUpperCase()}</small>
            <p>{activeMilestone.detail}</p>
          </div>
        )}
      </div>

      <div className="timeline-meta-right">
        <button
          type="button"
          className="timeline-reset-btn"
          onClick={() => onDateChange(endDate)}
          title="Reset to real-time present state"
        >
          ⚡ Real-time Present
        </button>
      </div>
    </div>
  );
}
