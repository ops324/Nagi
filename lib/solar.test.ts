import { describe, expect, it } from "vitest";
import {
  DEFAULT_LATITUDE,
  getSunTimes,
  getTimePhase,
  getTimePhaseByClock,
  longitudeFromUtcOffsetMinutes,
  type SunTimes,
} from "./solar";

// 実行環境の TZ に依存しないよう、期待値はすべて UTC の絶対時刻で比較する。
// （CI は UTC、開発機は JST で走るため）

const TOKYO = { lat: 35.6812, lon: 139.7671 };

function diffMinutes(actual: Date, expectedIso: string): number {
  return Math.abs(actual.getTime() - new Date(expectedIso).getTime()) / 60_000;
}

describe("getSunTimes", () => {
  it("東京の夏至（2026-06-21）の日の出・日の入りが実際の値と数分以内で一致する", () => {
    // 国立天文台の暦（東京）: 日の出 04:25 JST / 日の入り 19:00 JST
    // JST = UTC+9 なので 2026-06-20T19:25Z / 2026-06-21T10:00Z
    const sun = getSunTimes(new Date("2026-06-21T03:00:00Z"), TOKYO.lat, TOKYO.lon);
    expect(sun).not.toBeNull();
    expect(diffMinutes(sun!.sunrise, "2026-06-20T19:25:00Z")).toBeLessThan(3);
    expect(diffMinutes(sun!.sunset, "2026-06-21T10:00:00Z")).toBeLessThan(3);
  });

  it("東京の冬至（2026-12-21）の日の出・日の入りが実際の値と数分以内で一致する", () => {
    // 暦（東京）: 日の出 06:47 JST / 日の入り 16:32 JST
    const sun = getSunTimes(new Date("2026-12-21T03:00:00Z"), TOKYO.lat, TOKYO.lon);
    expect(sun).not.toBeNull();
    expect(diffMinutes(sun!.sunrise, "2026-12-20T21:47:00Z")).toBeLessThan(3);
    expect(diffMinutes(sun!.sunset, "2026-12-21T07:32:00Z")).toBeLessThan(3);
  });

  it("薄明・日の出・南中・日の入りの順序が保たれる", () => {
    const sun = getSunTimes(new Date("2026-09-15T03:00:00Z"), TOKYO.lat, TOKYO.lon)!;
    expect(sun.dawn.getTime()).toBeLessThan(sun.sunrise.getTime());
    expect(sun.sunrise.getTime()).toBeLessThan(sun.solarNoon.getTime());
    expect(sun.solarNoon.getTime()).toBeLessThan(sun.sunset.getTime());
    expect(sun.sunset.getTime()).toBeLessThan(sun.dusk.getTime());
  });

  it("薄明は日の出前・日の入り後の 20〜40 分に収まる（東京・春分）", () => {
    const sun = getSunTimes(new Date("2026-03-20T03:00:00Z"), TOKYO.lat, TOKYO.lon)!;
    const beforeSunrise = (sun.sunrise.getTime() - sun.dawn.getTime()) / 60_000;
    const afterSunset = (sun.dusk.getTime() - sun.sunset.getTime()) / 60_000;
    expect(beforeSunrise).toBeGreaterThan(20);
    expect(beforeSunrise).toBeLessThan(40);
    expect(afterSunset).toBeGreaterThan(20);
    expect(afterSunset).toBeLessThan(40);
  });

  it("白夜（北緯78°の夏）では null を返す", () => {
    expect(getSunTimes(new Date("2026-06-21T12:00:00Z"), 78, 15)).toBeNull();
  });

  it("極夜（北緯78°の冬）では null を返す", () => {
    expect(getSunTimes(new Date("2026-12-21T12:00:00Z"), 78, 15)).toBeNull();
  });
});

describe("longitudeFromUtcOffsetMinutes", () => {
  it("JST(+540分) は東経135°になる", () => {
    expect(longitudeFromUtcOffsetMinutes(540)).toBe(135);
  });

  it("UTC は経度0°、西側はマイナスになる", () => {
    expect(longitudeFromUtcOffsetMinutes(0)).toBe(0);
    expect(longitudeFromUtcOffsetMinutes(-300)).toBe(-75); // EST
  });

  it("範囲外のオフセットでも ±180° に収める", () => {
    expect(longitudeFromUtcOffsetMinutes(900)).toBe(180);
    expect(longitudeFromUtcOffsetMinutes(-900)).toBe(-180);
  });
});

