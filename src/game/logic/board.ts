import { generateQuestion } from "./questions";
import type { Question, ZenQuestionDifficulty } from "./questions";
import { SoundManager } from "../audio/soundManager";

export interface IncomingGarbage {
  id: string;
  power: number;
  delayMs: number;
  totalDelayMs: number;
}

/** Maximum garbage the board can hold before a genuine top-out occurs. */
export const GARBAGE_CAPACITY = 10;
/** Maximum progress before an attack is launched. */
export const PROGRESS_CAPACITY = 10;
/** How long incoming garbage sits in the queue before landing (ms). */
export const INCOMING_DELAY_MS = 2000;
/** Minimum progress required to use early send (Spacebar). */
export const EARLY_SEND_MIN = 3;
/** Cooldown after using Disrupt before it can be used again (ms). */
export const DISRUPT_COOLDOWN_MS = 12000;

/**
 * One-shot gameplay events emitted by a board. These drive juice (particles,
 * shake, pops, sound cues) without the renderer having to poll or monkey-patch.
 */
export type BoardEvent =
  | { type: "correct"; question: string; correctAnswer: string }
  | { type: "wrong"; question: string; correctAnswer: string }
  | { type: "progressBlock"; index: number }
  | { type: "progressCycle" }
  | { type: "attack"; power: number }
  | { type: "cancel"; power: number }
  | { type: "earlySend"; sent: number; garbageAfter: number }
  | { type: "disrupted"; amount: number; progressAfter: number }
  | { type: "incoming"; power: number }
  | { type: "garbageApplied"; amount: number; total: number }
  | { type: "topout" };

export type BoardEventListener = (event: BoardEvent) => void;

export class BoardState {
  public id: "player" | "opponent";
  public garbage: number = 0;
  public progress: number = 0;
  public incomingQueue: IncomingGarbage[] = [];
  public activeQuestion!: Question;
  public previewQueue: Question[] = [];
  public inputBuffer: string = "";
  public solvedCount: number = 0;
  public accuracyCorrect: number = 0;
  public accuracyTotal: number = 0;
  public lost: boolean = false;
  /** Remaining cooldown on Disrupt ability (ms). 0 = ready. */
  public disruptCooldown: number = 0;

  public zenDifficulty?: ZenQuestionDifficulty;

  private seed: number;
  private currentQuestionIndex: number = 0;
  private soundManager = SoundManager.getInstance();
  private listeners: BoardEventListener[] = [];

  constructor(id: "player" | "opponent", seed: number) {
    this.id = id;
    this.seed = seed;
    this.reset();
  }

  public reset(zenDifficulty?: ZenQuestionDifficulty) {
    this.zenDifficulty = zenDifficulty;
    this.garbage = 0;
    this.progress = 0;
    this.incomingQueue = [];
    this.inputBuffer = "";
    this.solvedCount = 0;
    this.accuracyCorrect = 0;
    this.accuracyTotal = 0;
    this.lost = false;
    this.disruptCooldown = 0;
    this.currentQuestionIndex = 0;

    // Pre-populate preview queue then pull the first as active.
    this.previewQueue = [];
    for (let i = 0; i < 6; i++) {
      this.previewQueue.push(generateQuestion(this.currentQuestionIndex++, this.seed, this.zenDifficulty));
    }
    this.activeQuestion = this.previewQueue.shift()!;
  }

  // --- Event plumbing -------------------------------------------------------

  public on(listener: BoardEventListener) {
    this.listeners.push(listener);
  }

