import { $, el, pad, store, toast, setTitle } from "./common.js";

const KEY = "clock.sw.v1";
let s = { run: false, base: 0, at: 0, laps: [], ...store.get(KEY, {}) }; // base: 누적 ms, at: 시작 시각
const elapsed = () => s.base + (s.run ? Date.now() - s.at : 0);
const save = () => store.set(KEY, s);
const fmt = (ms, cs = true) => {
  const t = Math.floor(ms / 10), c = t % 100, sec = Math.floor(t / 100) % 60, m = Math.floor(t / 6000) % 60, h = Math.floor(t / 360000);
  return `${h ? pad(h) + ":" : ""}${pad(m)}:${pad(sec)}${cs ? "." + pad(c) : ""}`;
};

const disp = $("#sw-time"), go = $("#sw-go"), lap = $("#sw-lap"), rst = $("#sw-reset"), body = $("#sw-laps");
function draw() {
  disp.textContent = fmt(elapsed());
  go.textContent = s.run ? "정지" : s.base ? "계속" : "시작";
  lap.disabled = !s.run; rst.disabled = !s.base && !s.run;
  setTitle(s.run ? fmt(elapsed(), false) : "");
}
function laps() {
  body.replaceChildren();
  if (!s.laps.length) { $("#sw-table").classList.add("hide"); return; }
  $("#sw-table").classList.remove("hide");
  const splits = s.laps.map((t, i) => t - (s.laps[i - 1] ?? 0));
  const best = Math.min(...splits), worst = Math.max(...splits);
  [...s.laps].reverse().forEach((t, ri) => {
    const i = s.laps.length - 1 - ri;
    body.append(el("tr", {}, el("td", {}, `#${i + 1}`), el("td", { className: s.laps.length > 1 ? (splits[i] === best ? "best" : splits[i] === worst ? "worst" : "") : "" }, `+${fmt(splits[i])}`), el("td", {}, fmt(t))));
  });
}
function toggle() { if (s.run) { s.base = elapsed(); s.run = false; } else { s.at = Date.now(); s.run = true; } save(); draw(); }
function doLap() { if (!s.run) return; s.laps.push(elapsed()); save(); laps(); }
function reset() { s = { run: false, base: 0, at: 0, laps: [] }; save(); draw(); laps(); }
go.onclick = toggle; lap.onclick = doLap; rst.onclick = reset;
$("#sw-copy").onclick = async () => {
  const rows = ["구간,구간 기록,누적 기록", ...s.laps.map((t, i) => `${i + 1},${fmt(t - (s.laps[i - 1] ?? 0))},${fmt(t)}`)].join("\n");
  try { await navigator.clipboard.writeText(rows); toast("랩 기록을 복사했어요 (CSV)"); } catch { toast("복사하지 못했어요"); }
};
addEventListener("keydown", (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === "Space") { e.preventDefault(); toggle(); }
  else if (e.key === "l" || e.key === "L") doLap();
  else if (e.key === "r" || e.key === "R") reset();
});
(function loop() { draw(); requestAnimationFrame(loop); })();
laps();
