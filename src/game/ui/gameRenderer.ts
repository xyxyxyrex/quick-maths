import { Container, Graphics, Text, Application } from "pixi.js";
import { GameEngine } from "../engine/gameEngine";
import type { BoardEvent } from "../logic/board";
import { BoardState, GARBAGE_CAPACITY, PROGRESS_CAPACITY, EARLY_SEND_MIN, DISRUPT_COOLDOWN_MS } from "../logic/board";

// ---------------------------------------------------------------------------
// Palette (TETR.IO-inspired: flat, dark, high-contrast, punchy accents)
// ---------------------------------------------------------------------------
const COL = {
  bg: 0x0b0d15,
  gridLine: 0x161a2b,
  panel: 0x141826,
  panelEdge: 0x232a41,
  header: 0x1b2133,
  cellEmpty: 0x1a1f30,
  cellEmptyEdge: 0x272e45,
  textHi: 0xeef2ff,
  textMid: 0x9aa3bf,
  textDim: 0x5a6280,
  garbage: 0xf23a54,
  garbageTop: 0xff8090,
  garbageDeep: 0x7c1a2b,
  warn: 0xffb02e,
  danger: 0xff3040,
  gold: 0xffd24a,
  disrupt: 0x3ddc84,
  disruptDim: 0x1a6b40,
};

const ACCENT = {
  player: 0x36d3ff,
  opponent: 0xff5c8a,
};

// ---------------------------------------------------------------------------
// Layout geometry — scaled up (~1.2x from previous 1000x620 layout)
// ---------------------------------------------------------------------------
const PANEL_W = 510;
const PANEL_H = 600;
const PANEL_Y = 80;
const PLAYER_X = 30;
const OPP_X = 650;

const WELL_X = 18;
const WELL_W = 70;
const WELL_BOTTOM = 554;
const WELL_TOP = 76;
const ROW_GAP = 3;
const ROW_H = (WELL_BOTTOM - WELL_TOP - (GARBAGE_CAPACITY - 1) * ROW_GAP) / GARBAGE_CAPACITY;

const CONTENT_X = 116;
const CONTENT_CX = 308; // horizontal center of the content column
const CONTENT_W = 376;

const PROG_X = CONTENT_X;
const PROG_Y = 540;
const PROG_W = CONTENT_W;
const PROG_H = 22;

// Disrupt ability box (Tetris "Hold" style) — positioned below the well
const ABILITY_W = 400;
const ABILITY_H = 36;
const ABILITY_X = (PANEL_W - ABILITY_W) / 2; // 55
const ABILITY_Y = WELL_BOTTOM + 40; // 594

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  alpha: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  square?: boolean;
  // Projectile fields
  projectile?: boolean;
  sx?: number;
  sy?: number;
  tx?: number;
  ty?: number;
  arc?: number;
  onArrive?: () => void;
}

interface BoardVisual {
  container: Container;
  panelGfx: Graphics;
  meterGfx: Graphics;
  abilityGfx: Graphics;
  nameText: Text;
  statsText: Text;
  equationText: Text;
  inputText: Text;
  nextLabel: Text;
  previewTexts: Text[];
  sendText: Text;
  abilityLabel: Text;
  abilityCdText: Text;
  accent: number;
  isPlayer: boolean;

  // Animation state
  trauma: number;
  eqPop: number;
  eqWrong: number;
  sendPop: number;
  progressPulse: number;
  chargePulse: number;
  incomingFlash: number;
  hurtFlash: number;
  dangerPulse: number;
  abilityFlash: number; // flash when ability becomes ready
}

export class GameRenderer {
  private app: Application;
  private engine: GameEngine;
  private container: Container;

  private bgGfx!: Graphics;
  private particleGfx!: Graphics;
  private overlayGfx!: Graphics;
  private dividerGfx!: Graphics;
  private matchTimeText!: Text;
  private countdownText!: Text;
  private countdownSub!: Text;

  private player!: BoardVisual;
  private opponent!: BoardVisual;

  private particles: Particle[] = [];
  private globalTrauma = 0;
  private globalFlash = 0;
  private bgScroll = 0;
  private time = 0;

