import { useState, useEffect, useCallback } from "react";
import { GameCanvas } from "./components/GameCanvas";
import type { AIDifficulty } from "./game/players/AIPlayerController";
import type { MatchStats } from "./game/engine/gameEngine";
import type { ZenQuestionDifficulty } from "./game/logic/questions";

type ScreenState = "MENU" | "PLAYING" | "RESULTS";

const DIFFICULTIES: { id: AIDifficulty; label: string; color: string; blurb: string }[] = [
  { id: "easy", label: "EASY", color: "#3ddc84", blurb: "1.8–3.2s · 85%" },
  { id: "medium", label: "MEDIUM", color: "#36d3ff", blurb: "1.2–2.2s · 92%" },
  { id: "hard", label: "HARD", color: "#ff5c8a", blurb: "0.8–1.5s · 97%" },
  { id: "impossible", label: "IMPOSSIBLE", color: "#a26bff", blurb: "0.45–0.9s · 99%" },
];

const ZEN_DIFFICULTIES: { id: ZenQuestionDifficulty; label: string; color: string; blurb: string }[] = [
  { id: "easy", label: "EASY", color: "#3ddc84", blurb: "Add/Sub (Tiers 1–2)" },
  { id: "medium", label: "MEDIUM", color: "#36d3ff", blurb: "Int. Math (Tiers 3–4)" },
  { id: "hard", label: "HARD", color: "#ff5c8a", blurb: "Advanced (Tier 5)" },
  { id: "impossible", label: "IMPOSSIBLE", color: "#ff3040", blurb: "Extreme (Tier 6)" },
  { id: "progressive", label: "PROGRESSIVE", color: "#a26bff", blurb: "Ramps up over time" },
  { id: "random", label: "RANDOM", color: "#ffd24a", blurb: "Wild mix of all tiers" },
];

