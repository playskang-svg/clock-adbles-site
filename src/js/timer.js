import { $, el, pad, store, toast, onTick, hms, setTitle, flashTitle, askNotify, notify, bigView, keepAwake } from "./common.js";
import { play, preview, unlock, SOUNDS } from "./sound.js";

const app = $("#app");
const single = app.dataset.duration ? +app.dataset.duration * 1000 : 0; // 프리셋 페이지는 타이머 하나만
const KEY = "clock.timers.v1", SKEY = "clock.timer.sound";
let timers = single ? [] : store.get(KEY, []);
let cfg = { sound: "digital", vol: 0.8, ...store.get(SKEY, {}) };
const rings = new Map(); // id → {snd, ov}
const stamp = () => Date.now();

const mk = (dur, label = "") => ({ id: crypto.randomUUID?.() ?? String(stamp() + Math.random()), dur, label, state: "idle", endsAt: 0, remain: dur });
const left = (t) => (t.state === "run" ? Math.max(0, t.endsAt - stamp()) : t.state === "done" ? 0 : t.remain);
const save = () => !single && store.set(KEY, timers);
const fmtEnd = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const label = (ms) => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return [h && `${h}시간`, m && `${m}분`, x && `${x}초`].filter(Boolean).join(" ") || "0초"; };

function start(t) { unlock(); if (t.state === "done" || t.remain <= 0) t.remain = t.dur; t.state = "run"; t.endsAt = stamp() + t.remain; save(); askNotify(); keepAwake(true); window.__wantAwake = true; }
function pause(t) { t.remain = left(t); t.state = "pause"; save(); }
function reset(t) { stopRing(t.id); t.state = "idle"; t.remain = t.dur; save(); }
function add(t, ms) { if (t.state === "run") t.endsAt += ms; else { t.remain += ms; t.dur = Math.max(t.dur, t.remain); } save(); }

let stopFlash = null;
function stopRing(id) { const r = rings.get(id); if (r) { r.snd.stop(); r.ov.remove(); rings.delete(id); if (!rings.size) stopFlash?.(); } }
function finish(t) {
  t.state = "done"; t.remain = 0; save();
  const snd = play(cfg.sound, { volume: cfg.vol });
  const ov = el("div", { className: "overlay" }, el("div", { className: "box", role: "alertdialog" },
    el("div", { className: "muted" }, "⏱ 타이머 종료"), el("div", { className: "big" }, label(t.dur)), el("h2", {}, t.label || "시간이 다 됐어요"),
    el("div", { className: "row center mt" }, el("button", { className: "btn lg", id: "t-ok" }, "확인"), el("button", { className: "btn ghost lg", id: "t-again" }, "다시 시작"))));
  document.body.append(ov); rings.set(t.id, { snd, ov });
  stopFlash = flashTitle(t.label || "타이머 종료");
  notify("⏱ 타이머 종료", `${t.label || label(t.dur)}`);
  $("#t-ok", ov).focus();
  $("#t-ok", ov).onclick = () => { stopRing(t.id); render(); };
  $("#t-again", ov).onclick = () => { stopRing(t.id); t.remain = t.dur; start(t); render(); };
  render();
}

