// 日の出・日の入り（および薄明）の計算と、そこから導く「時刻フェーズ」。
// ------------------------------------------------------------------
// v1.86.0: テーマの明暗を固定時刻（朝06/夜19）から**実際の夜明け・日没**に合わせるために追加。
// 依存ゼロの純関数として lib/ に置き、単体テスト（lib/solar.test.ts）で担保する。
//
// アルゴリズムは NOAA / Meeus の標準的な太陽位置計算（低精度版）。
// 太陽の平均近点角 → 黄経 → 赤緯を求め、目的高度に達する時角から日の出・日の入りを逆算する。
// 誤差は数十秒〜1分程度で、体感テーマの切替には十分（分単位の精度は要らない）。
//
// 位置は**タイムゾーンから推定**する（位置情報 API は使わない＝許可ダイアログなし・通信なし・
// オフラインでも動く）。経度は UTC オフセットから（15°/時）、緯度は日本標準の 35.7°N を既定とする。

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;

/** 地軸の傾き（黄道傾斜角） */
const OBLIQUITY = 23.4397 * RAD;

/** 日の出・日の入りの太陽高度（-0.833°＝大気差 34' ＋ 太陽の視半径 16'） */
export const ALTITUDE_SUNRISE_SUNSET = -0.833;

/** 市民薄明の太陽高度（-6°）。屋外で本が読める明るさの境目＝体感の「夜明け」「日没」 */
export const ALTITUDE_CIVIL_TWILIGHT = -6;

/** 位置を推定できないときに使う既定の緯度（日本のおおよその中央） */
export const DEFAULT_LATITUDE = 35.7;

export type SunTimes = {
  /** 市民薄明の始まり（空が明るみはじめる） */
  dawn: Date;
  sunrise: Date;
  /** 南中 */
  solarNoon: Date;
  sunset: Date;
  /** 市民薄明の終わり（空が暗くなりきる） */
  dusk: Date;
};

export type TimePhase = "morning" | "day" | "evening" | "night";

// ── 天文計算の内部ヘルパー ──────────────────────────────────────

function toJulian(date: Date): number {
  return date.getTime() / DAY_MS - 0.5 + J1970;
}

function fromJulian(julian: number): Date {
  return new Date((julian + 0.5 - J1970) * DAY_MS);
}

function toDaysSinceJ2000(date: Date): number {
  return toJulian(date) - J2000;
}

/** 太陽の平均近点角 */
function solarMeanAnomaly(days: number): number {
  return RAD * (357.5291 + 0.98560028 * days);
}

/** 黄経（中心差＋近日点黄経を加えたもの） */
function eclipticLongitude(meanAnomaly: number): number {
  const center =
    RAD *
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly));
  const perihelion = RAD * 102.9372;
  return meanAnomaly + center + perihelion + Math.PI;
}

/** 太陽の赤緯 */
function declination(eclipticLon: number): number {
  return Math.asin(Math.sin(OBLIQUITY) * Math.sin(eclipticLon));
}

/** ユリウス日の小数部の基準（NOAA の近似式で使う定数） */
const J0 = 0.0009;

function julianCycle(days: number, westLongitude: number): number {
  return Math.round(days - J0 - westLongitude / (2 * Math.PI));
}

function approxTransit(hourAngle: number, westLongitude: number, cycle: number): number {
  return J0 + (hourAngle + westLongitude) / (2 * Math.PI) + cycle;
}

function solarTransitJulian(approx: number, meanAnomaly: number, eclipticLon: number): number {
  return (
    J2000 + approx + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * eclipticLon)
  );
}

/**
 * 太陽が指定高度に達する時角。
 * 極夜・白夜では解が存在しない（cos が ±1 を超える）ため null を返す。
 */
function hourAngleAt(altitude: number, latitude: number, dec: number): number | null {
  const cosH =
    (Math.sin(altitude) - Math.sin(latitude) * Math.sin(dec)) /
    (Math.cos(latitude) * Math.cos(dec));
  if (cosH > 1 || cosH < -1) return null;
  return Math.acos(cosH);
}

// ── 公開 API ────────────────────────────────────────────────────