function App() {
  const [screen, setScreen] = useState<ScreenState>("MENU");
  const [seed, setSeed] = useState<number>(() => Math.floor(100000000 + Math.random() * 900000000));
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const [gameMode, setGameMode] = useState<"versus" | "zen">("versus");
  const [zenDifficulty, setZenDifficulty] = useState<ZenQuestionDifficulty>("progressive");
  const [zenDurationMode, setZenDurationMode] = useState<"free" | 15 | 30 | 60 | 120 | "custom">("free");
  const [customZenDuration, setCustomZenDuration] = useState<string>("30");
  const [winner, setWinner] = useState<"player" | "opponent" | null>(null);
  const [stats, setStats] = useState<MatchStats | null>(null);

  const generateRandomSeed = useCallback(() => {
    setSeed(Math.floor(100000000 + Math.random() * 900000000));
  }, []);

  const handleGameOver = useCallback((matchWinner: "player" | "opponent", matchStats: MatchStats) => {
    setWinner(matchWinner);
    setStats(matchStats);
    setScreen("RESULTS");
  }, []);

  // Global keyboard shortcuts per screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen === "MENU") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setScreen("PLAYING");
        }
      } else if (screen === "RESULTS") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setScreen("PLAYING");
        } else if (e.key === "Escape") {
          e.preventDefault();
          setScreen("MENU");
        }
      } else if (screen === "PLAYING") {
        // Handled capturing inside GameCanvas capture keydown, but fallback
        if (e.key === "Escape") {
          e.preventDefault();
          if (confirm("Quit the current match?")) setScreen("MENU");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  return (
    <div className="bg-grid scanlines min-h-screen flex flex-col items-center justify-center p-6">
      <main className="w-full max-w-5xl z-10 flex flex-col items-center justify-center">
        {screen === "MENU" && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-fade-in">
            {/* Title */}
            <div className="text-center animate-float">
              <h1 className="animate-title-glow font-display font-bold text-8xl md:text-7xl tracking-tight leading-none">
                <span className="text-tetr-cyan">CAL</span>
                <span className="text-tetr-text">TRIS</span>
              </h1>

            </div>

            {/* Panel */}
            <div className="panel w-full p-6 md:p-8 flex flex-col gap-6">
              {/* Tab Selector */}
              <div className="flex border-b border-tetr-edge mb-2">
                <button
                  onClick={() => setGameMode("versus")}
                  className="flex-1 py-3 text-xs font-display font-bold tracking-widest uppercase transition-all"
                  style={{
                    color: gameMode === "versus" ? "var(--accent-cyan)" : "#5a6280",
                    borderBottom: gameMode === "versus" ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                    background: gameMode === "versus" ? "rgba(54, 211, 255, 0.05)" : "transparent",
                  }}
                >
                  Versus Arena
                </button>
                <button
                  onClick={() => setGameMode("zen")}
                  className="flex-1 py-3 text-xs font-display font-bold tracking-widest uppercase transition-all"
                  style={{
                    color: gameMode === "zen" ? "var(--accent-cyan)" : "#5a6280",
                    borderBottom: gameMode === "zen" ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                    background: gameMode === "zen" ? "rgba(54, 211, 255, 0.05)" : "transparent",
                  }}
                >
                  Zen Practice
                </button>
              </div>

              {/* Seed */}
              <div className="flex flex-col gap-2">
                <label className="font-display text-[11px] text-tetr-muted uppercase tracking-[0.2em]">
                  Match Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)}
                    className="input-field flex-1 px-4 py-3 text-lg"
                  />
                  <button onClick={generateRandomSeed} className="btn-ghost px-4 text-xs whitespace-nowrap">
                    RANDOM
                  </button>
                </div>
              </div>

              {gameMode === "versus" ? (
                <>
                  {/* Versus Difficulty */}
                  <div className="flex flex-col gap-2">
                    <label className="font-display text-[11px] text-tetr-muted uppercase tracking-[0.2em]">
                      Opponent
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {DIFFICULTIES.map((d) => {
                        const active = difficulty === d.id;
                        return (
                          <button
                            key={d.id}
                            data-active={active}
                            onClick={() => setDifficulty(d.id)}
                            className="seg-btn flex flex-col items-center gap-1"
                            style={
                              active
                                ? {
                                  color: d.color,
                                  borderColor: d.color,
                                  background: `color-mix(in srgb, ${d.color} 14%, #10131f)`,
                                  boxShadow: `0 8px 22px color-mix(in srgb, ${d.color} 30%, transparent)`,
                                }
                                : undefined
                            }
                          >
                            <span className="text-xs">{d.label}</span>
                            <span
                              className="font-mono text-[9px] tracking-normal opacity-70"
                              style={active ? { color: d.color } : { color: "#5a6280" }}
                            >
                              {d.blurb}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Versus Rules */}
                  <div className="rounded-xl border border-tetr-edge bg-tetr-panel2/70 p-4 font-mono text-[11px] text-tetr-muted space-y-1.5">
                    <div className="font-display text-tetr-cyan font-bold tracking-widest text-xs mb-1">
                      HOW IT WORKS
                    </div>
                    <p>▸ Solve equations to charge <span className="text-tetr-cyan">PROGRESS</span>.</p>
                    <p>▸ Fill 10 to fire an <span className="text-tetr-warn">ATTACK</span> at the enemy well.</p>
                    <p>▸ Press <span className="text-green-400 font-bold">[SPACE]</span> to <span className="text-green-400">DISRUPT</span> — spend 3+ progress to reduce the enemy's progress.</p>
                    <p>▸ Attacks stack <span className="text-tetr-danger">GARBAGE</span> — counter-attack to cancel it.</p>
                    <p>▸ Overflow your well past the top and you <span className="text-tetr-danger font-bold">TOP OUT</span>.</p>
                  </div>

                  <button onClick={() => setScreen("PLAYING")} className="btn-primary w-full py-4 text-sm">
                    ENTER ARENA · [SPACE]
                  </button>
                </>
              ) : (
                <>
                  {/* Zen Difficulty */}
                  <div className="flex flex-col gap-2">
                    <label className="font-display text-[11px] text-tetr-muted uppercase tracking-[0.2em]">
                      Question difficulty
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ZEN_DIFFICULTIES.map((d) => {
                        const active = zenDifficulty === d.id;
                        return (
                          <button
                            key={d.id}
                            data-active={active}
                            onClick={() => setZenDifficulty(d.id)}
                            className="seg-btn flex flex-col items-center gap-1"
                            style={
                              active
                                ? {
                                  color: d.color,
                                  borderColor: d.color,
                                  background: `color-mix(in srgb, ${d.color} 14%, #10131f)`,
                                  boxShadow: `0 8px 22px color-mix(in srgb, ${d.color} 30%, transparent)`,
                                }
                                : undefined
                            }
                          >
                            <span className="text-xs">{d.label}</span>
                            <span
                              className="font-mono text-[9px] tracking-normal opacity-70 text-center"
                              style={active ? { color: d.color } : { color: "#5a6280" }}
                            >
                              {d.blurb}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Zen Duration */}
                  <div className="flex flex-col gap-2">
                    <label className="font-display text-[11px] text-tetr-muted uppercase tracking-[0.2em]">
                      Practice duration
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["free", 15, 30, 60, 120, "custom"] as const).map((mode) => {
                        const active = zenDurationMode === mode;
                        const label = mode === "free" ? "FREE" : mode === "custom" ? "CUSTOM" : `${mode}s`;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setZenDurationMode(mode)}
                            className="seg-btn flex-1 min-w-[70px] py-2 text-center transition-all"
                            style={
                              active
                                ? {
                                  color: "var(--accent-cyan)",
                                  borderColor: "var(--accent-cyan)",
                                  background: "rgba(54, 211, 255, 0.08)",
                                  boxShadow: "0 4px 12px rgba(54, 211, 255, 0.15)",
                                }
                                : undefined
                            }
                          >
                            <span className="text-xs font-bold tracking-wider">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {zenDurationMode === "custom" && (
                      <div className="flex items-center gap-3 mt-1.5 animate-fade-in">
                        <span className="font-mono text-[10px] text-tetr-muted uppercase tracking-widest">
                          Seconds:
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="3600"
                          value={customZenDuration}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^[0-9]+$/.test(val)) {
                              setCustomZenDuration(val);
                            }
                          }}
                          className="input-field py-1.5 px-3 text-xs font-mono tracking-widest text-center w-24"
                          style={{
                            borderColor: "var(--accent-cyan)",
                            boxShadow: "0 0 10px rgba(54, 211, 255, 0.1)",
                          }}
                          placeholder="30"
                        />
                      </div>
                    )}
                  </div>

                  {/* Zen Rules */}
                  <div className="rounded-xl border border-tetr-edge bg-tetr-panel2/70 p-4 font-mono text-[11px] text-tetr-muted space-y-1.5">
                    <div className="font-display text-tetr-cyan font-bold tracking-widest text-xs mb-1">
                      PRACTICE MODE
                    </div>
                    <p>▸ Perfect your speed-math skills in an endless environment.</p>
                    <p>▸ No opponent, no garbage, no time limits, and no topping out.</p>
                    <p>▸ Tracks real-time statistics: <span className="text-tetr-cyan font-bold">Solves per second (SPS)</span> and <span className="text-tetr-pink font-bold">Solves per minute (SPM)</span>.</p>
                    <p>▸ Tap <span className="text-tetr-danger font-bold">[ESC]</span> or click QUIT at any time to complete your session and view metrics.</p>
                  </div>

                  <button onClick={() => setScreen("PLAYING")} className="btn-primary w-full py-4 text-sm" style={{ borderColor: "var(--accent-cyan)", boxShadow: "0 8px 28px rgba(54, 211, 255, 0.25)" }}>
                    START PRACTICE · [SPACE]
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {screen === "PLAYING" && (() => {
          let zenDurationLimit = 0;
          if (zenDurationMode === "custom") {
            zenDurationLimit = Math.max(1, parseInt(customZenDuration, 10) || 30);
          } else if (typeof zenDurationMode === "number") {
            zenDurationLimit = zenDurationMode;
          }
          return (
            <GameCanvas
              seed={seed}
              difficulty={difficulty}
              onGameOver={handleGameOver}
              onExit={() => setScreen("MENU")}
              gameMode={gameMode}
              zenDifficulty={zenDifficulty}
              zenDurationLimit={zenDurationLimit}
            />
          );
        })()}

        {screen === "RESULTS" && stats && (
          <div className="w-full max-w-xl flex flex-col items-center gap-6 animate-fade-in">
            <div className="text-center animate-pop-in">
              <div className="font-mono text-[11px] tracking-[0.5em] text-tetr-muted uppercase mb-2">
                {stats.isZen ? "Practice Concluded" : "Match Concluded"}
              </div>
              <h2
                className="font-display font-bold text-6xl md:text-7xl tracking-[0.15em] leading-none"
                style={{
                  color: stats.isZen ? "#36d3ff" : (winner === "player" ? "#36d3ff" : "#ff5c8a"),
                  filter: `drop-shadow(0 0 24px ${stats.isZen ? "rgba(54,211,255,0.5)" : (winner === "player" ? "rgba(54,211,255,0.5)" : "rgba(255,92,138,0.5)")})`,
                }}
              >
                {stats.isZen ? "SESSION END" : (winner === "player" ? "VICTORY" : "DEFEAT")}
              </h2>
            </div>

            <div className="panel w-full p-6 md:p-8 flex flex-col gap-6">
              {stats.isZen ? (
                <div className="rounded-xl border border-tetr-edge bg-tetr-panel2/60 p-6 flex flex-col gap-4 w-full">
                  <div className="font-display font-bold text-xs uppercase tracking-widest pb-2 border-b border-tetr-edge text-tetr-cyan">
                    PRACTICE PERFORMANCE REPORT
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="font-mono text-[10px] text-tetr-dim uppercase tracking-widest">Equations Solved</div>
                      <div className="font-display font-bold text-4xl text-tetr-text mt-1">{stats.playerSolved}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-tetr-dim uppercase tracking-widest">Accuracy</div>
                      <div className="font-display font-bold text-4xl text-tetr-text mt-1">{stats.playerAccuracy}%</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-tetr-dim uppercase tracking-widest">Solves / Second (SPS)</div>
                      <div className="font-display font-bold text-4xl text-tetr-warn mt-1">{stats.sps}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-tetr-dim uppercase tracking-widest">Solves / Minute (SPM)</div>
                      <div className="font-display font-bold text-4xl text-tetr-pink mt-1">{stats.spm}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <StatColumn title="YOU" accent="#36d3ff" solved={stats.playerSolved} acc={stats.playerAccuracy} />
                  <StatColumn
                    title={`CPU · ${stats.difficulty.toUpperCase()}`}
                    accent="#ff5c8a"
                    solved={stats.opponentSolved}
                    acc={stats.opponentAccuracy}
                  />
                </div>
              )}

              <div className="rounded-xl border border-tetr-edge bg-tetr-panel2/40 p-4 font-mono text-xs space-y-2">
                <Row label="DURATION" value={`${stats.matchTimeSec}s`} valueClass="text-tetr-text" />
                <Row label="SEED" value={`${stats.seed}`} valueClass="text-tetr-warn" />
                {stats.isZen ? (
                  <Row label="ZEN DIFFICULTY" value={(stats.zenDifficulty || "progressive").toUpperCase()} valueClass="text-tetr-cyan" />
                ) : (
                  <Row label="MATCH DIFFICULTY" value={stats.difficulty.toUpperCase()} valueClass="text-tetr-pink" />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={() => setScreen("PLAYING")} className="btn-primary py-3 text-xs">
                  REPLAY SEED · [ENTER]
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      generateRandomSeed();
                      setScreen("PLAYING");
                    }}
                    className="btn-ghost py-3 text-xs"
                    style={{ borderColor: "#a26bff", color: "#c6a6ff" }}
                  >
                    NEW SEED
                  </button>
                  <button onClick={() => setScreen("MENU")} className="btn-ghost py-3 text-xs">
                    MENU · [ESC]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatColumn({
  title,
  accent,
  solved,
  acc,
}: {
  title: string;
  accent: string;
  solved: number;
  acc: string;
}) {
  return (
    <div className="rounded-xl border border-tetr-edge bg-tetr-panel2/60 p-4 flex flex-col gap-3">
      <div
        className="font-display font-bold text-xs uppercase tracking-widest pb-2 border-b border-tetr-edge"
        style={{ color: accent }}
      >
        {title}
      </div>
      <div>
        <div className="font-mono text-[10px] text-tetr-dim uppercase tracking-widest">Solved</div>
        <div className="font-display font-bold text-3xl text-tetr-text">{solved}</div>
      </div>
      <div>
        <div className="font-mono text-[10px] text-tetr-dim uppercase tracking-widest">Accuracy</div>
        <div className="font-display font-bold text-3xl text-tetr-text">{acc}%</div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-tetr-dim tracking-widest">{label}</span>
      <span className={`font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

export default App;