  constructor(app: Application, engine: GameEngine) {
    this.app = app;
    this.engine = engine;
    this.container = new Container();
    this.app.stage.addChild(this.container);
    this.build();
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------
  private build() {
    this.bgGfx = new Graphics();
    this.container.addChild(this.bgGfx);

    this.dividerGfx = new Graphics();
    this.container.addChild(this.dividerGfx);

    const isZen = this.engine.isZenMode();
    const playerX = PLAYER_X;
    const playerName = isZen ? `ZEN · ${this.engine.getZenDifficulty().toUpperCase()}` : "YOU";

    this.player = this.buildBoard(playerX, playerName, ACCENT.player, true);
    this.opponent = this.buildBoard(OPP_X, "CPU", ACCENT.opponent, false);

    if (isZen) {
      this.opponent.container.visible = false;
      this.dividerGfx.visible = false;
    }

    this.particleGfx = new Graphics();
    this.container.addChild(this.particleGfx);

    this.matchTimeText = new Text({
      text: "0:00.0",
      style: {
        fontFamily: '"Chakra Petch", "Share Tech Mono", monospace',
        fontSize: 24,
        fontWeight: "700",
        fill: COL.textMid,
        align: "center",
        letterSpacing: 2,
      },
    });
    this.matchTimeText.anchor.set(0.5);
    this.matchTimeText.position.set(this.app.screen.width / 2, 38);
    this.container.addChild(this.matchTimeText);

    this.overlayGfx = new Graphics();
    this.container.addChild(this.overlayGfx);

    this.countdownText = new Text({
      text: "",
      style: {
        fontFamily: '"Chakra Petch", "Orbitron", sans-serif',
        fontWeight: "700",
        fontSize: 160,
        fill: COL.textHi,
        stroke: { color: 0x000000, width: 6 },
        align: "center",
        letterSpacing: 4,
      },
    });
    this.countdownText.anchor.set(0.5);
    this.countdownText.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 10);
    this.container.addChild(this.countdownText);

    this.countdownSub = new Text({
      text: "GET READY",
      style: {
        fontFamily: '"Chakra Petch", sans-serif',
        fontWeight: "500",
        fontSize: 20,
        fill: COL.textMid,
        align: "center",
        letterSpacing: 8,
      },
    });
    this.countdownSub.anchor.set(0.5);
    this.countdownSub.position.set(this.app.screen.width / 2, this.app.screen.height / 2 + 88);
    this.container.addChild(this.countdownSub);
  }

