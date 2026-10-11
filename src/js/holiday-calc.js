// 공휴일 조회·연휴 계산 (순수 함수 — 브라우저와 빌드에서 함께 쓴다).
// data: { "2026": [{ d: "2026-01-01", n: "신정", t: "holiday" }, ...], ... }

const pad = (n) => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toUTC = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (s, n) => { const dt = new Date(toUTC(s) + n * 864e5); return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); };
export const dow = (s) => new Date(toUTC(s)).getUTCDay();
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
export const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const kstFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
/** 한국 표준시 기준 오늘(YYYY-MM-DD) */
export const kstDate = (ms = Date.now()) => kstFmt.format(new Date(ms));

export function createCalendar(data) {
  const map = new Map();
  for (const [, list] of Object.entries(data)) for (const h of list) map.set(h.d, h);
  const years = Object.keys(data).map(Number).sort((a, b) => a - b);
  const holidayOf = (d) => map.get(d) ?? null;
  const isOff = (d) => dow(d) === 0 || dow(d) === 6 || map.has(d);
  const list = (y) => data[y] ?? [];
  const known = (y) => y in data;

  function next(from, { includeToday = true } = {}) {
    let best = null;
    for (const h of map.values()) {
      if (h.d < from || (!includeToday && h.d === from)) continue;
      if (!best || h.d < best.d) best = h;
    }
    return best;
  }

  /** 연속 휴일(주말+공휴일) 중 공휴일을 포함하고 길이가 minLen 이상인 구간 */
  function runs(y, minLen = 3) {
    const out = [];
    let d = iso(y, 1, 1);
    const end = iso(y, 12, 31);
    // 연초에 걸친 연휴 시작점 찾기
    while (isOff(addDays(d, -1))) d = addDays(d, -1);
    while (d <= end) {
      if (!isOff(d)) { d = addDays(d, 1); continue; }
      let e = d;
      while (isOff(addDays(e, 1))) e = addDays(e, 1);
      const len = diffDays(d, e) + 1;
      const hol = [];
      for (let x = d; x <= e; x = addDays(x, 1)) if (map.has(x)) hol.push(map.get(x));
      if (len >= minLen && hol.length && e >= iso(y, 1, 1)) out.push({ start: d, end: e, len, names: hol.map((h) => h.n) });
      d = addDays(e, 1);
    }
    return out;
  }

  /** 연차 k일로 만들 수 있는 가장 긴 연휴 후보(겹치지 않게 길이순) */
  function bridges(y, k, top = 3) {
    const start = addDays(iso(y, 1, 1), -10);
    const end = addDays(iso(y, 12, 31), 10);
    const days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push({ d, off: isOff(d), hol: map.has(d) });
    const cand = [];
    for (let i = 0; i < days.length; i++) {
      if (!days[i].off) continue;
      let used = 0, hol = false, j = i, last = i;
      for (; j < days.length; j++) {
        if (!days[j].off) { if (used === k) break; used++; }
        if (days[j].hol) hol = true;
        if (days[j].off) last = j; // 구간은 쉬는 날로 끝나야 한다
      }
      const usedFinal = days.slice(i, last + 1).filter((x) => !x.off).length;
      if (!hol || usedFinal === 0 && k > 0) continue;
      const s = days[i].d, e = days[last].d;
      if (e < iso(y, 1, 1) || s > iso(y, 12, 31)) continue;
      cand.push({ start: s, end: e, len: last - i + 1, leave: days.slice(i, last + 1).filter((x) => !x.off).map((x) => x.d) });
    }
    cand.sort((a, b) => b.len - a.len || a.start.localeCompare(b.start));
    const picked = [];
    for (const c of cand) {
      if (picked.some((p) => !(c.end < p.start || c.start > p.end))) continue;
      picked.push(c);
      if (picked.length >= top) break;
    }
    return picked;
  }

  return { holidayOf, isOff, list, known, years, next, runs, bridges };
}
