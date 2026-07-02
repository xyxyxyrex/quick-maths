export interface Question {
  text: string;
  answer: number;
  category: string;
}

export class DeterministicPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed || 1;
  }

  // Returns a value between 0 (inclusive) and 1 (exclusive)
  next(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    this.state = (a * this.state + c) % m;
    return this.state / m;
  }

  // Returns a random integer in range [min, max] (inclusive)
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export type ZenQuestionDifficulty = "easy" | "medium" | "hard" | "impossible" | "progressive" | "random";

export function generateQuestion(index: number, seed: number, zenDifficulty?: ZenQuestionDifficulty): Question {
  // Combine seed and index to get a deterministic PRNG for this specific question position
  const prng = new DeterministicPRNG(seed + index * 104729); // Use a prime offset for better distribution

  // Determine difficulty tier based on question index or Zen difficulty setting
  let tier: number;
  if (zenDifficulty) {
    if (zenDifficulty === "easy") {
      tier = prng.nextInt(1, 2);
    } else if (zenDifficulty === "medium") {
      tier = prng.nextInt(3, 4);
    } else if (zenDifficulty === "hard") {
      tier = prng.nextInt(5, 5); // T5 is double digit multiplication/complements of 1000/25s
    } else if (zenDifficulty === "impossible") {
      tier = 6;
    } else if (zenDifficulty === "random") {
      tier = prng.nextInt(1, 6);
    } else {
      // progressive
      tier = getProgressiveTier(index);
    }
  } else {
    tier = getProgressiveTier(index);
  }

  function getProgressiveTier(idx: number): number {
    if (idx < 10) return 1;
    if (idx < 25) return 2;
    if (idx < 55) return 3;
    if (idx < 100) return 4;
    if (idx < 170) return 5;
    return 6;
  }

  // Sub-select a category within the tier
  switch (tier) {
    case 1: {
      // Single digit Addition / Subtraction, or Complements of 10
      const type = prng.nextInt(0, 2);
      if (type === 0) {
        const a = prng.nextInt(1, 9);
        const b = prng.nextInt(1, 9);
        return { text: `${a} + ${b}`, answer: a + b, category: "Addition" };
      } else if (type === 1) {
        const b = prng.nextInt(1, 9);
        const a = prng.nextInt(b + 1, 18);
        return { text: `${a} - ${b}`, answer: a - b, category: "Subtraction" };
      } else {
        const a = prng.nextInt(1, 9);
        return { text: `10 - ${a}`, answer: 10 - a, category: "Complements" };
      }
    }

    case 2: {
      // Double digit Add/Sub no carry, and easy multiplication tables (x2, x3, x5)
      const type = prng.nextInt(0, 2);
      if (type === 0) {
        // Add no carry (ones digits sum <= 9)
        const a1 = prng.nextInt(1, 8);
        const a0 = prng.nextInt(0, 9);
        const b1 = prng.nextInt(1, 9 - a1);
        const b0 = prng.nextInt(0, 9 - a0);
        const a = a1 * 10 + a0;
        const b = b1 * 10 + b0;
        return { text: `${a} + ${b}`, answer: a + b, category: "Addition" };
      } else if (type === 1) {
        // Sub no borrow (a0 >= b0, a1 >= b1)
        const a1 = prng.nextInt(2, 9);
        const a0 = prng.nextInt(1, 9);
        const b1 = prng.nextInt(1, a1);
        const b0 = prng.nextInt(0, a0);
        const a = a1 * 10 + a0;
        const b = b1 * 10 + b0;
        return { text: `${a} - ${b}`, answer: a - b, category: "Subtraction" };
      } else {
        // Easy multiplication
        const a = prng.nextInt(2, 9);
        const multipliers = [2, 3, 5, 10];
        const b = multipliers[prng.nextInt(0, multipliers.length - 1)];
        return { text: `${a} × ${b}`, answer: a * b, category: "Multiplication" };
      }
    }

    case 3: {
      // Double digit Add/Sub with carry/borrow, Standard multiplication tables
      const type = prng.nextInt(0, 2);
      if (type === 0) {
        const a = prng.nextInt(11, 89);
        const b = prng.nextInt(11, 89);
        return { text: `${a} + ${b}`, answer: a + b, category: "Addition" };
      } else if (type === 1) {
        const a = prng.nextInt(21, 99);
        const b = prng.nextInt(11, a - 5);
        return { text: `${a} - ${b}`, answer: a - b, category: "Subtraction" };
      } else {
        const a = prng.nextInt(3, 9);
        const b = prng.nextInt(3, 9);
        return { text: `${a} × ${b}`, answer: a * b, category: "Multiplication" };
      }
    }

    case 4: {
      // Complements of 100, Squares up to 12, simple divisions
      const type = prng.nextInt(0, 2);
      if (type === 0) {
        const a = prng.nextInt(11, 99);
        return { text: `100 - ${a}`, answer: 100 - a, category: "Complements" };
      } else if (type === 1) {
        const a = prng.nextInt(2, 12);
        return { text: `${a}²`, answer: a * a, category: "Squares" };
      } else {
        // Division (reverse of standard times tables)
        const b = prng.nextInt(2, 9);
        const factor = prng.nextInt(2, 12);
        const a = b * factor;
        return { text: `${a} ÷ ${b}`, answer: factor, category: "Division" };
      }
    }

    case 5: {
      // 2-digit by 1-digit multiplication, complements of 1000, 25s multiplication
      const type = prng.nextInt(0, 2);
      if (type === 0) {
        const a = prng.nextInt(11, 19);
        const b = prng.nextInt(3, 9);
        return { text: `${a} × ${b}`, answer: a * b, category: "Multiplication" };
      } else if (type === 1) {
        const a = prng.nextInt(101, 999);
        return { text: `1000 - ${a}`, answer: 1000 - a, category: "Complements" };
      } else {
        // 25s multiplication (common speed-math trick)
        const factor = prng.nextInt(3, 16);
        return { text: `25 × ${factor}`, answer: 25 * factor, category: "Multiplication" };
      }
    }

    case 6:
    default: {
      // Squares up to 25, division tables up to 15, 125s multiplication, mixed arithmetic
      const type = prng.nextInt(0, 3);
      if (type === 0) {
        const a = prng.nextInt(13, 25);
        return { text: `${a}²`, answer: a * a, category: "Squares" };
      } else if (type === 1) {
        const b = prng.nextInt(11, 15);
        const factor = prng.nextInt(2, 15);
        const a = b * factor;
        return { text: `${a} ÷ ${b}`, answer: factor, category: "Division" };
      } else if (type === 2) {
        // 125s multiplication
        const factor = [4, 8, 12, 16][prng.nextInt(0, 3)];
        return { text: `125 × ${factor}`, answer: 125 * factor, category: "Multiplication" };
      } else {
        // Mixed arithmetic: (a + b) - c or a * b + c
        const a = prng.nextInt(10, 30);
        const b = prng.nextInt(10, 30);
        const c = prng.nextInt(5, 20);
        return { text: `${a} + ${b} - ${c}`, answer: a + b - c, category: "Mixed Arithmetic" };
      }
    }
  }
}
