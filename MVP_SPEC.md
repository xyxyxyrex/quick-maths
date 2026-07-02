# Calculator Arena
## MVP Technical Specification
Version: 0.1

---

# Project Vision

Calculator Arena is a competitive, fast-paced, keyboard-first multiplayer game inspired by:

- TETR.IO
- osu!
- Chess.com
- GeoGuessr Duels

This is NOT an educational application.

The objective is to create a game where mathematical pattern recognition feels like a rhythm game.

Players should experience:

- Flow state
- Constant pressure
- Immediate feedback
- High APM gameplay
- Competitive depth
- Spectator-friendly mechanics

Gameplay should consist almost entirely of solving equations as quickly and accurately as possible.

Menus should disappear once the match begins.

The player should never wait.

---

# MVP Goal

The first version is entirely local.

There are:

- No accounts
- No authentication
- No database
- No cloud deployment
- No multiplayer networking

Instead:

Human Player

VS

Local AI

The architecture MUST be modular enough that the AI can later be replaced by a NetworkPlayerController without changing gameplay logic.

---

# Technology Stack

Frontend

- React
- TypeScript
- Vite
- PixiJS
- Zustand
- TailwindCSS
- shadcn/ui
- Anime.js
- Howler.js

Backend (future)

- Node.js
- Fastify
- Native WebSockets

Database (future)

- PostgreSQL
- Prisma

Cache (future)

- Redis

---

# High Level Architecture

Separate the project into two independent systems.

Application Layer

Responsible for:

- Main Menu
- Settings
- Game Results
- Future Profile
- Future Matchmaking

Built entirely using React.

Gameplay should never depend on React rendering.

---

Game Layer

Responsible for:

- Rendering
- Animation
- Input
- Audio
- Question queue
- Game state
- Combat logic

Implemented entirely using PixiJS.

The gameplay layer should own its own update loop.

---

# Core Gameplay Philosophy

Every answer matters.

Every answer should either:

- Build pressure
- Reduce pressure
- Maintain combo

The player should always feel like they are either attacking or defending.

No answer should ever feel wasted.

---

# Match Flow

Countdown

3

2

1

GO

↓

Generate deterministic question sequence.

↓

Begin gameplay immediately.

↓

Players continuously solve equations.

↓

Progress builds toward attack.

↓

Attacks generate garbage.

↓

Garbage weakens future attacks.

↓

First player reaching maximum garbage loses.

---

# Match Generation

Every match begins with a deterministic seed.

Example

Seed:

918273645

From this seed generate:

Main Question Queue

Q1

Q2

Q3

...

Q300

Every player receives the exact same question order.

This guarantees fairness.

Questions must NEVER be generated independently for each player.

---

# Question Generator

Questions are generated procedurally.

No static database.

Categories

Addition

Subtraction

Multiplication

Division

Squares

Complements

Mixed arithmetic

Difficulty should increase gradually throughout the match.

Target solve time

0.8–2.5 seconds.

Questions should reward recognition rather than long calculations.

Avoid calculator-level arithmetic.

---

# Example Questions

8 + 7

17 + 29

99 - 48

18 × 7

25 × 16

125 × 8

15²

144 ÷ 12

1000 - 257

---

# Input

Keyboard only.

Support:

Top row numbers

Numpad

Backspace

Enter

Mouse should never be required during gameplay.

---

# Board

Each player owns a board.

The board contains:

Progress Stacks

Garbage Stacks

Incoming Garbage Queue

Current Question

Combo

Accuracy

Questions Solved

---

# Progress Stacks

Each correct answer grants:

+1 Progress Stack

Progress stacks represent offensive pressure.

Maximum:

10

Example

□□□□□□□□□□

↓

■■□□□□□□□□

↓

■■■■■□□□□□

↓

■■■■■■■■■■

Complete.

---

# Garbage Stacks

Garbage represents defensive pressure.

Garbage occupies space on the board.

Garbage does NOT prevent answering questions.

Instead:

Garbage weakens future attacks.

Maximum:

10

If Garbage reaches:

10

The player immediately loses.

---

# Completing a Progress Cycle

When Progress reaches 10:

Calculate attack.

Formula

Attack

=

10

-

Current Garbage

Example

Progress

10

Garbage

3

Attack

=

7

Progress immediately resets to zero.

Garbage remains.

---

# Incoming Garbage

Attacks are NOT applied instantly.

Instead:

Attack enters the opponent's Incoming Queue.

Example

Incoming

