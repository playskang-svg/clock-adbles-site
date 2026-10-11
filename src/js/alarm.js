import { $, $$, el, pad, store, toast, onTick, hms, humanDur, setTitle, flashTitle, askNotify, notify, keepAwake } from "./common.js";
import { play, preview, unlock, SOUNDS } from "./sound.js";
import { createCalendar, DOW } from "./holiday-calc.js";
import DATA from "./holiday-data.js";

const cal = createCalendar(DATA.years);
const KEY = "clock.alarms.v1";
const DAYSET = { weekday: [1, 2, 3, 4, 5], weekend: [0, 6], all: [0, 1, 2, 3, 4, 5, 6] };
let alarms = store.get(KEY, []).map((a) => ({ snooze: 5, sound: "classic", ...a }));
let ringing = null;
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function nextFire(a, from = new Date()) {
  const [h, m] = a.time.split(":").map(Number);
  for (let i = 0; i < 400; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, h, m, 0, 0);
    if (d <= from) continue;
    if (a.days.length && !a.days.includes(d.getDay())) continue;
    if (a.skipHol && cal.holidayOf(localIso(d))) continue;
    return d;
  }
  return null;
}
const save = () => store.set(KEY, alarms.map(({ id, time, label, days, sound, on, skipHol, snooze, ramp, vol }) => ({ id, time, label, days, sound, on, skipHol, snooze, ramp, vol })));
function arm(a) { a._next = a.on ? (a.snoozeUntil && a.snoozeUntil > Date.now() ? new Date(a.snoozeUntil) : nextFire(a)) : null; }
alarms.forEach(arm);

const fmtWhen = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const daysText = (a) => {
  if (!a.days.length) return "한 번만";
  const k = [...a.days].sort().join();
  if (k === "0,1,2,3,4,5,6") return "매일";
  if (k === "1,2,3,4,5") return "평일";
  if (k === "0,6") return "주말";
  return a.days.map((d) => DOW[d]).join("·");
};

// ── 입력 폼 ──
const f = { time: $("#a-time"), label: $("#a-label"), sound: $("#a-sound"), vol: $("#a-vol"), snooze: $("#a-snooze"), ramp: $("#a-ramp"), skip: $("#a-skip") };
let formDays = [];
for (const [k, v] of Object.entries(SOUNDS)) f.sound.append(el("option", { value: k }, v));
const dayBtns = $$("#a-days button");
function paintDays() { dayBtns.forEach((b) => b.setAttribute("aria-pressed", formDays.includes(+b.dataset.d))); $$("[data-set]").forEach((c) => c.setAttribute("aria-pressed", JSON.stringify([...formDays].sort()) === JSON.stringify(DAYSET[c.dataset.set] ?? []))); }
dayBtns.forEach((b) => b.addEventListener("click", () => { const d = +b.dataset.d; formDays = formDays.includes(d) ? formDays.filter((x) => x !== d) : [...formDays, d]; paintDays(); }));
$$("[data-set]").forEach((c) => c.addEventListener("click", () => { formDays = [...DAYSET[c.dataset.set]]; paintDays(); }));
$("#a-once").addEventListener("click", () => { formDays = []; paintDays(); });
$("#a-preview").addEventListener("click", () => { unlock(); preview(f.sound.value, +f.vol.value); });
$$("[data-time]").forEach((c) => c.addEventListener("click", () => { f.time.value = c.dataset.time; }));

async function addAlarm() {
  unlock();
  if (!f.time.value) return toast("시간을 입력하세요");
  const a = { id: crypto.randomUUID?.() ?? String(Date.now()), time: f.time.value, label: f.label.value.trim().slice(0, 40), days: [...formDays].sort(), sound: f.sound.value, vol: +f.vol.value, snooze: +f.snooze.value, ramp: f.ramp.checked, skipHol: f.skip.checked, on: true };
  arm(a); alarms.push(a); alarms.sort((x, y) => x.time.localeCompare(y.time)); save(); render();
  toast(`${fmtWhen(a._next)} 에 울립니다 (${humanDur(a._next - Date.now())} 후)`);
  const p = await askNotify();
  if (p === "denied") toast("알림이 차단되어 있어요. 소리와 화면 알림만 동작합니다.", 4000);
}
$("#a-form").addEventListener("submit", (e) => { e.preventDefault(); addAlarm(); });

const wakeEl = $("#a-wake");
wakeEl.checked = store.get("clock.wake", false);
async function applyWake() { window.__wantAwake = wakeEl.checked && alarms.some((a) => a.on); const ok = await keepAwake(window.__wantAwake); $("#wake-state").textContent = window.__wantAwake ? (ok ? "화면이 꺼지지 않도록 유지 중" : "이 브라우저는 화면 유지를 지원하지 않거나 거부했어요") : ""; }
wakeEl.addEventListener("change", () => { store.set("clock.wake", wakeEl.checked); applyWake(); });

