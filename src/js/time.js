import { $, el, pad, store, onTick } from "./common.js";
import { createCalendar, kstDate, DOW, diffDays } from "./holiday-calc.js";
import DATA from "./holiday-data.js";

const cal = createCalendar(DATA.years);
let offset = 0, acc = null; // offset: 서버 − 내 기기 (ms)

// ── 서버 시간 동기화: 응답 Date 헤더(1초 단위)가 바뀌는 순간을 찾아 ±수십 ms로 보정한다 ──
async function sync() {
  $("#sync-state").textContent = "서버 시간 측정 중…";
  const samples = [];
  const end = performance.now() + 3200;
  let prev = null;
  while (performance.now() < end) {
    const t0 = performance.now(), w0 = Date.now();
    let res;
    try { res = await fetch(`/?_=${Math.random()}`, { method: "HEAD", cache: "no-store" }); } catch { break; }
    const t1 = performance.now();
    const dh = res.headers.get("date"); if (!dh) break;
    const sec = Math.floor(Date.parse(dh) / 1000), mid = w0 + (t1 - t0) / 2;
    samples.push({ sec, mid, rtt: t1 - t0 });
    if (prev && sec > prev.sec) { // 서버 초가 바뀐 경계는 prev.mid ~ mid 사이
      const edge = (prev.mid + mid) / 2;
      offset = sec * 1000 - edge; acc = Math.round((mid - prev.mid) / 2);
      $("#sync-state").textContent = `서버 시간과 동기화됨 · 내 기기와 ${offset >= 0 ? "+" : "−"}${Math.abs(Math.round(offset))}ms 차이 (오차 약 ±${acc}ms)`;
      return;
    }
    prev = samples[samples.length - 1];
    await new Promise((r) => setTimeout(r, 60));
  }
  if (samples.length) { const b = samples.reduce((a, c) => (c.rtt < a.rtt ? c : a)); offset = b.sec * 1000 + 500 - b.mid; $("#sync-state").textContent = `서버 시간과 대략 동기화됨 (오차 약 ±500ms) · ${Math.round(offset)}ms 차이`; }
  else $("#sync-state").textContent = "서버 시간을 가져오지 못해 내 기기 시계를 표시합니다";
}

const fmtT = (tz, d, ms) => new Intl.DateTimeFormat("ko-KR", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
const fmtD = (tz, d) => new Intl.DateTimeFormat("ko-KR", { timeZone: tz, month: "long", day: "numeric", weekday: "short" }).format(d);
const CITIES = [["Asia/Seoul", "서울"], ["Asia/Tokyo", "도쿄"], ["Asia/Shanghai", "베이징·상하이"], ["Asia/Singapore", "싱가포르"], ["Asia/Dubai", "두바이"], ["Europe/London", "런던"], ["Europe/Paris", "파리·베를린"], ["America/New_York", "뉴욕"], ["America/Chicago", "시카고"], ["America/Los_Angeles", "로스앤젤레스"], ["Pacific/Honolulu", "호놀룰루"], ["Australia/Sydney", "시드니"], ["UTC", "UTC"]];
let chosen = store.get("clock.cities", ["Asia/Seoul", "Asia/Tokyo", "America/New_York", "Europe/London"]);
const pick = $("#c-pick"), wc = $("#c-list");
for (const [tz, n] of CITIES) pick.append(el("option", { value: tz }, n));
$("#c-add").onclick = () => { if (!chosen.includes(pick.value)) { chosen.push(pick.value); store.set("clock.cities", chosen); drawCities(); } };
function drawCities() {
  wc.replaceChildren(...chosen.map((tz) => {
    const rm = el("button", { className: "btn ghost sm", ariaLabel: "삭제" }, "✕"); rm.onclick = () => { chosen = chosen.filter((x) => x !== tz); store.set("clock.cities", chosen); drawCities(); };
    return el("div", { className: "alarm-item", dataset: { tz } }, el("div", { className: "t", style: "min-width:7.5ch" }, "--:--:--"), el("div", {}, el("b", {}, CITIES.find((c) => c[0] === tz)?.[1] ?? tz), el("div", { className: "meta" }, "")), rm);
  }));
}
drawCities();

let showMs = store.get("clock.ms", true);
const ms = $("#t-ms"); ms.checked = showMs; ms.onchange = () => { showMs = ms.checked; store.set("clock.ms", showMs); };
const lunarFmt = (() => { try { return new Intl.DateTimeFormat("en-u-ca-dangi", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }); } catch { return null; } })();

let lastDay = "";
function tick() {
  const t = Date.now() + offset, d = new Date(t);
  const hms = fmtT("Asia/Seoul", d);
  $("#now").innerHTML = `${hms}<small style="font-size:.4em;opacity:.7">${showMs ? "." + pad(Math.floor(t % 1000), 3) : ""}</small>`;
  const day = kstDate(t);
  if (day !== lastDay) { lastDay = day; info(day, t); }
  for (const r of wc.children) { r.firstChild.textContent = fmtT(r.dataset.tz, d); const seoul = day, other = new Intl.DateTimeFormat("sv-SE", { timeZone: r.dataset.tz }).format(d); r.querySelector(".meta").textContent = `${fmtD(r.dataset.tz, d)}${other !== seoul ? (other > seoul ? " · 서울보다 하루 빠름" : " · 서울보다 하루 느림") : ""}`; }
}
function info(day, t) {
  const [y, m, dd] = day.split("-").map(Number);
  const dayNo = diffDays(`${y}-01-01`, day) + 1, total = diffDays(`${y}-01-01`, `${y + 1}-01-01`);
  const dt = new Date(Date.UTC(y, m - 1, dd)), wd = DOW[dt.getUTCDay()];
  // ISO 주차
  const th = new Date(dt); th.setUTCDate(th.getUTCDate() + 3 - ((th.getUTCDay() + 6) % 7));
  const wk = 1 + Math.round(((th - new Date(Date.UTC(th.getUTCFullYear(), 0, 4))) / 864e5 - 3 + ((new Date(Date.UTC(th.getUTCFullYear(), 0, 4)).getUTCDay() + 6) % 7)) / 7);
  const h = cal.holidayOf(day), nx = cal.next(day, { includeToday: false });
  let lunar = ""; if (lunarFmt) { const p = lunarFmt.formatToParts(new Date(Date.UTC(y, m - 1, dd, 12))); const lm = p.find((x) => x.type === "month").value; lunar = `음력 ${/^\d+$/.test(lm) ? lm : lm.replace("bis", "")}${/^\d+$/.test(lm) ? "" : "(윤)"}월 ${p.find((x) => x.type === "day").value}일`; }
  $("#date").textContent = `${y}년 ${m}월 ${dd}일 ${wd}요일`;
  $("#facts").replaceChildren(
    el("span", { className: "tag" }, `${y}년 ${dayNo}번째 날 (남은 ${total - dayNo}일)`), el("span", { className: "tag" }, `ISO ${wk}주차`), lunar ? el("span", { className: "tag" }, lunar) : "",
    h ? el("span", { className: "tag hol" }, `오늘은 ${h.n}`) : (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) ? el("span", { className: "tag" }, "주말") : el("span", { className: "tag ok" }, "평일"),
    nx ? el("span", { className: "tag" }, `다음 공휴일 ${nx.n} · D-${diffDays(day, nx.d)}`) : "");
}
onTick(tick); setInterval(tick, 33);
$("#resync").onclick = sync;
sync(); setInterval(sync, 10 * 60e3);
