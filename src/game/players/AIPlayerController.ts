import type { IPlayerController } from "./IPlayerController";
import { BoardState, EARLY_SEND_MIN, PROGRESS_CAPACITY } from "../logic/board";
import { GameEngine } from "../engine/gameEngine";

export type AIDifficulty = "easy" | "medium" | "hard" | "impossible";

interface AIDifficultySetting {
  minReaction: number; // ms
  maxReaction: number; // ms
  accuracy: number;    // 0.0 to 1.0
}

const AI_DIFFICULTIES: Record<AIDifficulty, AIDifficultySetting> = {
  easy: { minReaction: 1800, maxReaction: 3200, accuracy: 0.85 },
  medium: { minReaction: 1200, maxReaction: 2200, accuracy: 0.92 },
  hard: { minReaction: 800, maxReaction: 1500, accuracy: 0.97 },
  impossible: { minReaction: 450, maxReaction: 900, accuracy: 0.99 },
};

export class AIPlayerController implements IPlayerController {
  private board!: BoardState;
  private opponentBoard!: BoardState;
  private engine!: GameEngine;
  private difficulty: AIDifficultySetting;

  // AI state machine
  private state: "reading" | "typing" | "submitting" = "reading";
  private timerMs: number = 0;
  private totalReactionTimeMs: number = 0;
  private targetAnswerString: string = "";
  private charsTyped: number = 0;
  private nextCharTimerMs: number = 0;
  private typingIntervalMs: number = 80;

  private lastHandledQuestionText: string = "";

  constructor(difficulty: AIDifficulty = "medium") {
    this.difficulty = AI_DIFFICULTIES[difficulty] || AI_DIFFICULTIES.medium;
  }

  public init(board: BoardState, opponentBoard: BoardState, engine: GameEngine) {
    this.board = board;
    this.opponentBoard = opponentBoard;
    this.engine = engine;
    this.resetForNextQuestion();
  }

  private resetForNextQuestion() {
    this.state = "reading";
    this.timerMs = 0;
    this.charsTyped = 0;
    this.nextCharTimerMs = 0;

    const activeQ = this.board.activeQuestion;
    if (!activeQ) return;

    this.lastHandledQuestionText = activeQ.text;

    // 1. Calculate reaction time
    const range = this.difficulty.maxReaction - this.difficulty.minReaction;
    this.totalReactionTimeMs = this.difficulty.minReaction + Math.random() * range;

    // 2. Decide if AI will answer correctly
    const isCorrect = Math.random() < this.difficulty.accuracy;

    if (isCorrect) {
      this.targetAnswerString = activeQ.answer.toString();
    } else {
      this.targetAnswerString = this.generateBelievableMistake(activeQ.answer);
    }

    // 3. Determine typing speed
    const typingDuration = this.totalReactionTimeMs * 0.5;
    this.typingIntervalMs = Math.max(50, typingDuration / Math.max(1, this.targetAnswerString.length));
  }

  private generateBelievableMistake(correctAnswer: number): string {
    const correctStr = correctAnswer.toString();
    const len = correctStr.length;

    const mistakeType = Math.floor(Math.random() * 3);

    if (mistakeType === 0 && len >= 2) {
      const chars = correctStr.split("");
      const idx = Math.floor(Math.random() * (len - 1));
      const temp = chars[idx];
      chars[idx] = chars[idx + 1];
      chars[idx + 1] = temp;
      const swappedStr = chars.join("");
      if (swappedStr !== correctStr) {
        return swappedStr;
      }
    }

    if (mistakeType === 1) {
      const delta = Math.random() < 0.5 ? -1 : 1;
      const val = correctAnswer + delta;
      return val.toString();
    }

    const delta = Math.floor(Math.random() * 11) - 5;
    const finalDelta = delta === 0 ? 3 : delta;
    const val = Math.max(0, correctAnswer + finalDelta);
    return val.toString();
  }

  public update(dtMs: number) {
    if (this.board.lost) return;
    if (this.engine.getState() !== "PLAYING") return;

    // If the active question changed on the board externally, reset
    if (this.board.activeQuestion && this.board.activeQuestion.text !== this.lastHandledQuestionText) {
      this.resetForNextQuestion();
    }

    this.timerMs += dtMs;

    if (this.state === "reading") {
      if (this.timerMs >= this.totalReactionTimeMs * 0.4) {
        this.state = "typing";
        this.board.inputBuffer = "";
      }
    } else if (this.state === "typing") {
      this.nextCharTimerMs += dtMs;
      if (this.nextCharTimerMs >= this.typingIntervalMs) {
        this.nextCharTimerMs = 0;
        if (this.charsTyped < this.targetAnswerString.length) {
          const nextChar = this.targetAnswerString[this.charsTyped];
          this.board.handleInput(nextChar);
          this.charsTyped++;
        } else {
          this.state = "submitting";
        }
      }
    } else if (this.state === "submitting") {
      if (this.timerMs >= this.totalReactionTimeMs) {
        // Consider early send to disrupt opponent's progress buildup.
        if (this.board.progress >= EARLY_SEND_MIN && this.shouldEarlySend()) {
          const sent = this.board.earlySend();
          if (sent > 0) {
            this.opponentBoard.receiveDisrupt(sent);
          }
        }

        const result = this.board.submit();
        if (result.attackPower > 0) {
          this.opponentBoard.receiveAttack(result.attackPower);
        }
        this.resetForNextQuestion();
      }
    }
  }

  /** Difficulty-dependent heuristic for when the AI should disrupt instead of
   *  building toward a full attack. Based on opponent's progress. */
  private shouldEarlySend(): boolean {
    const oppProgress = this.opponentBoard.progress / PROGRESS_CAPACITY;
    // Easy: never disrupts
    if (this.difficulty.accuracy <= 0.85) return false;
    // Medium: disrupt when opponent is close to attacking (>=70%)
    if (this.difficulty.accuracy <= 0.92) return oppProgress >= 0.7;
    // Hard: disrupt when opponent is building momentum (>=50%)
    if (this.difficulty.accuracy <= 0.97) return oppProgress >= 0.5;
    // Impossible: aggressively disrupt (>=30%)
    return oppProgress >= 0.3;
  }

  public destroy() {
    // No events to clean up
  }
}
