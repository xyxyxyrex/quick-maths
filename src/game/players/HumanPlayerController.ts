import type { IPlayerController } from "./IPlayerController";
import { BoardState } from "../logic/board";
import { GameEngine } from "../engine/gameEngine";

export class HumanPlayerController implements IPlayerController {
  private board!: BoardState;
  private opponentBoard!: BoardState;
  private engine!: GameEngine;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public init(board: BoardState, opponentBoard: BoardState, engine: GameEngine) {
    this.board = board;
    this.opponentBoard = opponentBoard;
    this.engine = engine;

    // Listen to global keyboard events
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Only process inputs during active gameplay
    if (!this.engine || this.engine.getState() !== "PLAYING") return;
    if (this.board.lost) return;

    if (e.key === "Enter") {
      const result = this.board.submit();
      if (result.attackPower > 0) {
        this.opponentBoard.receiveAttack(result.attackPower);
      }
    } else if (e.key === " ") {
      e.preventDefault();
      const sent = this.board.earlySend();
      if (sent > 0) {
        this.opponentBoard.receiveDisrupt(sent);
      }
    } else if (e.key === "Backspace") {
      this.board.handleInput("Backspace");
    } else if (/^[0-9]$/.test(e.key)) {
      this.board.handleInput(e.key);
    }
  }

  public update(_dtMs: number) {
    // Nothing to update periodically for human; keyboard listeners handle it
  }

  public destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
