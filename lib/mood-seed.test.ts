import { describe, it, expect } from "vitest";
import { buildMoodSeed } from "./mood-seed";
import { EMOTION_COLORS } from "@/app/types";

describe("buildMoodSeed", () => {
  const labels = Object.keys(EMOTION_COLORS);

  it("感情ラベルは 12 種", () => {
    expect(labels.length).toBe(12);
  });

  it("すべてのラベルで非空の種文を返す", () => {
    for (const label of labels) {
      expect(buildMoodSeed(label).trim().length).toBeGreaterThan(0);
    }
  });

  it("種文にラベルそのものが含まれる", () => {
    for (const label of labels) {
      expect(buildMoodSeed(label)).toContain(label);
    }
  });

  it("短文ティア（50 字以下＝gentle）に収まる", () => {
    for (const label of labels) {
      expect(buildMoodSeed(label).trim().length).toBeLessThanOrEqual(50);
    }
  });
});
