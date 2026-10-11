// 공휴일 계산 (빌드·테스트 전용 — Intl의 단기(dangi) 음력 달력을 쓴다).
// 브라우저는 이 파일이 만든 holiday-data.js를 읽으므로 런타임에 Intl 음력에 의존하지 않는다.
//
// 근거: 공휴일에 관한 법률, 관공서의 공휴일에 관한 규정(2026-05-11 시행본: 노동절·제헌절 추가),
//       우주항공청 월력요항(2026·2027). 임시공휴일·선거일은 공식 발표 때마다 EXTRAS에 추가한다.

const pad = (n) => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toUTC = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (s, n) => { const dt = new Date(toUTC(s) + n * 864e5); return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); };
export const dow = (s) => new Date(toUTC(s)).getUTCDay(); // 0=일

const lunarFmt = new Intl.DateTimeFormat("en-u-ca-dangi", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
const lunarCache = new Map();

/** 해당 양력 연도 안에서 (윤달이 아닌) 음력 m월 d일에 해당하는 양력 날짜 */
export function lunarToSolar(year, lm, ld) {
  if (!lunarCache.has(year)) {
    const table = new Map();
    for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31); t += 864e5) {
      const parts = lunarFmt.formatToParts(new Date(t + 12 * 36e5));
      const m = parts.find((p) => p.type === "month").value;
      const d = parts.find((p) => p.type === "day").value;
      if (!/^\d+$/.test(m)) continue; // 윤달(예: "4bis") 제외
      const dt = new Date(t);
      table.set(`${m}-${d}`, iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
    }
    lunarCache.set(year, table);
  }
  return lunarCache.get(year).get(`${lm}-${ld}`) ?? null;
}

// 법정 선거일·임시공휴일. 공식 발표가 나오면 여기에만 추가한다.
// expected: true 는 법정 기일로 계산한 예정일(아직 공식 공고 전).
export const EXTRAS = [
  { date: "2024-04-10", name: "제22대 국회의원선거일", type: "election" },
  { date: "2024-10-01", name: "국군의 날 임시공휴일", type: "temporary" },
  { date: "2025-01-27", name: "임시공휴일", type: "temporary" },
  { date: "2025-06-03", name: "제21대 대통령선거일", type: "election" },
  { date: "2026-06-03", name: "제9회 전국동시지방선거일", type: "election" },
  { date: "2028-04-12", name: "제23대 국회의원선거일(예정)", type: "election", expected: true },
];

// 대체공휴일 적용 그룹
//  seolchuseok: 설·추석 연휴(일요일 또는 다른 공휴일과 겹칠 때 — 토요일은 제외)
//  weekend    : 어린이날·삼일절·노동절·부처님오신날·제헌절·광복절·개천절·한글날·성탄절(토·일 또는 다른 공휴일과 겹칠 때)
//  none       : 신정·현충일·선거일·임시공휴일(대체 없음)
function baseHolidays(y) {
  const H = [];
  const add = (date, name, group, extra = {}) => date && H.push({ date, name, group, ...extra });
  add(iso(y, 1, 1), "신정", "none");
  const seol = lunarToSolar(y, 1, 1);
  if (seol) {
    add(addDays(seol, -1), "설날 연휴", "seolchuseok", { set: "seol" });
    add(seol, "설날", "seolchuseok", { set: "seol" });
    add(addDays(seol, 1), "설날 연휴", "seolchuseok", { set: "seol" });
  }
  add(iso(y, 3, 1), "삼일절", "weekend");
  if (y >= 2026) add(iso(y, 5, 1), "노동절", "weekend");
  add(iso(y, 5, 5), "어린이날", "weekend");
  add(lunarToSolar(y, 4, 8), "부처님오신날", "weekend");
  add(iso(y, 6, 6), "현충일", "none");
  if (y >= 2026) add(iso(y, 7, 17), "제헌절", "weekend");
  add(iso(y, 8, 15), "광복절", "weekend");
  const chu = lunarToSolar(y, 8, 15);
  if (chu) {
    add(addDays(chu, -1), "추석 연휴", "seolchuseok", { set: "chuseok" });
    add(chu, "추석", "seolchuseok", { set: "chuseok" });
    add(addDays(chu, 1), "추석 연휴", "seolchuseok", { set: "chuseok" });
  }
  add(iso(y, 10, 3), "개천절", "weekend");
  add(iso(y, 10, 9), "한글날", "weekend");
  add(iso(y, 12, 25), "기독탄신일(성탄절)", "weekend");
  for (const e of EXTRAS.filter((x) => x.date.startsWith(`${y}-`))) {
    add(e.date, e.name, "none", { type: e.type, expected: !!e.expected });
  }
  return H;
}

/** 한 해의 공휴일 목록(대체공휴일 포함). 같은 날 겹치면 이름을 합친다. */
export function computeYear(y) {
  const raw = baseHolidays(y);
  const byDate = new Map();
  for (const h of raw) {
    const cur = byDate.get(h.date);
    if (cur) { cur.names.push(h.name); cur.items.push(h); } else byDate.set(h.date, { date: h.date, names: [h.name], items: [h] });
  }
  const taken = new Set(byDate.keys());
  const out = [];
  const substitutes = [];
  const handledSets = new Set();

  for (const date of [...byDate.keys()].sort()) {
    const e = byDate.get(date);
    const w = dow(date);
    const overlap = e.items.length > 1;
    let need = false;
    let after = date;
    for (const h of e.items) {
      if (h.group === "weekend" && (w === 0 || w === 6 || overlap)) need = true;
      if (h.group === "seolchuseok") {
        if (handledSets.has(h.set)) continue;
        const days = raw.filter((x) => x.set === h.set).map((x) => x.date).sort();
        const conflict = days.some((d) => dow(d) === 0 || byDate.get(d).items.length > 1);
        handledSets.add(h.set);
        if (conflict) { need = true; after = days[days.length - 1]; }
      }
    }
    if (need) {
      const label = e.items.map((x) => x.name).filter((n) => !n.includes("연휴")).join("·") || e.items[0].name.replace(" 연휴", "");
      substitutes.push({ after, label: e.items.some((x) => x.group === "seolchuseok") ? (e.items[0].set === "seol" ? "설날" : "추석") : label });
    }
  }
  substitutes.sort((a, b) => a.after.localeCompare(b.after));
  for (const s of substitutes) {
    let d = addDays(s.after, 1);
    while (dow(d) === 0 || dow(d) === 6 || taken.has(d)) d = addDays(d, 1);
    taken.add(d);
    out.push({ date: d, name: `${s.label} 대체공휴일`, type: "substitute" });
  }
  for (const e of byDate.values()) {
    const x = e.items.find((i) => i.type) ;
    out.push({
      date: e.date,
      name: e.names.join("·"),
      type: x?.type ?? "holiday",
      ...(e.items.some((i) => i.expected) ? { expected: true } : {}),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