/**
 * 指定日時・指定地点の日の出／日の入り／薄明の時刻を求める。
 *
 * 返すのは「その日時を含む1日」の各時刻。極夜・白夜（太陽が一度も昇らない／沈まない）では
 * 定義できないため **null** を返す。呼び出し側は固定時刻へフォールバックすること。
 */
export function getSunTimes(date: Date, latitude: number, longitude: number): SunTimes | null {
  const westLongitude = RAD * -longitude;
  const phi = RAD * latitude;

  const days = toDaysSinceJ2000(date);
  const cycle = julianCycle(days, westLongitude);
  const approxNoon = approxTransit(0, westLongitude, cycle);
  const meanAnomaly = solarMeanAnomaly(approxNoon);
  const eclipticLon = eclipticLongitude(meanAnomaly);
  const dec = declination(eclipticLon);

  const noonJulian = solarTransitJulian(approxNoon, meanAnomaly, eclipticLon);

  // 目的高度に対する「沈む時刻」を求め、南中を軸に折り返して「昇る時刻」を得る
  const eventPair = (altitudeDeg: number): { rise: Date; set: Date } | null => {
    const hourAngle = hourAngleAt(RAD * altitudeDeg, phi, dec);
    if (hourAngle === null) return null;
    const setJulian = solarTransitJulian(
      approxTransit(hourAngle, westLongitude, cycle),
      meanAnomaly,
      eclipticLon,
    );
    const riseJulian = noonJulian - (setJulian - noonJulian);
    return { rise: fromJulian(riseJulian), set: fromJulian(setJulian) };
  };

  const sun = eventPair(ALTITUDE_SUNRISE_SUNSET);
  const civil = eventPair(ALTITUDE_CIVIL_TWILIGHT);
  if (!sun || !civil) return null;

  return {
    dawn: civil.rise,
    sunrise: sun.rise,
    solarNoon: fromJulian(noonJulian),
    sunset: sun.set,
    dusk: civil.set,
  };
}

/**
 * UTC オフセット（分・東が正）からおおよその経度を求める。
 * 地球は 1 時間で 15° 回るため、オフセット分 ÷ 4 が経度になる（JST +540 分 → 東経 135°）。
 */
export function longitudeFromUtcOffsetMinutes(utcOffsetMinutes: number): number {
  const longitude = utcOffsetMinutes / 4;
  return Math.max(-180, Math.min(180, longitude));
}

/** 朝＝日の出からこの時間だけ続く（南中を超えない範囲で） */
export const MORNING_AFTER_SUNRISE_MS = 2.5 * 60 * 60 * 1000;

/** 夕＝日の入りのこの時間前から始まる（南中より前には遡らない） */
export const EVENING_BEFORE_SUNSET_MS = 1.5 * 60 * 60 * 1000;

/**
 * 太陽の位置から時刻フェーズを決める。
 *
 * - 夜: 薄明の外側（夜明け前・日没後）＝ダークテーマ
 * - 朝: 夜明け 〜 日の出 +2.5h（南中を超えない）
 * - 夕: 日の入り -1.5h（南中より前には戻らない）〜 薄明の終わり
 * - 昼: その間
 *
 * `sun` が null（極夜・白夜）のときは固定時刻のフォールバックに切り替える。
 */
export function getTimePhase(now: Date, sun: SunTimes | null): TimePhase {
  if (!sun) return getTimePhaseByClock(now);

  const t = now.getTime();
  if (t < sun.dawn.getTime() || t >= sun.dusk.getTime()) return "night";

  const noon = sun.solarNoon.getTime();
  const morningEnd = Math.min(sun.sunrise.getTime() + MORNING_AFTER_SUNRISE_MS, noon);
  if (t < morningEnd) return "morning";

  const eveningStart = Math.max(sun.sunset.getTime() - EVENING_BEFORE_SUNSET_MS, noon);
  if (t >= eveningStart) return "evening";

  return "day";
}

/**
 * 固定時刻による時刻フェーズ（v1.41 の仕様＝朝06–10 / 昼10–17 / 夕17–19 / 夜19–06）。
 * 極夜・白夜など太陽から決められない場合のフォールバックとしてのみ使う。
 */
export function getTimePhaseByClock(now: Date): TimePhase {
  const h = now.getHours();
  if (h >= 6 && h < 10) return "morning";
  if (h >= 10 && h < 17) return "day";
  if (h >= 17 && h < 19) return "evening";
  return "night";
}
