import { BoardState } from "../logic/board";
import type { BoardEvent } from "../logic/board";
import type { ZenQuestionDifficulty } from "../logic/questions";
import type { IPlayerController } from "../players/IPlayerController";
import { HumanPlayerController } from "../players/HumanPlayerController";
import { AIPlayerController } from "../players/AIPlayerController";
import type { AIDifficulty } from "../players/AIPlayerController";
import { SoundManager } from "../audio/soundManager";

export type GameState = "COUNTDOWN" | "PLAYING" | "GAMEOVER";

export interface MatchStats {
  matchTimeSec: string;
  playerSolved: number;
  playerAccuracy: string;
  opponentSolved: number;
  opponentAccuracy: string;
  seed: number;
  difficulty: AIDifficulty;
  isZen?: boolean;
  zenDifficulty?: string;
  sps?: string;
  spm?: string;
}

/** Receives one-shot board events tagged with which side they came from. */
export type BoardEventHandler = (isPlayer: boolean, event: BoardEvent) => void;

export class GameEngine {
  private state: GameState = "COUNTDOWN";
  private playerBoard!: BoardState;
  private opponentBoard!: BoardState;
  private playerController!: IPlayerController;
  private opponentController!: IPlayerController;

  private countdownValue: number = 3;
  private countdownTimerMs: number = 0;
  private matchTimeMs: number = 0;
  private winner: "player" | "opponent" | null = null;
  private seed: number;
  private aiDifficulty: AIDifficulty;
  private zenMode: boolean = false;
  private zenDifficulty: ZenQuestionDifficulty = "progressive";
  private zenDurationLimit: number = 0; // 0 = Free

  private stateChangeCallback?: (state: GameState) => void;
  private gameOverCallback?: (winner: "player" | "opponent", stats: MatchStats) => void;
  private boardEventHandler?: BoardEventHandler;

  private soundManager = SoundManager.getInstance();

  constructor(
    seed: number,
    aiDifficulty: AIDifficulty = "medium",
    zenMode = false,
    zenDifficulty: ZenQuestionDifficulty = "progressive",
    zenDurationLimit = 0
  ) {
    this.seed = seed;
    this.aiDifficulty = aiDifficulty;
    this.zenMode = zenMode;
    this.zenDifficulty = zenDifficulty;
    this.zenDurationLimit = zenDurationLimit;
    this.reset();
  }

  public reset() {
    this.state = "COUNTDOWN";
    this.countdownValue = 3;
    this.countdownTimerMs = 3000; // 3 second countdown
    this.matchTimeMs = 0;
    this.winner = null;

    // Recreate boards
    this.playerBoard = new BoardState("player", this.seed);
    this.playerBoard.reset(this.zenDifficulty);
    this.opponentBoard = new BoardState("opponent", this.seed);

    // Recreate controllers
    if (this.playerController) this.playerController.destroy();
    if (this.opponentController) this.opponentController.destroy();

    this.playerController = new HumanPlayerController();
    this.opponentController = new AIPlayerController(this.aiDifficulty);

    this.playerController.init(this.playerBoard, this.opponentBoard, this);
    this.opponentController.init(this.opponentBoard, this.playerBoard, this);

    // Re-attach any registered event handler to the freshly created boards.
    this.attachBoardHandlers();

    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.state);
    }
  }

  /** Register a handler that receives board events from both boards. The handler
   *  persists across resets/replays and is re-bound to the new boards. */
  public registerBoardEventHandler(handler: BoardEventHandler) {
    this.boardEventHandler = handler;
    this.attachBoardHandlers();
  }

  private attachBoardHandlers() {
    if (!this.boardEventHandler) return;
    const handler = this.boardEventHandler;
    this.playerBoard.on((e) => handler(true, e));
    this.opponentBoard.on((e) => handler(false, e));
  }

  public registerCallbacks(
    onStateChange: (state: GameState) => void,
    onGameOver: (winner: "player" | "opponent", stats: MatchStats) => void
  ) {
    this.stateChangeCallback = onStateChange;
    this.gameOverCallback = onGameOver;
  }

  public start() {
    this.reset();
  }

  public update(dtMs: number) {
    if (this.state === "COUNTDOWN") {
      this.countdownTimerMs -= dtMs;
      const prevVal = this.countdownValue;
      this.countdownValue = Math.ceil(this.countdownTimerMs / 1000);

      if (this.countdownValue !== prevVal && this.countdownValue > 0) {
        this.soundManager.playCorrect();
      }

      if (this.countdownTimerMs <= 0) {
        this.state = "PLAYING";
        this.countdownValue = 0;
        this.soundManager.playAttack(); // "GO" sound trigger
        if (this.stateChangeCallback) {
          this.stateChangeCallback(this.state);
        }
      }
    } else if (this.state === "PLAYING") {
      this.matchTimeMs += dtMs;

      this.playerBoard.update(dtMs);
      this.playerController.update(dtMs);

      if (!this.zenMode) {
        this.opponentBoard.update(dtMs);
        this.opponentController.update(dtMs);
      }

      if (this.zenMode && this.zenDurationLimit > 0 && this.matchTimeMs >= this.zenDurationLimit * 1000) {
        this.endGame("player");
      } else if (this.playerBoard.lost) {
        this.endGame("opponent");
      } else if (!this.zenMode && this.opponentBoard.lost) {
        this.endGame("player");
      }
    }
  }

  private endGame(winner: "player" | "opponent") {
    this.state = "GAMEOVER";
    this.winner = winner;
    this.soundManager.playLose();

    const stats: MatchStats = {
      matchTimeSec: (this.matchTimeMs / 1000).toFixed(1),
      playerSolved: this.playerBoard.solvedCount,
      playerAccuracy: (this.playerBoard.getAccuracyRate() * 100).toFixed(0),
      opponentSolved: this.zenMode ? 0 : this.opponentBoard.solvedCount,
      opponentAccuracy: this.zenMode ? "0" : (this.opponentBoard.getAccuracyRate() * 100).toFixed(0),
      seed: this.seed,
      difficulty: this.aiDifficulty,
      isZen: this.zenMode,
      zenDifficulty: this.zenDifficulty,
      sps: (this.playerBoard.solvedCount / Math.max(1, this.matchTimeMs / 1000)).toFixed(2),
      spm: ((this.playerBoard.solvedCount / Math.max(1, this.matchTimeMs / 1000)) * 60).toFixed(0),
    };

    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.state);
    }
    if (this.gameOverCallback) {
      this.gameOverCallback(winner, stats);
    }
  }

  // Getters
  public getState(): GameState {
    return this.state;
  }

  public getPlayerBoard(): BoardState {
    return this.playerBoard;
  }

  public getOpponentBoard(): BoardState {
    return this.opponentBoard;
  }

  public getCountdownValue(): number {
    return this.countdownValue;
  }

  public getCountdownPercentage(): number {
    if (this.state !== "COUNTDOWN") return 0;
    return (this.countdownTimerMs % 1000) / 1000;
  }

  public getMatchTimeSec(): number {
    return this.matchTimeMs / 1000;
  }

  public getWinner(): "player" | "opponent" | null {
    return this.winner;
  }

  public isZenMode(): boolean {
    return this.zenMode;
  }

  public getZenDifficulty(): ZenQuestionDifficulty {
    return this.zenDifficulty;
  }

  public getZenDurationLimit(): number {
    return this.zenDurationLimit;
  }

  public endZenSession() {
    if (this.zenMode) {
      this.endGame("player");
    }
  }

  public destroy() {
    if (this.playerController) this.playerController.destroy();
    if (this.opponentController) this.opponentController.destroy();
  }
}
