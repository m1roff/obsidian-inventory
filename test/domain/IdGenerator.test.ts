import { describe, expect, it } from "vitest";
import { IdGenerator, RandomSource } from "../../src/domain/IdGenerator";

const sequence = (values: number[]): RandomSource => {
  let index = 0;
  return { nextInt: (max) => values[index++ % values.length] % max };
};
const real: RandomSource = { nextInt: (max) => Math.floor(Math.random() * max) };

describe("IdGenerator", () => {
  it("builds item ids like AB-CD-123 without confusable letters", () => {
    const generator = new IdGenerator(real);
    for (let i = 0; i < 300; i++) {
      expect(generator.generate("item", new Set())).toMatch(/^[A-HJKMN-Z]{2}-[A-HJKMN-Z]{2}-\d{3}$/);
    }
  });

  it("builds place ids with the reserved prefix LC", () => {
    const generator = new IdGenerator(real);
    for (let i = 0; i < 300; i++) {
      expect(generator.generate("place", new Set())).toMatch(/^LC-[A-HJKMN-Z]{2}-\d{3}$/);
    }
  });

  it("never gives an item a reserved prefix", () => {
    // letters K,D = KD (reserved), then A,B = AB
    const generator = new IdGenerator(sequence([9, 3, 0, 1, 2, 3, 1, 2, 3]));
    // index 9 = K, 3 = D -> "KD" is reserved and skipped; next two letters 0,1 = "AB"
    expect(generator.generate("item", new Set())).toMatch(/^AB-/);
  });

  it("keeps all five reserved prefixes away from items", () => {
    const generator = new IdGenerator(real);
    const reserved = ["LC-", "KD-", "TG-", "KT-", "PR-"];
    for (let i = 0; i < 20000; i++) {
      const id = generator.generate("item", new Set());
      expect(reserved.some((prefix) => id.startsWith(prefix))).toBe(false);
    }
  });

  it("uses the random source for every position", () => {
    // item: prefix A,B; middle C,D; digits 1,2,3
    expect(new IdGenerator(sequence([0, 1, 2, 3, 1, 2, 3])).generate("item", new Set())).toBe("AB-CD-123");
    // place: no random prefix; middle A,B; digits 1,2,3
    expect(new IdGenerator(sequence([0, 1, 1, 2, 3])).generate("place", new Set())).toBe("LC-AB-123");
  });

  it("retries on a collision", () => {
    const generator = new IdGenerator(sequence([0, 1, 2, 3, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0]));
    expect(generator.generate("item", new Set(["AB-CD-123"]))).toBe("AA-AA-000");
  });

  it("gives up when nothing is free", () => {
    const generator = new IdGenerator(sequence([0]));
    expect(() => generator.generate("item", new Set(["AA-AA-000"]))).toThrow();
  });
});
