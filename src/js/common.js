import { unlock } from "./sound.js";
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const pad = (n, l = 2) => String(n).padStart(l, "0");
export const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "dataset") Object.assign(e.dataset, v);
    else if (/^aria[A-Z]/.test(k)) e.setAttribute(k.replace(/^aria/, "aria-").toLowerCase(), v);
    else e[k] = v;
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
};

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};

export function hms(ms, { ceil = true } = {}) {
  const s = Math.max(0, ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}
export const humanDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}일`, h && `${h}시간`, (m || (!d && !h)) && `${m}분`].filter(Boolean).join(" ");
};

let toastEl, toastTimer;
export function toast(msg, ms = 2600) {
  toastEl?.remove(); toastEl = el("div", { className: "toast", role: "status" }, msg); document.body.append(toastEl);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl?.remove(), ms);
}

/** 250ms 박자. 워커가 되면 워커로, 아니면 setInterval */
const subs = new Set();
let worker = null, fallback = null;
export function onTick(fn) {
  subs.add(fn);
  if (!worker && !fallback) {
    try { worker = new Worker("/js/tick-worker.js"); worker.onmessage = () => subs.forEach((f) => f()); worker.postMessage("start"); }
    catch { fallback = setInterval(() => subs.forEach((f) => f()), 250); }
  }
  document.addEventListener("visibilitychange", () => !document.hidden && fn());
  return () => subs.delete(fn);
}

// 탭 제목 관리 (알람/타이머 상태를 제목에 보여 준다)
const baseTitle = document.title;
let flashT = null;
export function setTitle(s) { document.title = s ? `${s} · ${baseTitle}` : baseTitle; }
export function flashTitle(msg) { clearInterval(flashT); let on = false; flashT = setInterval(() => { document.title = on ? baseTitle : `🔔 ${msg}`; on = !on; }, 800); return () => { clearInterval(flashT); document.title = baseTitle; }; }

export async function askNotify() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") { try { return await Notification.requestPermission(); } catch { return "denied"; } }
  return Notification.permission;
}
export function notify(title, body) {
  try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, tag: "clock-" + title, requireInteraction: true }); } catch { /* 일부 모바일은 생성자 미지원 */ }
  try { navigator.vibrate?.([400, 200, 400, 200, 800]); } catch { /* noop */ }
}

let wake = null;
export async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => (wake = null)); }
    else if (!on && wake) { await wake.release(); wake = null; }
  } catch { /* 배터리 절약 모드 등에서 거부될 수 있음 */ }
  return !!wake;
}
document.addEventListener("visibilitychange", async () => { if (!document.hidden && window.__wantAwake) await keepAwake(true); });

// 첫 사용자 조작 때 오디오 잠금 해제
addEventListener("pointerdown", () => unlock(), { once: true });

// 테마
const root = document.documentElement;
const savedTheme = store.get("clock.theme", null);
if (savedTheme) root.dataset.theme = savedTheme;
$("#theme")?.addEventListener("click", () => {
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark"; store.set("clock.theme", root.dataset.theme);
});

// 서비스 워커(오프라인 사용)
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});

/** 전체 화면 보기 */
export function bigView(render, onClose) {
  const box = el("div", { className: "fs", role: "dialog", "aria-modal": "true" });
  const close = el("button", { className: "btn ghost", textContent: "닫기 (Esc)", style: "position:fixed;top:16px;right:16px" });
  box.append(close); document.body.append(box);
  try { box.requestFullscreen?.(); } catch { /* noop */ }
  const done = () => { box.remove(); document.fullscreenElement && document.exitFullscreen?.(); document.removeEventListener("keydown", esc); onClose?.(); };
  const esc = (e) => e.key === "Escape" && done();
  document.addEventListener("keydown", esc); close.onclick = done;
  return { box, update: render, close: done };
}
