// 日の出・日の入り（および薄明）の計算と、そこから導く「時刻フェーズ」。
// ------------------------------------------------------------------
// v1.86.0: テーマの明暗を固定時刻（朝06/夜19）から**実際の夜明け・日没**に合わせるために追加。
// 依存ゼロの純関数として lib/ に置き、単体テスト（lib/solar.test.ts）で担保する。
//
// アルゴリズムは NOAA / Meeus の標準的な太陽位置計算（低精度版）。
// 太陽の平均近点角 → 黄経 → 赤緯を求め、目的高度に達する時角から日の出・日の入りを逆算する。
// 独立実装との突き合わせで誤差は最大3分程度（高緯度ほど大きい）。体感テーマの切替には十分。
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
const ALTITUDE_SUNRISE_SUNSET = -0.833;

/** 市民薄明の太陽高度（-6°）。屋外で本が読める明るさの境目＝体感の「夜明け」「日没」 */
const ALTITUDE_CIVIL_TWILIGHT = -6;

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
  // 極夜・白夜では |cosH| > 1。緯度 ±90° ちょうどでは 0/0 で NaN になるため
  // 有限性も確認する（NaN を素通しすると Invalid Date になりフォールバックが効かない）
  if (!Number.isFinite(cosH) || cosH > 1 || cosH < -1) return null;
  return Math.acos(cosH);
}

// ── 公開 API ────────────────────────────────────────────────────

/**
 * 指定日時・指定地点の日の出／日の入り／薄明の時刻を求める。
 *
 * 返すのは「**その地点の南中がいちばん近い日**」の各時刻（日付境界ではなく南中が基準）。
 * 指定地点の経度とタイムゾーンが対応していれば、これは現地のその日の値になる。
 *
 * 極夜・白夜（太陽が一度も昇らない／沈まない）では定義できないため **null** を返す。
 * 呼び出し側は固定時刻へフォールバックすること。
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
  if (!sun) return null; // 太陽が昇らない／沈まない＝極夜・白夜（呼び出し側は固定時刻へ）

  // 白夜に近い高緯度（例: 6月のレイキャビク）では日の出・日の入りは存在するのに
  // 太陽高度が -6° まで下がらず薄明が成立しない。この場合は薄明を日の出・日の入りに
  // 縮退させる（固定時刻へ丸ごと落とすより実際の空に近い）。
  const civil = eventPair(ALTITUDE_CIVIL_TWILIGHT) ?? sun;

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
  const raw = utcOffsetMinutes / 4;
  // UTC+13（NZ 夏時間・トンガ）＝195°E、UTC+14（キリバス）＝210°E は実在する。
  // ±180 でクランプすると南中が 1〜2 時間ずれるため、-180〜180 に**正規化**する
  // （太陽位置の式は経度に対して周期的なので、正規化すれば正しく回る）。
  return (((raw + 180) % 360) + 360) % 360 - 180;
}

// ── タイムゾーンからの位置推定 ────────────────────────────────
//
// 経度は UTC オフセットから求めるが、**夏時間（DST）のオフセットを使うと最大 15° ずれる**
// （例: ベルリンは夏 +120分 → 東経30° と誤認。実際は東経13.4°）。太陽の位置は標準時の
// 子午線に対応するため、1月と7月のオフセットの**小さい方＝標準時**を使う（DST は必ず加算されるため）。
//
// 緯度はオフセットから求められないので、主要な IANA タイムゾーンの代表都市の緯度表を持つ。
// **南半球かどうか（符号）を外すと季節が反転し、固定時刻より悪くなる**ため、
// 少なくとも南半球の主要ゾーンは網羅する。表にないゾーンは DEFAULT_LATITUDE にフォールバックする。
const TIMEZONE_LATITUDES: Record<string, number> = {
  // 日本・アジア
  "Asia/Tokyo": 35.7, "Asia/Seoul": 37.6, "Asia/Shanghai": 31.2, "Asia/Chongqing": 29.6,
  "Asia/Hong_Kong": 22.3, "Asia/Taipei": 25.0, "Asia/Singapore": 1.4, "Asia/Bangkok": 13.8,
  "Asia/Jakarta": -6.2, "Asia/Manila": 14.6, "Asia/Kolkata": 22.6, "Asia/Calcutta": 22.6,
  "Asia/Dubai": 25.2, "Asia/Karachi": 24.9, "Asia/Dhaka": 23.8, "Asia/Ho_Chi_Minh": 10.8,
  "Asia/Kuala_Lumpur": 3.1, "Asia/Jerusalem": 31.8, "Asia/Riyadh": 24.7, "Asia/Tehran": 35.7,
  "Asia/Istanbul": 41.0, "Asia/Kathmandu": 27.7, "Asia/Yangon": 16.9, "Asia/Vladivostok": 43.1,
  // ヨーロッパ
  "Europe/London": 51.5, "Europe/Dublin": 53.3, "Europe/Lisbon": 38.7, "Europe/Madrid": 40.4,
  "Europe/Paris": 48.9, "Europe/Brussels": 50.8, "Europe/Amsterdam": 52.4, "Europe/Berlin": 52.5,
  "Europe/Zurich": 47.4, "Europe/Vienna": 48.2, "Europe/Prague": 50.1, "Europe/Warsaw": 52.2,
  "Europe/Budapest": 47.5, "Europe/Rome": 41.9, "Europe/Athens": 38.0, "Europe/Kyiv": 50.5,
  "Europe/Kiev": 50.5, "Europe/Moscow": 55.8, "Europe/Stockholm": 59.3, "Europe/Oslo": 59.9,
  "Europe/Copenhagen": 55.7, "Europe/Helsinki": 60.2,
  // 南北アメリカ
  "America/New_York": 40.7, "America/Toronto": 43.7, "America/Chicago": 41.9,
  "America/Denver": 39.7, "America/Phoenix": 33.4, "America/Los_Angeles": 34.1,
  "America/Vancouver": 49.3, "America/Anchorage": 61.2, "America/Mexico_City": 19.4,
  "America/Bogota": 4.7, "America/Lima": -12.0, "America/Santiago": -33.4,
  "America/Sao_Paulo": -23.5, "America/Argentina/Buenos_Aires": -34.6, "America/Halifax": 44.6,
  // オセアニア・太平洋
  "Australia/Sydney": -33.9, "Australia/Melbourne": -37.8, "Australia/Brisbane": -27.5,
  "Australia/Perth": -31.9, "Australia/Adelaide": -34.9, "Australia/Darwin": -12.5,
  "Australia/Hobart": -42.9, "Pacific/Auckland": -36.8, "Pacific/Fiji": -18.1,
  "Pacific/Honolulu": 21.3, "Pacific/Guam": 13.5,
  // アフリカ
  "Africa/Cairo": 30.0, "Africa/Casablanca": 33.6, "Africa/Lagos": 6.5, "Africa/Accra": 5.6,
  "Africa/Nairobi": -1.3, "Africa/Addis_Ababa": 9.0, "Africa/Johannesburg": -26.2,
};

/** 地域プレフィックスによる粗いフォールバック（表にないゾーンでも半球だけは外さない） */
const REGION_LATITUDES: Array<[string, number]> = [
  ["Australia/", -30],
  ["Antarctica/", -70],
  ["Atlantic/", 38],
  ["Indian/", -10],
];