describe("getTimePhase", () => {
  // 夜明け 05:00 / 日の出 05:30 / 南中 12:00 / 日の入り 18:30 / 薄明終わり 19:00 の一日
  const sun: SunTimes = {
    dawn: new Date("2026-04-01T05:00:00Z"),
    sunrise: new Date("2026-04-01T05:30:00Z"),
    solarNoon: new Date("2026-04-01T12:00:00Z"),
    sunset: new Date("2026-04-01T18:30:00Z"),
    dusk: new Date("2026-04-01T19:00:00Z"),
  };

  it("夜明け前は夜", () => {
    expect(getTimePhase(new Date("2026-04-01T04:59:00Z"), sun)).toBe("night");
  });

  it("夜明け直後から朝が始まる（日の出より前でも朝）", () => {
    expect(getTimePhase(new Date("2026-04-01T05:00:00Z"), sun)).toBe("morning");
    expect(getTimePhase(new Date("2026-04-01T05:20:00Z"), sun)).toBe("morning");
  });

  it("日の出 +2.5h までが朝、その後は昼", () => {
    expect(getTimePhase(new Date("2026-04-01T07:59:00Z"), sun)).toBe("morning");
    expect(getTimePhase(new Date("2026-04-01T08:00:00Z"), sun)).toBe("day");
  });

  it("日の入り -1.5h から夕になる", () => {
    expect(getTimePhase(new Date("2026-04-01T16:59:00Z"), sun)).toBe("day");
    expect(getTimePhase(new Date("2026-04-01T17:00:00Z"), sun)).toBe("evening");
  });

  it("日の入り後も薄明のあいだは夕、薄明が終わると夜", () => {
    expect(getTimePhase(new Date("2026-04-01T18:59:00Z"), sun)).toBe("evening");
    expect(getTimePhase(new Date("2026-04-01T19:00:00Z"), sun)).toBe("night");
  });

  it("日照が極端に短い日でも 朝→夕 の順序が壊れない（南中でクランプ）", () => {
    // 日の出 11:30・日の入り 12:30 の一日（高緯度の冬）。朝は南中を超えず、夕も南中より前に戻らない
    const shortDay: SunTimes = {
      dawn: new Date("2026-12-21T11:00:00Z"),
      sunrise: new Date("2026-12-21T11:30:00Z"),
      solarNoon: new Date("2026-12-21T12:00:00Z"),
      sunset: new Date("2026-12-21T12:30:00Z"),
      dusk: new Date("2026-12-21T13:00:00Z"),
    };
    expect(getTimePhase(new Date("2026-12-21T11:30:00Z"), shortDay)).toBe("morning");
    expect(getTimePhase(new Date("2026-12-21T11:59:00Z"), shortDay)).toBe("morning");
    expect(getTimePhase(new Date("2026-12-21T12:00:00Z"), shortDay)).toBe("evening");
    expect(getTimePhase(new Date("2026-12-21T12:59:00Z"), shortDay)).toBe("evening");
    expect(getTimePhase(new Date("2026-12-21T13:00:00Z"), shortDay)).toBe("night");
  });

  it("太陽から決められない場合（null）は固定時刻のフォールバックを使う", () => {
    const noon = new Date("2026-06-21T12:00:00Z");
    expect(getTimePhase(noon, null)).toBe(getTimePhaseByClock(noon));
  });
});

describe("VRT の決定性（e2e/visual.spec.ts の固定時刻）", () => {
  it("2026-06-15T12:00:00Z・UTC 環境（経度0°）では昼になる", () => {
    // VRT は setFixedTime でこの時刻に固定し、コンテナは TZ=UTC で走る。
    // テーマが「昼（light）」で凍結されることがベースラインの前提。
    const now = new Date("2026-06-15T12:00:00Z");
    const sun = getSunTimes(now, DEFAULT_LATITUDE, longitudeFromUtcOffsetMinutes(0));
    expect(getTimePhase(now, sun)).toBe("day");
  });
});
