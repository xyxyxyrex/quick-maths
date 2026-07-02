import { BoardState } from "../logic/board";
import { GameEngine } from "../engine/gameEngine";

export interface IPlayerController {
  init(board: BoardState, opponentBoard: BoardState, engine: GameEngine): void;
  update(dtMs: number): void;
  destroy(): void;
}