  private buildBoard(panelX: number, name: string, accent: number, isPlayer: boolean): BoardVisual {
    const container = new Container();
    container.position.set(panelX, PANEL_Y);
    this.container.addChild(container);

    const panelGfx = new Graphics();
    container.addChild(panelGfx);

    const meterGfx = new Graphics();
    container.addChild(meterGfx);

    const abilityGfx = new Graphics();
    container.addChild(abilityGfx);

    const nameText = new Text({
      text: name,
      style: {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: 20,
        fontWeight: "700",
        fill: accent,
        letterSpacing: 3,
      },
    });
    nameText.anchor.set(0, 0.5);
    nameText.position.set(28, 26);
    container.addChild(nameText);

    const statsText = new Text({
      text: "",
      style: {
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 14,
        fill: COL.textMid,
        letterSpacing: 1,
      },
    });
    statsText.anchor.set(1, 0.5);
    statsText.position.set(PANEL_W - 18, 26);
    container.addChild(statsText);

    const equationText = new Text({
      text: "",
      style: {
        fontFamily: '"Chakra Petch", "Share Tech Mono", monospace',
        fontSize: 52,
        fontWeight: "700",
        fill: COL.textHi,
        align: "center",
      },
    });
    equationText.anchor.set(0.5);
    equationText.position.set(CONTENT_CX, 130);
    container.addChild(equationText);

    const inputText = new Text({
      text: "",
      style: {
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 36,
        fontWeight: "700",
        fill: accent,
        align: "center",
        letterSpacing: 3,
      },
    });
    inputText.anchor.set(0.5);
    inputText.position.set(CONTENT_CX, 228);
    container.addChild(inputText);

    const nextLabel = new Text({
      text: "NEXT",
      style: {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: 13,
        fontWeight: "600",
        fill: COL.textDim,
        letterSpacing: 5,
      },
    });
    nextLabel.anchor.set(0.5);
    nextLabel.position.set(CONTENT_CX, 272);
    container.addChild(nextLabel);

    const previewTexts: Text[] = [];
    for (let i = 0; i < 3; i++) {
      const t = new Text({
        text: "",
        style: {
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: 24 - i * 2,
          fill: COL.textMid,
          align: "center",
        },
      });
      t.anchor.set(0.5);
      t.position.set(CONTENT_CX, 306 + i * 38);
      t.alpha = 1 - i * 0.28;
      container.addChild(t);
      previewTexts.push(t);
    }

    const sendText = new Text({
      text: "",
      style: {
        fontFamily: '"Chakra Petch", "Orbitron", sans-serif',
        fontWeight: "700",
        fontSize: 26,
        fill: COL.disrupt,
        align: "center",
        letterSpacing: 2,
      },
    });
    sendText.anchor.set(0.5);
    sendText.position.set(CONTENT_CX, 470);
    container.addChild(sendText);

    // Ability box labels
    const abilityLabel = new Text({
      text: "DISRUPT",
      style: {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: 9,
        fontWeight: "700",
        fill: COL.disrupt,
        align: "center",
        letterSpacing: 3,
      },
    });
    abilityLabel.anchor.set(0.5, 0.5);
    abilityLabel.position.set(ABILITY_X + ABILITY_W / 2, ABILITY_Y - 10);
    container.addChild(abilityLabel);

    const abilityCdText = new Text({
      text: "READY",
      style: {
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 11,
        fontWeight: "700",
        fill: COL.disrupt,
        align: "center",
      },
    });
    abilityCdText.anchor.set(0.5, 0.5);
    abilityCdText.position.set(ABILITY_X + ABILITY_W / 2, ABILITY_Y + ABILITY_H / 2);
    container.addChild(abilityCdText);

    return {
      container,
      panelGfx,
      meterGfx,
      abilityGfx,
      nameText,
      statsText,
      equationText,
      inputText,
      nextLabel,
      previewTexts,
      sendText,
      abilityLabel,
      abilityCdText,
      accent,
      isPlayer,
      trauma: 0,
      eqPop: 0,
      eqWrong: 0,
      sendPop: 0,
      progressPulse: 0,
      chargePulse: 0,
      incomingFlash: 0,
      hurtFlash: 0,
      dangerPulse: 0,
      abilityFlash: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Board events -> juice
  // -------------------------------------------------------------------------
  public handleBoardEvent(isPlayer: boolean, e: BoardEvent) {
    const v = isPlayer ? this.player : this.opponent;

    switch (e.type) {
      case "correct":
        v.eqPop = 1;
        this.spawnBurst(this.worldX(v, CONTENT_CX), PANEL_Y + 228, v.accent, 8, 3);
        break;
      case "progressBlock": {
        const segCx = this.worldX(v, PROG_X + (e.index + 0.5) * (PROG_W / PROGRESS_CAPACITY));
        v.progressPulse = 1;
        this.spawnBurst(segCx, PANEL_Y + PROG_Y + PROG_H / 2, v.accent, 6, 2.2);
        break;
      }
      case "wrong":
        v.eqWrong = 1;
        v.trauma = Math.min(1, v.trauma + 0.28);
        break;
      case "progressCycle":
        v.chargePulse = 1;
        v.trauma = Math.min(1, v.trauma + 0.2);
        this.spawnRing(this.worldX(v, CONTENT_CX), PANEL_Y + PROG_Y, v.accent);
        break;
      case "attack": {
        const target = isPlayer ? this.opponent : this.player;
        const sx = this.worldX(v, CONTENT_CX);
        const sy = PANEL_Y + 130;
        const tx = this.worldX(target, WELL_X + WELL_W / 2);
        const ty = PANEL_Y + (WELL_BOTTOM + WELL_TOP) / 2;
        for (let i = 0; i < Math.min(6, Math.max(2, e.power)); i++) {
          this.spawnProjectile(sx, sy, tx, ty, v.accent, target);
        }
        this.spawnBurst(sx, sy, v.accent, 10, 4);
        break;
      }
      case "earlySend": {
        v.sendPop = 1;
        v.sendText.text = `−${e.sent}  DISRUPT`;
        v.sendText.alpha = 1;
        const progCx = this.worldX(v, PROG_X + PROG_W / 2);
        this.spawnBurst(progCx, PANEL_Y + PROG_Y + PROG_H / 2, COL.disrupt, 10, 3.5);
        const target = isPlayer ? this.opponent : this.player;
        const tx = this.worldX(target, PROG_X + PROG_W / 2);
        const ty = PANEL_Y + PROG_Y + PROG_H / 2;
        for (let i = 0; i < Math.min(4, e.sent); i++) {
          this.spawnProjectile(progCx, PANEL_Y + PROG_Y, tx, ty, COL.disrupt, target);
        }
        break;
      }
      case "disrupted": {
        v.trauma = Math.min(1, v.trauma + 0.2);
        v.progressPulse = 1;
        v.sendPop = 1;
        v.sendText.text = `−${e.amount}  HIT`;
        v.sendText.alpha = 1;
        const dpx = this.worldX(v, PROG_X + (e.progressAfter + 0.5) * (PROG_W / PROGRESS_CAPACITY));
        this.spawnBurst(dpx, PANEL_Y + PROG_Y + PROG_H / 2, COL.danger, 10, 3);
        break;
      }
      case "cancel":
        v.incomingFlash = 1;
        this.spawnBurst(this.worldX(v, WELL_X + WELL_W / 2), PANEL_Y + WELL_BOTTOM - 40, v.accent, 8, 3);
        break;
      case "incoming":
        v.incomingFlash = 1;
        break;
      case "garbageApplied":
        v.trauma = Math.min(1, v.trauma + 0.35 + Math.min(0.4, e.amount * 0.06));
        v.hurtFlash = 1;
        this.spawnDebris(
          this.worldX(v, WELL_X + WELL_W / 2),
          PANEL_Y + WELL_BOTTOM - (e.total - e.amount) * (ROW_H + ROW_GAP) - 6,
          e.amount
        );
        break;
      case "topout":
        v.trauma = 1;
        v.hurtFlash = 1;
        this.globalTrauma = Math.min(1, this.globalTrauma + 0.7);
        this.globalFlash = 1;
        this.spawnDebris(this.worldX(v, WELL_X + WELL_W / 2), PANEL_Y + WELL_TOP + 40, 26);
        this.spawnBurst(this.worldX(v, WELL_X + WELL_W / 2), PANEL_Y + 260, COL.danger, 30, 7);
        break;
    }
  }

  private worldX(v: BoardVisual, localX: number): number {
    return (v.isPlayer ? PLAYER_X : OPP_X) + localX;
  }

  // -------------------------------------------------------------------------
  // Particles
  // -------------------------------------------------------------------------
  private spawnBurst(x: number, y: number, color: number, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 1,
        color,
        alpha: 1,
        life: 0,
        maxLife: 260 + Math.random() * 260,
        size: 2.5 + Math.random() * 3,
        gravity: 0.12,
      });
    }
  }

  private spawnDebris(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const s = 2 + Math.random() * 5;
      this.particles.push({
        x: x + (Math.random() - 0.5) * WELL_W,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        color: Math.random() < 0.5 ? COL.garbage : COL.garbageTop,
        alpha: 1,
        life: 0,
        maxLife: 320 + Math.random() * 300,
        size: 3 + Math.random() * 3.5,
        gravity: 0.25,
        square: true,
      });
    }
  }

  private spawnRing(x: number, y: number, color: number) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = 4.5;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        alpha: 1,
        life: 0,
        maxLife: 240,
        size: 3,
        gravity: 0,
      });
    }
  }

  private spawnProjectile(sx: number, sy: number, tx: number, ty: number, color: number, target: BoardVisual) {
    this.particles.push({
      x: sx, y: sy,
      vx: 0, vy: 0,
      color,
      alpha: 1,
      life: 0,
      maxLife: 260 + Math.random() * 120,
      size: 4.5 + Math.random() * 2.5,
      gravity: 0,
      projectile: true,
      sx, sy,
      tx: tx + (Math.random() - 0.5) * WELL_W,
      ty: ty + (Math.random() - 0.5) * 120,
      arc: (Math.random() - 0.5) * 160,
      onArrive: () => {
        this.spawnBurst(tx, ty, color, 6, 3);
        target.incomingFlash = 1;
      },
    });
  }

  private updateParticles(dtMs: number) {
    for (const p of this.particles) {
      p.life += dtMs;
      const t = p.life / p.maxLife;
      if (p.projectile) {
        const e = 1 - Math.pow(1 - Math.min(1, t), 2);
        p.x = p.sx! + (p.tx! - p.sx!) * e;
        p.y = p.sy! + (p.ty! - p.sy!) * e + Math.sin(e * Math.PI) * p.arc!;
        p.alpha = 1;
        if (t >= 1 && p.onArrive) {
          p.onArrive();
          p.onArrive = undefined;
        }
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.alpha = Math.max(0, 1 - t);
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
  }

  private drawParticles() {
    const g = this.particleGfx;
    g.clear();
    for (const p of this.particles) {
      if (p.square) {
        g.rect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2).fill({ color: p.color, alpha: p.alpha });
      } else {
        g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
        if (p.projectile) {
          g.circle(p.x, p.y, p.size * 2.1).fill({ color: p.color, alpha: p.alpha * 0.22 });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Main update / draw
  // -------------------------------------------------------------------------
  public update(dtMs: number) {
    this.time += dtMs;
    const dt = dtMs / 16.667;

    this.drawBackground(dtMs);
    this.updateBoardVisual(this.player, this.engine.getPlayerBoard(), dt);
    this.updateBoardVisual(this.opponent, this.engine.getOpponentBoard(), dt);

    this.updateParticles(dtMs);
    this.drawParticles();

    this.drawDivider();
    this.drawMatchTime();
    this.drawOverlay(dt);
    this.drawCountdown();
  }

  private decay(v: number, rate: number, dt: number): number {
    const nv = v - rate * dt;
    return nv < 0.001 ? 0 : nv;
  }

  private updateBoardVisual(v: BoardVisual, board: BoardState, dt: number) {
    // Per-board screen shake
    const shake = Math.min(1, v.trauma + this.globalTrauma);
    const mag = shake * shake * 18;
    const ox = (Math.random() - 0.5) * mag;
    const oy = (Math.random() - 0.5) * mag;
    const baseX = v.isPlayer ? PLAYER_X : OPP_X;
    v.container.position.set(baseX + ox, PANEL_Y + oy);
    v.trauma = this.decay(v.trauma, 0.05, dt);

    // Ease animation timers
    v.eqPop = this.decay(v.eqPop, 0.09, dt);
    v.eqWrong = this.decay(v.eqWrong, 0.08, dt);
    v.sendPop = this.decay(v.sendPop, 0.06, dt);
    v.progressPulse = this.decay(v.progressPulse, 0.06, dt);
    v.chargePulse = this.decay(v.chargePulse, 0.04, dt);
    v.incomingFlash = this.decay(v.incomingFlash, 0.06, dt);
    v.hurtFlash = this.decay(v.hurtFlash, 0.05, dt);
    v.abilityFlash = this.decay(v.abilityFlash, 0.04, dt);
    v.dangerPulse += dt * 0.12;

    // --- Text content ---
    v.equationText.text = board.activeQuestion ? board.activeQuestion.text : "";
    const playing = this.engine.getState() === "PLAYING";
    const caret = Math.floor(this.time / 400) % 2 === 0 ? "_" : " ";
    v.inputText.text = board.inputBuffer || (playing && v.isPlayer ? caret : "");
    if (this.engine.isZenMode()) {
      const matchTimeSec = this.engine.getMatchTimeSec();
      const sps = board.solvedCount / Math.max(1, matchTimeSec);
      const spm = sps * 60;
      v.statsText.text = `${board.solvedCount} SOLVED  ·  ${sps.toFixed(2)} SPS  ·  ${spm.toFixed(0)} SPM  ·  ${(board.getAccuracyRate() * 100).toFixed(0)}% ACC`;
    } else {
      v.statsText.text = `${board.solvedCount}  ·  ${(board.getAccuracyRate() * 100).toFixed(0)}%`;
    }

    for (let i = 0; i < 3; i++) {
      v.previewTexts[i].text = board.previewQueue[i] ? board.previewQueue[i].text : "";
    }

    // Disrupt feedback text
    if (v.sendPop > 0) {
      v.sendText.alpha = v.sendPop;
    } else {
      v.sendText.text = "";
    }

    // --- Equation squash-pop + wrong jitter/tint ---
    const pop = v.eqPop;
    const sX = 1 + 0.32 * pop;
    const sY = 1 - 0.18 * pop;
    const jitter = v.eqWrong > 0 ? Math.sin(this.time / 22) * v.eqWrong * 6 : 0;
    v.equationText.scale.set(sX, sY);
    v.equationText.x = CONTENT_CX + jitter;
    v.equationText.tint = v.eqWrong > 0 ? this.mix(COL.textHi, COL.danger, v.eqWrong) : COL.textHi;

    // Send text bounce
    const cScale = 1 + v.sendPop * 0.4;
    v.sendText.scale.set(cScale);
    v.sendText.tint = this.mix(COL.disrupt, 0xffffff, v.sendPop * 0.6);

    // --- Ability box state ---
    const cd = board.disruptCooldown;
    const ready = cd <= 0 && board.progress >= EARLY_SEND_MIN;
    const onCooldown = cd > 0;

    // Flash when transitioning from cooldown to ready
    if (!onCooldown && board.progress >= EARLY_SEND_MIN && v.abilityCdText.text.includes(".")) {
      v.abilityFlash = 1;
    }

    if (onCooldown) {
      const secs = (cd / 1000).toFixed(1);
      v.abilityCdText.text = `${secs}s`;
      v.abilityCdText.style.fill = COL.textDim;
      v.abilityLabel.style.fill = COL.disruptDim;
    } else if (board.progress < EARLY_SEND_MIN) {
      v.abilityCdText.text = `${board.progress}/${EARLY_SEND_MIN}`;
      v.abilityCdText.style.fill = COL.textDim;
      v.abilityLabel.style.fill = COL.disruptDim;
    } else {
      v.abilityCdText.text = v.isPlayer ? "[SPACE]" : "READY";
      v.abilityCdText.style.fill = COL.disrupt;
      v.abilityLabel.style.fill = COL.disrupt;
    }

    // --- Draw the panel + meters + ability ---
    this.drawPanel(v, board);
    this.drawMeters(v, board);
    this.drawAbilityBox(v, board, ready, onCooldown, cd);
  }

  private drawPanel(v: BoardVisual, board: BoardState) {
    const g = v.panelGfx;
    g.clear();

    const dangerRatio = board.garbage / GARBAGE_CAPACITY;
    const dpulse = dangerRatio >= 0.7 ? 0.5 + 0.5 * Math.sin(v.dangerPulse) : 0;

    // Outer glow when hurt or in danger
    const glow = Math.max(v.hurtFlash, dpulse * 0.6);
    if (glow > 0.02) {
      g.roundRect(-6, -6, PANEL_W + 12, PANEL_H + 12, 18)
        .fill({ color: COL.danger, alpha: 0.18 * glow });
    }

    // Panel body
    g.roundRect(0, 0, PANEL_W, PANEL_H, 14).fill({ color: COL.panel });
    g.roundRect(0, 0, PANEL_W, PANEL_H, 14).stroke({ color: v.accent, width: 2, alpha: 0.55 });
    g.moveTo(14, 1).lineTo(PANEL_W - 14, 1).stroke({ color: 0xffffff, width: 1, alpha: 0.06 });

    // Header bar
    g.roundRect(0, 0, PANEL_W, 52, 14).fill({ color: COL.header });
    g.rect(0, 40, PANEL_W, 12).fill({ color: COL.header });
    g.rect(0, 51, PANEL_W, 1).fill({ color: v.accent, alpha: 0.4 });
    g.roundRect(12, 17, 4, 18, 2).fill({ color: v.accent });

    // Equation card
    g.roundRect(CONTENT_X, 68, CONTENT_W, 124, 10).fill({ color: 0x10131f });
    g.roundRect(CONTENT_X, 68, CONTENT_W, 124, 10)
      .stroke({ color: v.accent, width: 2, alpha: 0.25 + 0.55 * v.eqPop });

    // Input underline
    g.roundRect(CONTENT_X + 50, 252, CONTENT_W - 100, 3, 2)
      .fill({ color: v.accent, alpha: 0.35 });

    // Hurt flash veil
    if (v.hurtFlash > 0.02) {
      g.roundRect(0, 0, PANEL_W, PANEL_H, 14).fill({ color: COL.danger, alpha: 0.16 * v.hurtFlash });
    }
  }

  private drawMeters(v: BoardVisual, board: BoardState) {
    const g = v.meterGfx;
    g.clear();

    // --- Garbage well ---
    g.roundRect(WELL_X - 4, WELL_TOP - 6, WELL_W + 8, WELL_BOTTOM - WELL_TOP + 12, 8)
      .fill({ color: 0x0c0f19 })
      .stroke({ color: COL.panelEdge, width: 1.5 });

    for (let i = 0; i < GARBAGE_CAPACITY; i++) {
      const y = WELL_BOTTOM - (i + 1) * ROW_H - i * ROW_GAP;
      const filled = i < board.garbage;
      if (filled) {
        g.rect(WELL_X, y, WELL_W, ROW_H).fill({ color: COL.garbage });
        g.rect(WELL_X, y, WELL_W, 3).fill({ color: COL.garbageTop, alpha: 0.9 });
        g.rect(WELL_X, y + ROW_H - 3, WELL_W, 3).fill({ color: COL.garbageDeep, alpha: 0.8 });
      } else {
        g.rect(WELL_X, y, WELL_W, ROW_H).fill({ color: COL.cellEmpty });
        g.rect(WELL_X, y, WELL_W, ROW_H).stroke({ color: COL.cellEmptyEdge, width: 1 });
      }
    }

    // Danger cap when topped up
    if (board.garbage >= GARBAGE_CAPACITY) {
      const pulse = 0.5 + 0.5 * Math.sin(v.dangerPulse * 1.6);
      g.roundRect(WELL_X - 4, WELL_TOP - 6, WELL_W + 8, WELL_BOTTOM - WELL_TOP + 12, 8)
        .stroke({ color: COL.danger, width: 2.5, alpha: 0.4 + 0.6 * pulse });
    }

    // --- Incoming garbage ghost cells ---
    const incoming = board.getIncomingTotal();
    if (incoming > 0) {
      const flash = 0.55 + 0.45 * Math.sin(this.time / 90);
      let stacked = board.garbage;
      for (const p of board.incomingQueue) {
        const ready = 1 - Math.max(0, p.delayMs) / p.totalDelayMs;
        for (let k = 0; k < p.power && stacked < GARBAGE_CAPACITY; k++, stacked++) {
          const y = WELL_BOTTOM - (stacked + 1) * ROW_H - stacked * ROW_GAP;
          const col = this.mix(COL.warn, COL.danger, ready);
          g.rect(WELL_X + 3, y + 3, WELL_W - 6, ROW_H - 6)
            .stroke({ color: col, width: 2, alpha: (0.5 + 0.5 * ready) * flash });
        }
      }
      const aAlpha = (0.5 + 0.5 * Math.sin(this.time / 80)) * Math.max(v.incomingFlash, 0.5);
      g.moveTo(WELL_X + WELL_W / 2 - 8, WELL_BOTTOM + 12)
        .lineTo(WELL_X + WELL_W / 2, WELL_BOTTOM + 22)
        .lineTo(WELL_X + WELL_W / 2 + 8, WELL_BOTTOM + 12)
        .stroke({ color: COL.danger, width: 3, alpha: aAlpha });
    }

    // --- Progress charge bar ---
    const segW = PROG_W / PROGRESS_CAPACITY;
    const chargeGlow = v.chargePulse;
    for (let i = 0; i < PROGRESS_CAPACITY; i++) {
      const x = PROG_X + i * segW;
      const on = i < board.progress;
      g.roundRect(x + 1.5, PROG_Y, segW - 3, PROG_H, 3).fill({ color: COL.cellEmpty });
      if (on) {
        const glw = chargeGlow > 0 ? chargeGlow : i === board.progress - 1 ? v.progressPulse : 0;
        const col = this.mix(v.accent, 0xffffff, glw * 0.7);
        g.roundRect(x + 1.5, PROG_Y, segW - 3, PROG_H, 3).fill({ color: col });
        g.roundRect(x + 1.5, PROG_Y, segW - 3, 3, 3).fill({ color: 0xffffff, alpha: 0.35 });
      } else {
        g.roundRect(x + 1.5, PROG_Y, segW - 3, PROG_H, 3).stroke({ color: COL.cellEmptyEdge, width: 1 });
      }
    }
    if (chargeGlow > 0.02) {
      g.roundRect(PROG_X, PROG_Y - 3, PROG_W, PROG_H + 6, 5)
        .stroke({ color: v.accent, width: 2, alpha: chargeGlow });
    }
  }

  private drawAbilityBox(v: BoardVisual, board: BoardState, ready: boolean, onCooldown: boolean, cd: number) {
    const g = v.abilityGfx;
    g.clear();

    const bx = ABILITY_X;
    const by = ABILITY_Y;
    const bw = ABILITY_W;
    const bh = ABILITY_H;

    const insetX = 16;
    const insetY = 5;

    const tx = bx + insetX;
    const ty = by + insetY;
    const tw = bw - insetX * 2;
    const th = bh - insetY * 2 - 2;

    let fillRatio = 0;
    if (ready) {
      fillRatio = 1;
    } else if (onCooldown) {
      fillRatio = 1 - cd / DISRUPT_COOLDOWN_MS;
    } else {
      fillRatio = Math.min(1, board.progress / EARLY_SEND_MIN);
    }

    // 1. Draw black background slot
    g.moveTo(bx + 4, by)
      .lineTo(bx + bw - 4, by)
      .lineTo(bx + bw, by + bh - 6)
      .lineTo(bx + bw - 4, by + bh)
      .lineTo(bx + 4, by + bh)
      .lineTo(bx, by + bh - 6)
      .closePath()
      .fill({ color: 0x07090f });

    // 2. Draw slanted front-facing shadow wall
    g.moveTo(tx, ty + th)
      .lineTo(tx + tw, ty + th)
      .lineTo(bx + bw - 6, by + bh - 4)
      .lineTo(bx + 6, by + bh - 4)
      .closePath()
      .fill({ color: 0x0c0f1b });

    // 3. Draw slanted left side wall
    g.moveTo(bx + 6, by + 2)
      .lineTo(tx, ty)
      .lineTo(tx, ty + th)
      .lineTo(bx + 6, by + bh - 4)
      .closePath()
      .fill({ color: 0x1d2436 });

    // 4. Draw slanted right side wall
    g.moveTo(bx + bw - 6, by + 2)
      .lineTo(tx + tw, ty)
      .lineTo(tx + tw, ty + th)
      .lineTo(bx + bw - 6, by + bh - 4)
      .closePath()
      .fill({ color: 0x0a0d17 });

    // 5. Draw keycap top face background
    g.rect(tx, ty, tw, th)
      .fill({ color: 0x141826 })
      .stroke({ color: 0x232a41, width: 1 });

    // 4. Fill progress indicator (fills horizontally from left to right)
    const fillColor = ready ? COL.disrupt : onCooldown ? COL.warn : COL.disruptDim;
    const fillAlpha = ready ? 0.35 + 0.15 * Math.sin(this.time / 150) : 0.25;

    if (fillRatio > 0) {
      const fillW = Math.floor(tw * fillRatio);
      g.rect(tx, ty, fillW, th)
        .fill({ color: fillColor, alpha: fillAlpha });
      if (fillRatio < 1) {
        g.rect(tx + fillW - 2, ty, 2, th)
          .fill({ color: fillColor, alpha: 0.8 });
      }
    }

    // 5. Draw 3D highlights and shadows on keycap face
    const highlightColor = ready ? COL.disrupt : 0x39415f;
    g.moveTo(tx, ty + th)
      .lineTo(tx, ty)
      .lineTo(tx + tw, ty)
      .stroke({ color: highlightColor, width: 2, alpha: ready ? 0.8 : 0.4 });

    const shadowColor = ready ? COL.disruptDim : 0x0c0e17;
    g.moveTo(tx + tw, ty)
      .lineTo(tx + tw, ty + th)
      .lineTo(tx, ty + th)
      .stroke({ color: shadowColor, width: 2, alpha: ready ? 0.8 : 0.6 });

    // 6. Draw bezel border outline around keycap
    const bezelColor = ready ? COL.disrupt : 0x232a41;
    const bezelAlpha = ready ? 0.9 + 0.1 * Math.sin(this.time / 200) : 0.5;

    g.moveTo(bx + 4, by)
      .lineTo(bx + bw - 4, by)
      .lineTo(bx + bw, by + 4)
      .lineTo(bx + bw, by + bh - 6)
      .lineTo(bx + bw - 4, by + bh)
      .lineTo(bx + 4, by + bh)
      .lineTo(bx, by + bh - 6)
      .lineTo(bx, by + 4)
      .closePath()
      .stroke({ color: bezelColor, width: 2, alpha: bezelAlpha });

    // 7. Ready neon pulse ring
    if (ready) {
      g.roundRect(bx - 3, by - 3, bw + 6, bh + 6, 6)
        .stroke({ color: COL.disrupt, width: 2, alpha: 0.2 + 0.15 * Math.sin(this.time / 120) });
    }

    // 8. Flash overlay
    if (v.abilityFlash > 0.02) {
      g.moveTo(bx + 4, by)
        .lineTo(bx + bw - 4, by)
        .lineTo(bx + bw, by + bh - 6)
        .lineTo(bx + bw - 4, by + bh)
        .lineTo(bx + 4, by + bh)
        .lineTo(bx, by + bh - 6)
        .closePath()
        .fill({ color: COL.disrupt, alpha: 0.35 * v.abilityFlash });
    }
  }

  // -------------------------------------------------------------------------
  // Shared / overlay drawing
  // -------------------------------------------------------------------------
  private drawBackground(dtMs: number) {
    this.bgScroll = (this.bgScroll + dtMs * 0.012) % 40;
    const g = this.bgGfx;
    g.clear();
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    g.rect(0, 0, w, h).fill({ color: COL.bg });

    const step = 40;
    const off = this.bgScroll;
    for (let x = -step + off; x < w; x += step) {
      g.moveTo(x, 0).lineTo(x, h).stroke({ color: COL.gridLine, width: 1, alpha: 0.5 });
    }
    for (let y = -step + off; y < h; y += step) {
      g.moveTo(0, y).lineTo(w, y).stroke({ color: COL.gridLine, width: 1, alpha: 0.5 });
    }
  }

  private drawDivider() {
    if (this.engine.isZenMode()) return;
    const g = this.dividerGfx;
    g.clear();
    const x = this.app.screen.width / 2;
    for (let y = PANEL_Y; y < PANEL_Y + PANEL_H; y += 16) {
      g.moveTo(x, y).lineTo(x, y + 8).stroke({ color: 0x2a3350, width: 2, alpha: 0.6 });
    }
    g.circle(x, PANEL_Y + PANEL_H / 2, 24).fill({ color: COL.header }).stroke({ color: 0x39415f, width: 2 });
  }

  private drawMatchTime() {
    const isZen = this.engine.isZenMode();
    const limit = isZen ? this.engine.getZenDurationLimit() : 0;

    let displaySec = this.engine.getMatchTimeSec();
    if (isZen && limit > 0) {
      displaySec = Math.max(0, limit - displaySec);
    }

    const m = Math.floor(displaySec / 60);
    const s = Math.floor(displaySec % 60);
    const d = Math.floor((displaySec % 1) * 10);
    this.matchTimeText.text = `${m}:${s.toString().padStart(2, "0")}.${d}`;
  }

  private drawOverlay(dt: number) {
    this.globalTrauma = this.decay(this.globalTrauma, 0.04, dt);
    this.globalFlash = this.decay(this.globalFlash, 0.05, dt);

    const g = this.overlayGfx;
    g.clear();

    const gm = this.globalTrauma * this.globalTrauma * 14;
    this.container.position.set((Math.random() - 0.5) * gm, (Math.random() - 0.5) * gm);

    if (this.globalFlash > 0.02) {
      g.rect(-40, -40, this.app.screen.width + 80, this.app.screen.height + 80)
        .fill({ color: 0xffffff, alpha: 0.25 * this.globalFlash });
    }
  }

  private drawCountdown() {
    const state = this.engine.getState();
    if (state !== "COUNTDOWN") {
      this.countdownText.visible = false;
      this.countdownSub.visible = false;
      return;
    }
    this.countdownText.visible = true;
    this.countdownSub.visible = true;

    const val = this.engine.getCountdownValue();
    const pct = this.engine.getCountdownPercentage();
    if (val > 0) {
      this.countdownText.text = val.toString();
      const scale = 0.85 + pct * 0.7;
      this.countdownText.scale.set(scale);
      this.countdownText.alpha = Math.min(1, pct * 1.6);
      this.countdownText.tint = this.mix(ACCENT.player, ACCENT.opponent, 1 - pct);
      this.countdownSub.text = "GET READY";
      this.countdownSub.alpha = 0.6;
    } else {
      this.countdownText.text = "GO!";
      const s = 1.2 + (1 - Math.min(1, (this.time % 1000) / 300)) * 0.4;
      this.countdownText.scale.set(s);
      this.countdownText.alpha = 1;
      this.countdownText.tint = COL.gold;
      this.countdownSub.text = "";
    }
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------
  private mix(a: number, b: number, t: number): number {
    t = Math.max(0, Math.min(1, t));
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const gg = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (gg << 8) | bl;
  }

  public destroy() {
    this.container.destroy({ children: true });
  }
}