// ── 목록 ──
const listEl = $("#a-list");
function render() {
  listEl.replaceChildren();
  if (!alarms.length) listEl.append(el("p", { className: "muted" }, "저장된 알람이 없어요. 왼쪽에서 시간을 정하고 ‘알람 추가’를 누르세요."));
  for (const a of alarms) {
    const sw = el("label", { className: "sw", title: a.on ? "끄기" : "켜기" }, el("input", { type: "checkbox", checked: a.on, ariaLabel: `${a.time} 알람 사용` }));
    sw.firstChild.addEventListener("change", (e) => { a.on = e.target.checked; a.snoozeUntil = 0; arm(a); save(); render(); if (a.on) unlock(); });
    const meta = el("div", { className: "meta" }, a.label ? `${a.label} · ` : "", daysText(a), " · ", SOUNDS[a.sound] ?? "", a.skipHol ? el("span", { className: "tag hol", style: "margin-left:6px" }, "공휴일 제외") : "",
      a.on && a._next ? el("div", {}, `다음: ${fmtWhen(a._next)}`) : "");
    const edit = el("button", { className: "btn ghost sm" }, "수정");
    edit.onclick = () => { f.time.value = a.time; f.label.value = a.label; formDays = [...a.days]; f.sound.value = a.sound; f.vol.value = a.vol ?? 0.8; f.snooze.value = a.snooze; f.ramp.checked = !!a.ramp; f.skip.checked = !!a.skipHol; alarms = alarms.filter((x) => x !== a); save(); render(); paintDays(); f.time.focus(); toast("수정 후 ‘알람 추가’를 누르세요"); };
    const del = el("button", { className: "btn ghost sm", ariaLabel: `${a.time} 알람 삭제` }, "삭제");
    del.onclick = () => { alarms = alarms.filter((x) => x !== a); save(); render(); };
    listEl.append(el("div", { className: "alarm-item" + (a.on ? "" : " off") }, sw, el("div", {}, el("div", { className: "t" }, a.time), meta), el("div", { className: "row act" }, edit, del)));
  }
  applyWake();
}

// ── 울림 ──
let stopFlash = null;
function ring(a, missedMs = 0) {
  if (ringing) return;
  const snd = play(a.sound, { volume: a.vol ?? 0.8, ramp: a.ramp });
  const [h, m] = a.time.split(":");
  const box = el("div", { className: "box", role: "alertdialog", ariaLabel: "알람" },
    el("div", { className: "muted" }, "⏰ 알람"), el("div", { className: "big" }, `${h}:${m}`), el("h2", {}, a.label || "일어날 시간이에요"),
    missedMs > 60000 ? el("p", { className: "muted" }, `${humanDur(missedMs)} 지연되어 울렸어요`) : "",
    el("div", { className: "row center mt" }, el("button", { className: "btn lg", id: "r-stop" }, "끄기"), el("button", { className: "btn ghost lg", id: "r-snz" }, `${a.snooze}분 뒤 다시`)));
  const ov = el("div", { className: "overlay" }, box); document.body.append(ov);
  ringing = { a, snd, ov };
  stopFlash = flashTitle(a.label || "알람");
  notify(`⏰ ${h}:${m} 알람`, a.label || "알람 시간입니다");
  $("#r-stop").focus();
  const done = () => { snd.stop(); ov.remove(); stopFlash?.(); ringing = null; };
  $("#r-stop").onclick = () => { done(); a.snoozeUntil = 0; if (!a.days.length) a.on = false; arm(a); save(); render(); };
  $("#r-snz").onclick = () => { done(); a.on = true; a.snoozeUntil = Date.now() + a.snooze * 60000; arm(a); render(); toast(`${a.snooze}분 뒤에 다시 울립니다`); };
}

// ── 박자 ──
const nowEl = $("#a-now"), nextEl = $("#a-next");
onTick(() => {
  const now = new Date();
  nowEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  let soonest = null;
  for (const a of alarms) {
    if (!a.on || !a._next) continue;
    if (now >= a._next) {
      const late = now - a._next;
      if (late <= 10 * 60000) ring(a, late);
      else toast(`${a.time} 알람을 놓쳤어요 (${humanDur(late)} 전)`, 5000);
      a.snoozeUntil = 0;
      if (!ringing) { /* 이미 다른 알람이 울리는 중이면 건너뜀 */ }
      if (!a.days.length) { a.on = false; save(); render(); } else { arm(a); render(); }
      continue;
    }
    if (!soonest || a._next < soonest) soonest = a._next;
  }
  if (soonest) { const left = soonest - now; nextEl.textContent = `가장 가까운 알람까지 ${humanDur(left)} (${fmtWhen(soonest)})`; setTitle(left < 3600e3 ? `알람 ${hms(left)}` : ""); }
  else { nextEl.textContent = "켜진 알람이 없습니다"; setTitle(""); }
});

// ?t=0730 같은 링크로 시간 미리 채우기
const q = new URLSearchParams(location.search);
if (/^\d{4}$/.test(q.get("t") ?? "")) f.time.value = `${q.get("t").slice(0, 2)}:${q.get("t").slice(2)}`;
else { const n = new Date(Date.now() + 3600e3); f.time.value = `${pad(n.getHours())}:00`; }
if (q.get("l")) f.label.value = q.get("l").slice(0, 40);
formDays = []; paintDays(); render();

// 알림/오디오 상태 안내
function status() {
  const out = [];
  if ("Notification" in window) out.push(el("span", { className: "tag " + (Notification.permission === "granted" ? "ok" : "warn") }, `알림 ${Notification.permission === "granted" ? "허용" : Notification.permission === "denied" ? "차단" : "미설정"}`));
  out.push(el("span", { className: "tag" }, "탭을 닫으면 울리지 않아요"));
  $("#a-status").replaceChildren(...out);
}
status(); setInterval(status, 5000);
