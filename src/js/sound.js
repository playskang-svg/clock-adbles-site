// 외부 음원 없이 WebAudio로 합성한 알람음. 한 번 예약해 두므로 탭이 백그라운드여도 끊기지 않는다.
let ctx = null;
export function unlock() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(c, dest, { f, t, d, type = "sine", g = 0.5, f2 = null, attack = 0.005 }) {
  const o = c.createOscillator(), a = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.linearRampToValueAtTime(f2, t + d);
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(g, t + attack);
  a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(a).connect(dest); o.start(t); o.stop(t + d + 0.05);
}

// 각 패턴은 한 사이클을 예약하고 사이클 길이(초)를 돌려준다.
const PATTERNS = {
  classic(c, t, out) { for (let i = 0; i < 4; i++) { const s = t + i * 0.2; tone(c, out, { f: 880, t: s, d: 0.5, g: 0.5 }); tone(c, out, { f: 1760, t: s, d: 0.3, g: 0.2 }); } return 1.7; },
  digital(c, t, out) { for (let i = 0; i < 4; i++) tone(c, out, { f: 1000, t: t + i * 0.2, d: 0.1, type: "square", g: 0.28, attack: 0.002 }); return 1.4; },
  chime(c, t, out) { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, out, { f, t: t + i * 0.28, d: 1.3, g: 0.45 })); return 2.8; },
  siren(c, t, out) { tone(c, out, { f: 600, f2: 1200, t, d: 0.9, type: "sawtooth", g: 0.22, attack: 0.05 }); tone(c, out, { f: 1200, f2: 600, t: t + 0.9, d: 0.9, type: "sawtooth", g: 0.22, attack: 0.05 }); return 1.8; },
  melody(c, t, out) { [392, 523.25, 659.25, 523.25, 587.33, 783.99, 659.25, 523.25].forEach((f, i) => tone(c, out, { f, t: t + i * 0.26, d: 0.45, type: "triangle", g: 0.5 })); return 2.6; },
  radar(c, t, out) { tone(c, out, { f: 1500, t, d: 0.7, g: 0.5 }); tone(c, out, { f: 1500, t: t + 0.12, d: 0.7, g: 0.2 }); return 1.6; },
};
export const SOUNDS = { classic: "클래식 벨", digital: "디지털 비프", chime: "부드러운 차임", siren: "사이렌", melody: "멜로디", radar: "레이더" };

/** 알람음 재생. 반환값의 stop()으로 끈다. maxSec(기본 5분) 뒤 자동 종료 */
export function play(kind = "classic", { volume = 0.8, ramp = false, maxSec = 300 } = {}) {
  const c = unlock();
  if (!c) return { stop() {} };
  const pat = PATTERNS[kind] || PATTERNS.classic;
  const master = c.createGain();
  const now = c.currentTime;
  if (ramp) { master.gain.setValueAtTime(volume * 0.15, now); master.gain.linearRampToValueAtTime(volume, now + 30); } else master.gain.setValueAtTime(volume, now);
  master.connect(c.destination);
  let t = now + 0.05, stopped = false;
  const horizon = () => { while (!stopped && t < c.currentTime + 45 && t < now + maxSec) t += pat(c, t, master); };
  horizon();
  const iv = setInterval(horizon, 15000);
  const stop = () => {
    if (stopped) return; stopped = true; clearInterval(iv);
    master.gain.cancelScheduledValues(c.currentTime); master.gain.setTargetAtTime(0, c.currentTime, 0.03);
    setTimeout(() => master.disconnect(), 300);
  };
  setTimeout(stop, maxSec * 1000);
  return { stop };
}

/** 미리듣기(약 2초) */
export function preview(kind, volume = 0.8) { const p = play(kind, { volume, maxSec: 2.4 }); setTimeout(p.stop, 2400); return p; }