██████

Incoming garbage waits briefly before being applied.

This creates opportunities for counterplay.

---

# Garbage Cancellation

While garbage is still incoming:

The defending player may launch attacks of their own.

Incoming garbage is cancelled before application.

Example

Player A attacks:

7

Player B attacks:

5

Result

Opponent receives:

2 Garbage

This mirrors garbage cancellation found in competitive Tetris.

---

# Garbage Application

After the incoming delay:

Remaining garbage is added to the player's Garbage meter.

Example

Current Garbage

3

Incoming

2

↓

Garbage

5

---

# Win Condition

Player loses immediately when

Garbage

=

10

No HP system exists.

The board itself represents survival.

---

# Combo System

Every consecutive correct answer increases combo.

Example

1

2

3

4

5

Missing a question resets combo.

Combo may later influence:

Visual effects

Sound

Future scoring

Ranking statistics

Do NOT use combo to increase attack power during MVP.

Keep attack calculation simple.

---

# AI

The AI should simulate a human.

Never cheat.

Easy

Reaction

1.8–3.2 sec

Accuracy

85%

Medium

1.2–2.2 sec

92%

Hard

0.8–1.5 sec

97%

Impossible

0.45–0.9 sec

99%

Reaction times should include randomness.

Occasionally make believable mistakes.

---

# HUD

Display

Player Garbage

Enemy Garbage

Progress

Incoming Queue

Combo

Current Equation

Current Input

Accuracy

Questions Solved

FPS Counter

Everything should be readable at a glance.

---

# Visual Style

Inspired by

TETR.IO

Retro arcade

CRT

Minimal

Dark

Neon

Animations should be subtle but frequent.

---

# Animation Principles

Every interaction should produce feedback.

Correct Answer

Small flash

Scale pop

Particle burst

Garbage Sent

Pulse

Travel animation

Incoming Queue

Smooth fill

Garbage Applied

Board shake

Red flash

Question Change

Slide

Fade

Animation duration should rarely exceed

150ms

Gameplay must remain uninterrupted.

---

# Audio

Every interaction needs audio feedback.

Correct

Short tick

Combo

Higher pitch

Garbage Sent

Impact

Incoming Warning

Alert

Lose

Distinct sound

Sounds should be extremely short.

---

# Performance Goals

Minimum

60 FPS

Target

144 FPS

Avoid unnecessary React rendering.

Gameplay should run independently.

---

# Code Organization

Separate

Rendering

Logic

Audio

Networking

Input

Question generation

Game rules

Never mix gameplay logic with rendering.

Never mix rendering with React UI.

---

# Future Multiplayer

The MVP should already support replacing the AI.

Define a generic interface.

Example

IPlayerController

Implementations

HumanPlayerController

AIPlayerController

NetworkPlayerController (future)

The game engine should never know which implementation is controlling the player.

---

# Future Backend

Later phases should introduce

Authentication

Profiles

Matchmaking

WebSocket server

PostgreSQL

Redis

Ranked play

Glicko-2

Friends

Leaderboards

Cloud deployment

None of these systems should require changing gameplay logic.

---

# MVP Success Criteria

The MVP is complete when:

✓ Local game launches

✓ Human vs AI works

✓ Infinite procedural questions

✓ Progress stacks work

✓ Garbage system works

✓ Incoming queue works

✓ Garbage cancellation works

✓ Win condition works

✓ Smooth animations

✓ Responsive keyboard input

✓ Stable 60+ FPS

✓ Modular architecture ready for online multiplayer


ne major change I'd make before implementation

After thinking through the mechanics, I would not make questions appear one at a time.

Instead, I'd show a vertical queue of upcoming equations, similar to your mockup:

┌───────────────────────┐
│     ACTIVE QUESTION   │
├───────────────────────┤
│                       │
│  36 × 2               │
│                       │
├───────────────────────┤
│ 18 × 7                │
│ 99 - 48               │
│ 25 × 16               │
│ 144 ÷ 12              │
│ 15²                   │
└───────────────────────┘

When the active question is solved:

the next question immediately slides into the active slot,
the queue shifts upward,
a newly generated question enters at the bottom.

This has several advantages:

It gives players a chance to read ahead, much like Tetris players preview upcoming pieces.
It rewards anticipation and pattern recognition, increasing the skill ceiling.
It makes the game more engaging to watch, because spectators can see what challenges are coming next.

That preview queue may end up being as fundamental to your game's identity as the "next piece" preview is to modern Tetris.