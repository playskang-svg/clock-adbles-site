import { $, el, store, toast, onTick, hms, setTitle, flashTitle, askNotify, notify, keepAwake } from "./common.js";
import { play, unlock, preview, SOUNDS } from "./sound.js";
import { kstDate } from "./holiday-calc.js";

const KEY = "clock.pomo.v1";
let cfg = { focus: 25, short: 5, long: 15, rounds: 4, auto: true, sound: "chime", vol: 0.7 };
let st = { phase: "focus", round: 1, run: false, endsAt: 0, remain: 0, done: {} };
Object.assign(cfg, store.get(KEY + ".cfg", {})); Object.assign(st, store.get(KEY + ".st", {}));
const dur = (p) => (p === "focus" ? cfg.focus : p === "short" ? cfg.short : cfg.long) * 60000;
if (!st.remain) st.remain = dur(st.phase);
const NAME = { focus: "집중", short: "짧은 휴식", long: "긴 휴식" };
const save = () => { store.set(KEY + ".cfg", cfg); store.set(KEY + ".st", st); };
const left = () => (st.run ? Math.max(0, st.endsAt - Date.now()) : st.remain);

const time = $("#p-time"), phase = $("#p-phase"), bar = $("#p-bar"), go = $("#p-go"), cnt = $("#p-count"), round = $("#p-round");
function draw() {
  const l = left();
  time.textContent = hms(l, { ceil: true }).replace(/^(\d\d:\d\d)$/, "$1");
  phase.textContent = NAME[st.phase]; phase.className = "tag " + (st.phase === "focus" ? "hol" : "ok");
  bar.style.width = `${(100 * l) / dur(st.phase)}%`;
  go.textContent = st.run ? "일시정지" : "시작";
  round.textContent = `${st.round} / ${cfg.rounds} 라운드`;
  const today = kstDate(); cnt.textContent = `오늘 완료한 집중 세션: ${st.done[today] ?? 0}개`;
  setTitle(st.run ? `${NAME[st.phase]} ${hms(l)}` : "");
}
function next() {
  if (st.phase === "focus") { const t = kstDate(); st.done = { [t]: (st.done[t] ?? 0) + 1 }; if (st.round >= cfg.rounds) { st.phase = "long"; } else st.phase = "short"; }
  else { if (st.phase === "long") st.round = 1; else st.round++; st.phase = "focus"; }
  st.remain = dur(st.phase);
  if (cfg.auto) { st.run = true; st.endsAt = Date.now() + st.remain; } else st.run = false;
  save(); draw();
}
let stopF = null;
onTick(() => {
  if (st.run && Date.now() >= st.endsAt) {
    const p = st.phase; const s = play(cfg.sound, { volume: cfg.vol, maxSec: 6 });
    notify(p === "focus" ? "집중 시간 끝! 쉬어가세요" : "휴식 끝! 다시 집중해요", `${NAME[p]} 종료`);
    stopF?.(); stopF = flashTitle(p === "focus" ? "휴식 시간" : "집중 시간"); setTimeout(() => stopF?.(), 8000);
    next();
  }
  draw();
});
go.onclick = () => { unlock(); if (st.run) { st.remain = left(); st.run = false; } else { st.endsAt = Date.now() + st.remain; st.run = true; askNotify(); keepAwake(true); window.__wantAwake = true; } save(); draw(); };
$("#p-skip").onclick = () => { st.run = false; const a = cfg.auto; cfg.auto = false; next(); cfg.auto = a; };
$("#p-reset").onclick = () => { st = { phase: "focus", round: 1, run: false, endsAt: 0, remain: dur("focus"), done: st.done }; save(); draw(); };

for (const [id, k] of [["p-focus", "focus"], ["p-short", "short"], ["p-long", "long"], ["p-rounds", "rounds"]]) {
  const i = $("#" + id); i.value = cfg[k];
  i.onchange = () => { cfg[k] = Math.max(1, Math.min(180, +i.value || cfg[k])); i.value = cfg[k]; if (!st.run && k !== "rounds") st.remain = dur(st.phase); save(); draw(); };
}
const auto = $("#p-auto"); auto.checked = cfg.auto; auto.onchange = () => { cfg.auto = auto.checked; save(); };
const sSel = $("#p-sound"); for (const [k, v] of Object.entries(SOUNDS)) sSel.append(el("option", { value: k }, v)); sSel.value = cfg.sound;
sSel.onchange = () => { cfg.sound = sSel.value; save(); unlock(); preview(cfg.sound, cfg.vol); };
draw();
