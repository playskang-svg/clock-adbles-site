import { $, el, pad, onTick } from "./common.js";
import { createCalendar, kstDate, DOW, dow, addDays, diffDays, iso } from "./holiday-calc.js";
import DATA from "./holiday-data.js";

const cal = createCalendar(DATA.years);
const root = $("#h-app");
const year = +root.dataset.year;
const md = (d) => { const [, m, x] = d.split("-").map(Number); return `${m}월 ${x}일(${DOW[dow(d)]})`; };

// ── 오늘 / 다음 공휴일 카운트다운 (한국 표준시) ──
const KST = 9 * 3600e3;
function tick() {
  const now = Date.now(), today = kstDate(now), h = cal.holidayOf(today);
  const wd = dow(today);
  $("#h-today").replaceChildren(
    el("b", {}, md(today)), " — ",
    h ? el("span", { className: "tag hol" }, `공휴일 · ${h.n}`) : wd === 0 || wd === 6 ? el("span", { className: "tag" }, "주말") : el("span", { className: "tag ok" }, "공휴일 아님 (평일)"));
  const nx = cal.next(today, { includeToday: false });
  if (!nx) { $("#h-next").textContent = "다음 공휴일 정보가 아직 없어요"; return; }
  const [y, m, d] = nx.d.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d) - KST; // 해당일 00:00 KST
  const ms = Math.max(0, target - now), s = Math.floor(ms / 1000);
  $("#h-next-name").textContent = `${nx.n} · ${md(nx.d)}`;
  $("#h-next-dd").textContent = `D-${diffDays(today, nx.d)}`;
  $("#h-next-t").textContent = `${Math.floor(s / 86400)}일 ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  $("#h-next").classList.remove("hide");
  const run = cal.runs(nx.d.slice(0, 4) * 1).find((r) => r.end >= today && r.start <= nx.d && r.end >= nx.d);
  $("#h-next-run").textContent = run ? `${md(run.start)} ~ ${md(run.end)} ${run.len}일 연휴` : "";
}
onTick(tick); tick();

// ── 12개월 달력 ──
const today = kstDate();
const mon = $("#h-months");
if (mon) for (let m = 1; m <= 12; m++) {
  const first = iso(year, m, 1), days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const box = el("div", { className: "cal", role: "grid", ariaLabel: `${year}년 ${m}월` });
  DOW.forEach((d) => box.append(el("b", {}, d)));
  for (let i = 0; i < dow(first); i++) box.append(el("span", {}));
  for (let d = 1; d <= days; d++) {
    const date = iso(year, m, d), h = cal.holidayOf(date), w = dow(date);
    const cls = [h ? "hol" : "", w === 0 ? "sun" : w === 6 ? "sat" : "", date === today ? "today" : "", h?.t === "substitute" ? "sub" : ""].join(" ");
    box.append(el("span", { className: cls, title: h ? h.n : "" }, String(d)));
  }
  mon.append(el("div", {}, el("h3", {}, `${m}월`), box));
}

// ── 연차 활용 연휴 ──
const kSel = $("#b-k"), out = $("#b-out");
function bridges() {
  const k = +kSel.value, res = cal.bridges(year, k, 4);
  out.replaceChildren(...(res.length ? res.map((r) => el("div", { className: "card" }, el("div", { className: "dd" }, `${r.len}일 연속`), el("div", {}, el("b", {}, `${md(r.start)} ~ ${md(r.end)}`)), el("div", { className: "muted small" }, `연차 ${k}일 사용: ${r.leave.map(md).join(", ")}`))) : [el("p", { className: "muted" }, "추천할 구간이 없어요")]));
}
kSel.onchange = bridges; bridges();

// ── 영업일 계산기 ──
const a = $("#c-a"), b = $("#c-b"), n = $("#c-n"), res1 = $("#c-r1"), res2 = $("#c-r2");
a.value = b.value = today; n.value = 10;
const isWork = (d) => !cal.isOff(d);
const known = (d) => cal.known(+d.slice(0, 4));
function calc() {
  if (a.value && b.value) {
    let [s, e] = a.value <= b.value ? [a.value, b.value] : [b.value, a.value], cnt = 0, hol = 0;
    for (let d = s; d <= e; d = addDays(d, 1)) { if (isWork(d)) cnt++; else if (cal.holidayOf(d)) hol++; }
    res1.textContent = `${diffDays(s, e) + 1}일 중 영업일 ${cnt}일 (공휴일 ${hol}일, 주말 제외)`;
    if (!known(s) || !known(e)) res1.textContent += " · 공휴일 데이터가 없는 연도는 주말만 제외했어요";
  }
  const base = a.value, cntN = +n.value;
  if (base && Number.isFinite(cntN)) {
    let d = base, left = Math.abs(cntN), step = cntN >= 0 ? 1 : -1;
    while (left > 0) { d = addDays(d, step); if (isWork(d)) left--; }
    res2.textContent = `${md(base)} 기준 ${Math.abs(cntN)}영업일 ${step > 0 ? "후" : "전"}: ${d.slice(0, 4)}년 ${md(d)}`;
  }
}
[a, b, n].forEach((i) => i.addEventListener("input", calc)); calc();

// ── 날짜 하나 조회 ──
const q = $("#q-date"), qr = $("#q-res");
q.value = today;
q.addEventListener("input", () => {
  if (!q.value) return; const h = cal.holidayOf(q.value), w = dow(q.value);
  qr.replaceChildren(el("b", {}, `${q.value.replaceAll("-", ".")} (${DOW[w]}) `), h ? el("span", { className: "tag hol" }, `공휴일 · ${h.n}`) : w === 0 || w === 6 ? el("span", { className: "tag" }, "주말 (공휴일 아님)") : el("span", { className: "tag ok" }, "공휴일이 아닌 평일"),
    known(q.value) ? "" : el("div", { className: "muted small" }, "이 연도의 공휴일 데이터는 아직 없어요"));
});
q.dispatchEvent(new Event("input"));