/**
 * IANA タイムゾーン名から代表的な緯度を引く。表にない場合は地域プレフィックス、
 * それも無ければ DEFAULT_LATITUDE（日本のおおよその中央）。
 */
export function latitudeFromTimeZone(timeZone: string | undefined): number {
  if (!timeZone) return DEFAULT_LATITUDE;
  const known = TIMEZONE_LATITUDES[timeZone];
  if (known !== undefined) return known;
  const region = REGION_LATITUDES.find(([prefix]) => timeZone.startsWith(prefix));
  return region ? region[1] : DEFAULT_LATITUDE;
}

/** 指定タイムゾーン・指定時刻の UTC オフセット（分・東が正）。取得できなければ null */
export function utcOffsetMinutesFor(timeZone: string, date: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(date);
    const label = parts.find((p) => p.type === "timeZoneName")?.value;
    if (!label) return null;
    if (label === "GMT" || label === "UTC") return 0;
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(label);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    return null;
  }
}

/**
 * 夏時間を除いた「標準時」の UTC オフセット（分・東が正）。
 * DST は必ずオフセットを進めるため、1月と7月のうち**小さい方**が標準時になる。
 */
export function standardUtcOffsetMinutes(timeZone: string, date: Date): number | null {
  const year = date.getUTCFullYear();
  const january = utcOffsetMinutesFor(timeZone, new Date(Date.UTC(year, 0, 15)));
  const july = utcOffsetMinutesFor(timeZone, new Date(Date.UTC(year, 6, 15)));
  if (january === null || july === null) return null;
  return Math.min(january, july);
}

/**
 * ブラウザのタイムゾーンから、おおよその観測地点を推定する。
 * 位置情報 API は使わない（許可ダイアログなし・通信なし・オフラインでも動く）。
 *
 * @param timeZone 省略時は実行環境のタイムゾーン（Intl）を使う
 */
export function estimateLocation(
  date: Date,
  timeZone?: string,
): { latitude: number; longitude: number } {
  let zone = timeZone;
  if (!zone) {
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      zone = undefined;
    }
  }

  // 標準時のオフセットが取れないときのみ、実行時オフセット（DST を含みうる）で代用する
  const offsetMinutes =
    (zone ? standardUtcOffsetMinutes(zone, date) : null) ?? -date.getTimezoneOffset();

  return {
    latitude: latitudeFromTimeZone(zone),
    longitude: longitudeFromUtcOffsetMinutes(offsetMinutes),
  };
}

/** 朝＝日の出からこの時間だけ続く（南中を超えない範囲で） */
const MORNING_AFTER_SUNRISE_MS = 2.5 * 60 * 60 * 1000;

/** 夕＝日の入りのこの時間前から始まる（南中より前には遡らない） */
const EVENING_BEFORE_SUNSET_MS = 1.5 * 60 * 60 * 1000;

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
 * 極夜・白夜など太陽から決められない場合のフォールバックとしてのみ使う
 * （緯度推定が極域のタイムゾーン＝Antarctica/* を引いたときに実際に到達する）。
 */
export function getTimePhaseByClock(now: Date): TimePhase {
  const h = now.getHours();
  if (h >= 6 && h < 10) return "morning";
  if (h >= 10 && h < 17) return "day";
  if (h >= 17 && h < 19) return "evening";
  return "night";
}
