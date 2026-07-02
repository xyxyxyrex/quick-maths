import React, { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { GameEngine } from "../game/engine/gameEngine";
import type { GameState, MatchStats } from "../game/engine/gameEngine";
import { GameRenderer } from "../game/ui/gameRenderer";
import type { AIDifficulty } from "../game/players/AIPlayerController";
import type { ZenQuestionDifficulty } from "../game/logic/questions";

interface GameCanvasProps {
  seed: number;
  difficulty: AIDifficulty;
  onGameOver: (winner: "player" | "opponent", stats: MatchStats) => void;
  onExit: () => void;
  gameMode?: "versus" | "zen";
  zenDifficulty?: ZenQuestionDifficulty;
  zenDurationLimit?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  seed,
  difficulty,
  onGameOver,
  onExit,
  gameMode = "versus",
  zenDifficulty = "progressive",
  zenDurationLimit = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Preparing arena…");
  const [history, setHistory] = useState<{ id: string; text: string; answer: string; correct: boolean }[]>([]);

  const [, setEngineState] = useState<GameState>("COUNTDOWN");
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setHistory([]);

    let app: Application | null = null;
    let engine: GameEngine | null = null;
    let renderer: GameRenderer | null = null;
    let isDestroyed = false;
    let isInitialized = false;

    const initPixi = async () => {
      try {
        if (isDestroyed) return;
        setLoadingStatus("Booting render engine…");
        setLoadingProgress(20);

        const tempApp = new Application();
        await tempApp.init({
          width: 1200,
          height: 760,
          background: "#0b0d15",
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        if (isDestroyed) {
          tempApp.destroy(true, { children: true });
          return;
        }

        setLoadingStatus("Loading typefaces…");
        setLoadingProgress(55);
        await document.fonts.ready;

        if (isDestroyed) {
          tempApp.destroy(true, { children: true });
          return;
        }

        setLoadingStatus("Warming audio synths…");
        setLoadingProgress(80);
        await new Promise((resolve) => setTimeout(resolve, 250));

        if (isDestroyed) {
          tempApp.destroy(true, { children: true });
          return;
        }

        app = tempApp;
        isInitialized = true;
        containerRef.current?.appendChild(app.canvas);

        engine = new GameEngine(seed, difficulty, gameMode === "zen", zenDifficulty, zenDurationLimit);
        engineRef.current = engine;

        renderer = new GameRenderer(app, engine);

        // One clean event channel: boards emit gameplay events, the renderer
        // turns them into juice. Survives resets/replays (see GameEngine).
        engine.registerBoardEventHandler((isPlayer, e) => {
          renderer?.handleBoardEvent(isPlayer, e);
          if (isPlayer && (e.type === "correct" || e.type === "wrong")) {
            setHistory((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                text: e.question || "",
                answer: e.correctAnswer || "",
                correct: e.type === "correct",
              },
            ]);
          }
        });

        engine.registerCallbacks(
          (state) => setEngineState(state),
          (winner, stats) => onGameOver(winner, stats)
        );

        engine.start();

        app.ticker.add((ticker) => {
          if (!engine || !renderer) return;
          engine.update(ticker.elapsedMS);
          renderer.update(ticker.elapsedMS);
        });

        setLoadingProgress(100);
        setLoading(false);
      } catch (err) {
        console.error("Error during game initialization:", err);
        setLoadingStatus("Critical error during loading. See console.");
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (gameMode === "zen") {
          if (confirm("Finish practice session and see stats?")) {
            engineRef.current?.endZenSession();
          }
        } else {
          if (confirm("Quit the current match?")) {
            onExit();
          }
        }
      }
    };
    window.addEventListener("keydown", handleEscapeKey, true);

    initPixi();

    return () => {
      isDestroyed = true;
      window.removeEventListener("keydown", handleEscapeKey, true);
      if (app && isInitialized) {
        try {
          if (app.canvas && app.canvas.parentNode) {
            app.canvas.parentNode.removeChild(app.canvas);
          }
          app.destroy(true, { children: true });
        } catch (e) {
          console.error("Error during Pixi app cleanup:", e);
        }
      }
      if (engine) engine.destroy();
      engineRef.current = null;
    };
  }, [seed, difficulty, onGameOver, gameMode, zenDifficulty, zenDurationLimit, onExit]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Toolbar */}
      <div className="w-full max-w-[1200px] flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 font-display text-xs uppercase tracking-[0.15em] text-tetr-muted">
          <span className="chip">
            SEED <span className="text-tetr-warn ml-1">{seed}</span>
          </span>
          {gameMode === "versus" ? (
            <span className="chip">
              AI <span className="text-tetr-pink ml-1">{difficulty}</span>
            </span>
          ) : (
            <span className="chip">
              ZEN <span className="text-tetr-cyan ml-1">{zenDifficulty.toUpperCase()}</span>
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (gameMode === "zen") {
              if (confirm("Finish practice session and see stats?")) {
                engineRef.current?.endZenSession();
              }
            } else {
              if (confirm("Quit the current match?")) {
                onExit();
              }
            }
          }}
          className="btn-ghost btn-danger text-xs"
        >
          QUIT [ESC]
        </button>
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-[#222a42] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.14)_50%)] bg-[size:100%_3px]"></div>

        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0b0d15] p-8">
            <div className="w-full max-w-sm space-y-5 text-center">
              <h3 className="font-display text-tetr-cyan font-bold text-lg tracking-[0.35em] uppercase">
                WARMING UP
              </h3>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#141a2b] p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-tetr-cyan to-tetr-pink transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-tetr-muted">
                <span>{loadingStatus}</span>
                <span>{loadingProgress}%</span>
              </div>
            </div>
          </div>
        )}

        <div ref={containerRef} className="block w-[1200px] h-[760px]" />

        {/* Style block for animations */}
        <style>{`
          @keyframes slideInRight {
            0% {
              opacity: 0;
              transform: translateX(120px) skewX(-10deg);
            }
            60% {
              transform: translateX(-4px) skewX(2deg);
            }
            100% {
              opacity: 1;
              transform: translateX(0) skewX(0);
            }
          }
          .animate-slide-in-right {
            animation: slideInRight 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        {/* Solve History */}
        {gameMode === "zen" && (
          <div className="absolute left-[650px] top-[80px] w-[510px] h-[600px] z-10 rounded-xl border border-[#232a41] bg-[#141826]/75 backdrop-blur-md p-6 flex flex-col gap-4 text-left pointer-events-auto select-none overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_24px_rgba(0,0,0,0.3)]">
            <div className="font-display font-bold text-xs uppercase tracking-[0.25em] text-[#5a6280] pb-3 border-b border-[#232a41] flex justify-between items-center">
              <span>SOLVE HISTORY</span>
              <span className="font-mono text-[10px] text-[#9aa3bf]">
                {history.filter((h) => h.correct).length} / {history.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center font-mono text-[11px] text-[#5a6280]">
                  No equations solved yet
                </div>
              ) : (
                history.slice().reverse().map((item) => (
                  <div
                    key={item.id}
                    className={`flex justify-between items-center p-3 rounded-lg border-l-4 font-mono text-sm tracking-wider transition-all duration-300 animate-slide-in-right`}
                    style={{
                      borderColor: item.correct ? "#3ddc84" : "#ff3040",
                      borderTopWidth: 1,
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                      borderTopColor: "#232a41",
                      borderRightColor: "#232a41",
                      borderBottomColor: "#232a41",
                      background: item.correct ? "rgba(61, 220, 132, 0.05)" : "rgba(255, 48, 64, 0.05)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className={item.correct ? "text-[#3ddc84]" : "text-[#ff3040]"}>
                        {item.correct ? "✓" : "✗"}
                      </span>
                      <span className="text-[#eef2ff] font-bold">{item.text}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#5a6280] text-xs">ANSWER</span>
                      <span className={`font-bold ${item.correct ? "text-[#3ddc84]" : "text-[#ff3040]"}`}>
                        {item.answer}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-[1200px] mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-tetr-dim">
        {gameMode === "zen" ? (
          <>
            TYPE THE ANSWER · <span className="text-tetr-cyan">ENTER</span> TO SUBMIT · PRACTICE AT YOUR OWN PACE
          </>
        ) : (
          <>
            TYPE THE ANSWER · <span className="text-tetr-cyan">ENTER</span> TO SUBMIT · <span className="text-green-400">SPACE</span> TO DISRUPT · KEEP YOUR WELL BELOW THE TOP
          </>
        )}
      </div>
    </div>
  );
};