  public off(listener: BoardEventListener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private emit(event: BoardEvent) {
    for (const listener of this.listeners) listener(event);
  }

  // --- Input ----------------------------------------------------------------

  public handleInput(char: string) {
    if (this.lost) return;
    if (char === "Backspace") {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
    } else if (/^[0-9]$/.test(char)) {
      if (this.inputBuffer.length < 8) {
        this.inputBuffer += char;
      }
    }
  }

  /** Submit the current input buffer. Returns whether it was correct plus the
   *  attack power that should be sent to the opponent (already accounting for
   *  cancellation against this board's own incoming garbage). */
  public submit(): { correct: boolean; attackPower: number } {
    if (this.lost || this.inputBuffer === "") return { correct: false, attackPower: 0 };

    const playerAnswer = parseInt(this.inputBuffer, 10);
    const isCorrect = playerAnswer === this.activeQuestion.answer;

    let attackPower = 0;
    this.accuracyTotal++;

    if (isCorrect) {
      this.accuracyCorrect++;
      this.solvedCount++;
      this.progress++;

      this.soundManager.playCorrect();
      this.emit({ type: "correct", question: this.activeQuestion.text, correctAnswer: this.activeQuestion.answer.toString() });
      this.emit({ type: "progressBlock", index: this.progress - 1 });

      // Complete a progress cycle: launch an attack.
      if (this.progress >= PROGRESS_CAPACITY) {
        let rawAttack = Math.max(0, PROGRESS_CAPACITY - this.garbage);
        this.progress = 0;
        this.soundManager.playAttack();
        this.emit({ type: "progressCycle" });

        // Cancel our own incoming garbage first (oldest first).
        let cancelled = 0;
        for (const pending of this.incomingQueue) {
          if (rawAttack <= 0) break;
          if (pending.power <= rawAttack) {
            rawAttack -= pending.power;
            cancelled += pending.power;
            pending.power = 0;
          } else {
            pending.power -= rawAttack;
            cancelled += rawAttack;
            rawAttack = 0;
          }
        }
        this.incomingQueue = this.incomingQueue.filter((p) => p.power > 0);

        if (cancelled > 0) this.emit({ type: "cancel", power: cancelled });

        // Leftover attack power is what actually reaches the opponent.
        attackPower = rawAttack;
        if (attackPower > 0) this.emit({ type: "attack", power: attackPower });
      }
    } else {
      this.soundManager.playWarning();
      this.emit({ type: "wrong", question: this.activeQuestion.text, correctAnswer: this.activeQuestion.answer.toString() });
    }

    // Advance the queue.
    this.activeQuestion = this.previewQueue.shift()!;
    this.previewQueue.push(generateQuestion(this.currentQuestionIndex++, this.seed, this.zenDifficulty));
    this.inputBuffer = "";

    return { correct: isCorrect, attackPower };
  }

  /** Early send: spend current progress to disrupt the opponent. Requires at
   *  least EARLY_SEND_MIN progress. Returns the amount sent (caller applies it
   *  to the opponent via receiveDisrupt). */
  public earlySend(): number {
    if (this.lost || this.progress < EARLY_SEND_MIN || this.disruptCooldown > 0) return 0;

    const sent = this.progress;
    this.progress = 0;
    this.disruptCooldown = DISRUPT_COOLDOWN_MS;

    this.soundManager.playAttack();
    this.emit({ type: "earlySend", sent, garbageAfter: 0 });

    return sent;
  }

  /** Receive a disrupt from the opponent — reduces this board's progress.
   *  Excess is lost (progress can't go below 0). */
  public receiveDisrupt(amount: number) {
    if (amount <= 0 || this.lost) return;
    const before = this.progress;
    this.progress = Math.max(0, this.progress - amount);
    const removed = before - this.progress;
    this.emit({ type: "disrupted", amount: removed, progressAfter: this.progress });
  }

  /** Receive an attack from the opponent. It waits in the incoming queue and is
   *  only applied after the delay; the defender can cancel it in the meantime by
   *  launching their own attacks (handled in submit()). */
  public receiveAttack(power: number): number {
    if (power <= 0 || this.lost) return 0;

    this.incomingQueue.push({
      id: Math.random().toString(36).substring(2, 9),
      power,
      delayMs: INCOMING_DELAY_MS,
      totalDelayMs: INCOMING_DELAY_MS,
    });

    this.emit({ type: "incoming", power });
    return power;
  }

  /** Advance incoming-garbage timers and apply garbage that has landed. */
  public update(dtMs: number) {
    if (this.lost) return;

    // Tick down disrupt cooldown.
    if (this.disruptCooldown > 0) {
      this.disruptCooldown = Math.max(0, this.disruptCooldown - dtMs);
    }

    for (const pending of this.incomingQueue) {
      pending.delayMs -= dtMs;

      if (pending.delayMs <= 0) {
        // Defender's progress absorbs part of the incoming garbage.
        const absorbed = Math.min(this.progress, pending.power);
        if (absorbed > 0) {
          this.progress -= absorbed;
          pending.power -= absorbed;
          this.emit({ type: "disrupted", amount: absorbed, progressAfter: this.progress });
        }

        const before = this.garbage;
        this.garbage += pending.power;
        pending.power = 0; // mark for removal

        const applied = this.garbage - before;
        this.soundManager.playGarbageImpact();
        this.emit({ type: "garbageApplied", amount: applied, total: this.garbage });

        // Top-out only on genuine overflow past the board's capacity. Reaching
        // exactly the capacity fills the board but is survivable.
        if (this.garbage > GARBAGE_CAPACITY) {
          this.garbage = GARBAGE_CAPACITY;
          this.lost = true;
          this.emit({ type: "topout" });
        }
      }
    }

    this.incomingQueue = this.incomingQueue.filter((p) => p.power > 0);
  }

  /** Total pending garbage still waiting in the incoming queue. */
  public getIncomingTotal(): number {
    return this.incomingQueue.reduce((sum, p) => sum + p.power, 0);
  }

  public getAccuracyRate(): number {
    if (this.accuracyTotal === 0) return 1.0;
    return this.accuracyCorrect / this.accuracyTotal;
  }
}