const grid = $("#t-grid");
const cards = new Map();
function cardFor(t) {
  const c = {};
  c.name = el("div", { className: "muted small" });
  c.time = el("div", { className: "big", "aria-live": "off" });
  c.bar = el("i"); c.end = el("div", { className: "muted small" });
  const btn = (txt, fn, cls = "btn ghost sm") => { const b = el("button", { className: cls }, txt); b.onclick = () => { fn(); render(); }; return b; };
  c.go = el("button", { className: "btn" }); c.go.onclick = () => { t.state === "run" ? pause(t) : start(t); render(); };
  c.root = el("div", { className: "card timer-card" }, c.name, c.time, el("div", { className: "bar" }, c.bar), c.end,
    el("div", { className: "row center" }, c.go, btn("리셋", () => reset(t)), btn("+1분", () => add(t, 60000)), btn("+5분", () => add(t, 300000))),
    el("div", { className: "row center" }, btn("전체 화면", () => bigTimer(t)), single ? "" : btn("삭제", () => { stopRing(t.id); timers = timers.filter((x) => x !== t); save(); })));
  cards.set(t.id, c); return c;
}
function paint(t, c) {
  const l = left(t);
  c.name.textContent = t.label || (single ? "" : "타이머");
  c.time.textContent = hms(l);
  c.bar.style.width = `${t.dur ? (100 * l) / t.dur : 0}%`;
  c.root.className = "card timer-card " + (t.state === "run" ? "run" : t.state === "done" ? "done" : "");
  c.go.textContent = t.state === "run" ? "일시정지" : t.state === "pause" ? "계속" : t.state === "done" ? "다시 시작" : "시작";
  c.end.textContent = t.state === "run" ? `종료 예정 ${fmtEnd(t.endsAt)}` : t.state === "done" ? "종료됨" : `총 ${label(t.dur)}`;
}
function render() {
  if (!single && !timers.length) grid.replaceChildren(el("p", { className: "muted" }, "타이머가 없어요. 위에서 시간을 고르거나 직접 입력하세요."));
  else { const keep = timers.map((t) => cards.get(t.id)?.root ?? cardFor(t).root); grid.replaceChildren(...keep); }
  for (const t of timers) paint(t, cards.get(t.id));
}
function bigTimer(t) {
  let iv = 0;
  const v = bigView(() => {}, () => clearInterval(iv));
  const time = el("div", { className: "big" }), sub = el("div", { className: "sub" });
  v.box.append(el("div", {}, sub, time));
  const upd = () => { time.textContent = hms(left(t)); sub.textContent = t.label || (t.state === "run" ? `종료 ${fmtEnd(t.endsAt)}` : ""); if (t.state === "done") v.close(); };
  upd(); iv = setInterval(upd, 200);
}

onTick(() => {
  for (const t of timers) if (t.state === "run" && stamp() >= t.endsAt) finish(t);
  const run = timers.filter((t) => t.state === "run");
  for (const t of timers) { const c = cards.get(t.id); if (c) paint(t, c); }
  if (run.length) { const soon = run.reduce((a, b) => (a.endsAt < b.endsAt ? a : b)); setTitle(`${hms(left(soon))} ${soon.label || "타이머"}`); }
  else { setTitle(""); if (window.__wantAwake) { window.__wantAwake = false; keepAwake(false); } }
});

// ── 입력 ──
const inH = $("#t-h"), inM = $("#t-m"), inS = $("#t-s"), inL = $("#t-label");
const readDur = () => ((+inH.value || 0) * 3600 + (+inM.value || 0) * 60 + (+inS.value || 0)) * 1000;
function addTimer(ms, lab = "", go = true) {
  if (ms <= 0) return toast("시간을 입력하세요");
  if (timers.length >= 12) return toast("타이머는 최대 12개까지 만들 수 있어요");
  const t = mk(ms, lab); timers.push(t); if (go) start(t); save(); render(); return t;
}
$("#t-add")?.addEventListener("click", () => { addTimer(readDur(), inL.value.trim().slice(0, 30)); inL.value = ""; });
document.querySelectorAll("[data-sec]").forEach((b) => b.addEventListener("click", () => { addTimer(+b.dataset.sec * 1000); }));
document.querySelectorAll(".t-field").forEach((i) => i.addEventListener("keydown", (e) => e.key === "Enter" && $("#t-add").click()));

// 소리 설정
const sSel = $("#t-sound"), sVol = $("#t-vol");
for (const [k, v] of Object.entries(SOUNDS)) sSel.append(el("option", { value: k }, v));
sSel.value = cfg.sound; sVol.value = cfg.vol;
sSel.onchange = sVol.onchange = () => { cfg = { sound: sSel.value, vol: +sVol.value }; store.set(SKEY, cfg); };
$("#t-preview").onclick = () => { unlock(); preview(sSel.value, +sVol.value); };

// 해시로 바로 만들기: /timer/#10m, #1h30m, #90s
const hm = /^#(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(location.hash);
if (single) timers = [mk(single)];
else if (hm && (hm[1] || hm[2] || hm[3])) { addTimer(((+hm[1] || 0) * 3600 + (+hm[2] || 0) * 60 + (+hm[3] || 0)) * 1000, "", false); history.replaceState(null, "", location.pathname); }
render();
document.addEventListener("keydown", (e) => { if (single && e.code === "Space" && !/INPUT|SELECT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); const t = timers[0]; t.state === "run" ? pause(t) : start(t); render(); } });
