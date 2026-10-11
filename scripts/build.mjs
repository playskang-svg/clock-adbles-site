// 정적 사이트 생성기 (의존성 없음). 사용: node scripts/build.mjs  → dist/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { computeYear } from "../src/js/holidays-compute.js";
import { createCalendar, DOW, dow, kstDate } from "../src/js/holiday-calc.js";
import { PAGES_TEXT } from "./content.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const HASH = (() => { const h = crypto.createHash("sha1"); for (const d of ["src/js", "src/css"]) for (const f of fs.readdirSync(path.join(ROOT, d)).sort()) h.update(fs.readFileSync(path.join(ROOT, d, f))); h.update(fs.readFileSync(path.join(ROOT, "scripts/build.mjs"))); h.update(fs.readFileSync(path.join(ROOT, "scripts/content.mjs"))); return h.digest("hex").slice(0, 8); })();
const DIST = path.join(ROOT, "dist");
const SITE = { name: "클락", url: "https://clock.adbles.com", tagline: "온라인 알람·타이머·공휴일", email: "cosmos0302@kakao.com" };
const today = kstDate();
const BUILD_YEAR = +today.slice(0, 4);

// ── 공휴일 데이터 ──
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029];
const META = {
  2024: { status: "확정", note: "지난 연도입니다. 관공서의 공휴일에 관한 규정과 당시 공고 기준입니다." },
  2025: { status: "확정", note: "임시공휴일(1월 27일)과 대통령선거일(6월 3일)을 포함합니다." },
  2026: { status: "확정", note: "우주항공청 2026년 월력요항과 2026년부터 공휴일이 된 노동절(5월 1일)·제헌절(7월 17일)을 반영했습니다. 6월 3일은 지방선거일입니다." },
  2027: { status: "확정", note: "우주항공청이 2026년 6월 29일 발표한 2027년 월력요항 기준입니다. 설날·노동절·제헌절·광복절·개천절·한글날·성탄절의 대체공휴일이 포함됩니다." },
  2028: { status: "예상", note: "월력요항 발표 전(통상 전년 6월 말)이라 법령 규칙으로 계산한 예상값입니다. 임시공휴일은 반영되지 않았고 총선일은 예정일입니다." },
  2029: { status: "예상", note: "법령 규칙으로 계산한 예상값입니다." },
};
const data = {};
for (const y of YEARS) data[y] = computeYear(y).map((h) => ({ d: h.date, n: h.name, t: h.type, ...(h.expected ? { e: 1 } : {}) }));
const cal = createCalendar(data);

// ── 유틸 ──
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const md = (d) => { const [, m, x] = d.split("-").map(Number); return `${m}월 ${x}일(${DOW[dow(d)]})`; };
const write = (p, s) => { const f = path.join(DIST, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const NAV = [["/", "알람"], ["/timer/", "타이머"], ["/stopwatch/", "스톱워치"], ["/time/", "시계"], ["/holidays/", "공휴일"], ["/pomodoro/", "뽀모도로"]];
const ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M16 11v6.5l4 2.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5.5 6.5 9 4M26.5 6.5 23 4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;

const pages = []; // sitemap
function layout({ path: p, title, desc, h1, lead, body, script, jsonld = [], crumbs = [], noindex = false }) {
  const url = SITE.url + p;
  const fullTitle = title.includes(SITE.name) ? title : `${title} | ${SITE.name}`;
  const crumbLd = crumbs.length ? [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ name: "홈", url: SITE.url + "/" }, ...crumbs.map((c) => ({ name: c[0], url: SITE.url + c[1] }))].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })) }] : [];
  const ld = [...jsonld, ...crumbLd].map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("");
  if (!noindex) pages.push(p);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">${noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE.name}"><meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE.url}/og.png"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2563eb"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-192.png">
<link rel="stylesheet" href="/css/app.css?v=${HASH}">${ld}</head>
<body><a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="top"><div class="wrap"><a class="logo" href="/">${ICON}${SITE.name}</a>
<nav class="main" aria-label="주요 메뉴">${NAV.map(([h, n]) => `<a href="${h}"${h === p || (h !== "/" && p.startsWith(h)) ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
<button class="icon-btn" id="theme" aria-label="화면 테마 바꾸기" title="화면 테마">◐</button></div></header>
<main id="main"><div class="wrap">
${crumbs.length ? `<div class="crumbs"><a href="/">홈</a>${crumbs.map((c) => ` › <a href="${c[1]}">${esc(c[0])}</a>`).join("")}</div>` : ""}
<h1>${h1}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}
${body}
</div></main>
<footer class="bottom"><div class="wrap"><div>${NAV.map(([h, n]) => `<a href="${h}">${n}</a>`).join("")}</div><div style="margin-top:8px"><a href="/about/">소개</a><a href="/privacy/">개인정보처리방침</a><a href="/terms/">이용약관</a><a href="/contact/">문의</a></div>
<p class="small" style="margin-top:10px">© ${BUILD_YEAR} ${SITE.name} · 기기에서만 동작하며 알람·타이머 설정은 이 브라우저에만 저장됩니다.</p></div></footer>
${script ? `<script type="module" src="/js/${script}.js?v=${HASH}"></script>` : `<script type="module" src="/js/common.js?v=${HASH}"></script>`}
</body></html>`;
}

const faqLd = (items) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
const faqHtml = (items) => `<section class="faq mt2"><h2>자주 묻는 질문</h2>${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</section>`;
const appLd = (name, desc, path_) => ({ "@context": "https://schema.org", "@type": "WebApplication", name, description: desc, url: SITE.url + path_, applicationCategory: "UtilitiesApplication", operatingSystem: "Any", inLanguage: "ko", offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" } });
const T = PAGES_TEXT;

// 공용 폼 조각
const soundField = (idp) => `<div class="row" style="margin-top:12px"><label class="f">알람음<select id="${idp}-sound"></select></label><label class="f" style="flex:1;min-width:140px">볼륨<input type="range" id="${idp}-vol" min="0.1" max="1" step="0.05" value="0.8"></label><button type="button" class="btn ghost sm" id="${idp}-preview">미리듣기</button></div>`;
const hmsFields = `<div class="hms"><label class="f">시간<input class="t-field" id="t-h" type="number" min="0" max="99" inputmode="numeric" placeholder="0"></label><label class="f">분<input class="t-field" id="t-m" type="number" min="0" max="999" inputmode="numeric" placeholder="0"></label><label class="f">초<input class="t-field" id="t-s" type="number" min="0" max="59" inputmode="numeric" placeholder="0"></label></div>`;

// ═════════ 알람 (홈) ═════════
const QUICK = ["05:00", "06:00", "06:30", "07:00", "07:30", "08:00", "09:00", "12:00", "18:00", "22:00"];
write("index.html", layout({
  path: "/", title: "온라인 알람시계 · 자명종 — 반복·스누즈·공휴일 제외", h1: "온라인 알람시계",
  desc: "설치 없이 쓰는 온라인 알람시계(자명종). 여러 개 알람, 요일 반복, 스누즈, 소리 점점 커지기, 공휴일에는 울리지 않기까지. 한국 공휴일 데이터 내장.",
  lead: "시간을 정하고 ‘알람 추가’만 누르세요. 요일 반복·스누즈·6가지 알람음을 지원하고, <b>공휴일에는 울리지 않게</b> 설정할 수도 있어요.",
  jsonld: [appLd("온라인 알람시계", "여러 개 알람, 요일 반복, 스누즈, 공휴일 제외를 지원하는 온라인 자명종", "/"), faqLd(T.alarmFaq)],
  script: "alarm",
  body: `<div class="grid g2">
<section class="card"><div class="clock-hero"><div class="big" id="a-now">--:--:--</div><div class="sub" id="a-next" aria-live="polite"></div></div>
<form id="a-form"><div class="row"><label class="f">알람 시간<input type="time" id="a-time" required></label><label class="f" style="flex:1;min-width:160px">이름(선택)<input type="text" id="a-label" maxlength="40" placeholder="예: 출근 준비"></label></div>
<div class="chips mt" aria-label="빠른 시간 선택">${QUICK.map((t) => `<button type="button" class="chip" data-time="${t}">${t}</button>`).join("")}</div>
<h3>반복</h3><div class="row"><div class="days" id="a-days">${DOW.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="false" class="${i === 0 ? "sun" : ""}" aria-label="${d}요일">${d}</button>`).join("")}</div>
<button type="button" class="chip" id="a-once" >한 번만</button><button type="button" class="chip" data-set="weekday" aria-pressed="false">평일</button><button type="button" class="chip" data-set="weekend" aria-pressed="false">주말</button><button type="button" class="chip" data-set="all" aria-pressed="false">매일</button></div>
${soundField("a")}
<div class="row mt"><label class="f">스누즈<select id="a-snooze"><option value="5">5분</option><option value="10">10분</option><option value="15">15분</option><option value="3">3분</option></select></label></div>
<div class="mt"><label class="opt"><span class="sw"><input type="checkbox" id="a-ramp"></span><span>소리 점점 크게 (30초에 걸쳐)</span></label>
<label class="opt mt"><span class="sw"><input type="checkbox" id="a-skip"></span><span>대한민국 공휴일에는 울리지 않기</span></label>
<label class="opt mt"><span class="sw"><input type="checkbox" id="a-wake"></span><span>알람이 켜져 있는 동안 화면 꺼짐 방지</span></label><div class="small muted" id="wake-state"></div></div>
<div class="row mt"><button class="btn lg" id="a-add" type="submit">알람 추가</button></div></form></section>
<section class="card"><h2 style="margin-top:0">내 알람</h2><div id="a-list"></div><div class="statusbar" id="a-status"></div>
<div class="notice mt"><b>꼭 알아두세요</b> 알람은 이 페이지가 열려 있는 동안 울려요. 스마트폰에서 화면이 잠기거나 브라우저를 닫으면 울리지 않을 수 있으니, 중요한 아침 알람은 기기 기본 알람 앱도 함께 쓰세요.</div></section></div>
${T.alarmBody}${faqHtml(T.alarmFaq)}`,
}));

// ═════════ 타이머 ═════════
const PRESETS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 45, 60];
const presetLinks = `<div class="preset-grid">${PRESETS.map((m) => `<a href="/timer/${m}-minute/">${m === 60 ? "1시간" : m + "분"}</a>`).join("")}</div>`;
write("timer/index.html", layout({
  path: "/timer/", title: "온라인 타이머 — 여러 개 동시, 전체 화면, 종료 알림", h1: "온라인 타이머",
  desc: "시·분·초를 입력하면 바로 시작하는 온라인 카운트다운 타이머. 여러 개 동시 실행, 전체 화면, 소리·알림, 새로고침해도 유지됩니다.",
  lead: "빠른 버튼을 누르거나 시간을 입력하세요. <b>타이머를 여러 개 동시에</b> 돌릴 수 있고, 새로고침해도 이어집니다.",
  jsonld: [appLd("온라인 타이머", "여러 개를 동시에 쓰는 카운트다운 타이머", "/timer/"), faqLd(T.timerFaq)], crumbs: [["타이머", "/timer/"]], script: "timer",
  body: `<main id="app"><section class="card"><div class="chips" aria-label="빠른 타이머">${[[60, "1분"], [180, "3분"], [300, "5분"], [600, "10분"], [900, "15분"], [1500, "25분"], [1800, "30분"], [3600, "1시간"]].map(([s, n]) => `<button class="chip" data-sec="${s}">${n}</button>`).join("")}</div>
<div class="row mt" style="align-items:end">${hmsFields}<label class="f" style="flex:1;min-width:140px">이름(선택)<input type="text" id="t-label" maxlength="30" placeholder="예: 라면"></label><button class="btn lg" id="t-add">시작</button></div>${soundField("t")}</section>
<div class="grid g2 mt" id="t-grid"></div></main>
<p class="small muted">링크로 바로 만들기: <code>/timer/#10m</code>, <code>/timer/#1h30m</code>, <code>/timer/#90s</code></p>
<h2>자주 쓰는 타이머</h2>${presetLinks}${T.timerBody}${faqHtml(T.timerFaq)}`,
}));
for (const m of PRESETS) {
  const label = m === 60 ? "1시간" : `${m}분`, tx = T.presets[m];
  write(`timer/${m}-minute/index.html`, layout({
    path: `/timer/${m}-minute/`, title: `${label} 타이머 — 온라인 카운트다운`, h1: `${label} 타이머`,
    desc: `${label} 타이머를 바로 시작하세요. ${tx.use} 종료 시 소리와 알림, 전체 화면 지원.`,
    lead: `버튼을 누르면 ${label} 카운트다운이 시작됩니다. 스페이스바로도 시작·일시정지할 수 있어요.`,
    jsonld: [appLd(`${label} 타이머`, `${label} 카운트다운 타이머`, `/timer/${m}-minute/`)], crumbs: [["타이머", "/timer/"], [`${label} 타이머`, `/timer/${m}-minute/`]], script: "timer",
    body: `<main id="app" data-duration="${m * 60}"><div class="grid" style="max-width:520px;margin:0 auto"><div id="t-grid"></div><div class="card">${soundField("t")}</div></div></main>
<h2>${label}은 이럴 때 써요</h2><p>${esc(tx.use)}</p><p class="muted">${esc(tx.tip)}</p>
<h2>다른 시간 타이머</h2>${presetLinks}<p class="mt"><a href="/timer/">직접 시간 입력하기 · 여러 타이머 동시 사용 →</a></p>`,
  }));
}

// ═════════ 스톱워치 ═════════
write("stopwatch/index.html", layout({
  path: "/stopwatch/", title: "온라인 스톱워치 — 랩 기록·최고/최저 표시", h1: "온라인 스톱워치",
  desc: "1/100초까지 재는 온라인 스톱워치. 랩(구간) 기록, 최고·최저 구간 표시, CSV 복사, 키보드 단축키, 새로고침해도 유지됩니다.",
  lead: "스페이스바로 시작·정지, <kbd>L</kbd> 랩, <kbd>R</kbd> 리셋. 새로고침하거나 탭을 닫았다 열어도 측정이 이어져요.",
  jsonld: [appLd("온라인 스톱워치", "랩 기록을 지원하는 스톱워치", "/stopwatch/"), faqLd(T.swFaq)], crumbs: [["스톱워치", "/stopwatch/"]], script: "stopwatch",
  body: `<section class="card"><div class="clock-hero"><div class="big" id="sw-time" aria-live="off">00:00.00</div></div>
<div class="row center"><button class="btn lg" id="sw-go">시작</button><button class="btn ghost lg" id="sw-lap">랩</button><button class="btn ghost lg" id="sw-reset">리셋</button></div></section>
<section class="card mt hide" id="sw-table"><div class="row"><h2 style="margin:0">랩 기록</h2><span class="sp"></span><button class="btn ghost sm" id="sw-copy">CSV 복사</button></div>
<table class="laps"><thead><tr><th>구간</th><th>구간 기록</th><th>누적</th></tr></thead><tbody id="sw-laps"></tbody></table><p class="small muted">초록=가장 빠른 구간, 빨강=가장 느린 구간</p></section>
${T.swBody}${faqHtml(T.swFaq)}`,
}));

// ═════════ 시계 ═════════
write("time/index.html", layout({
  path: "/time/", title: "현재 시각 · 서버 시간 — 밀리초 단위 정확한 시계", h1: "현재 시각 (서버 시간)",
  desc: "내 기기 시계가 아니라 서버 시간으로 보정한 정확한 현재 시각. 밀리초 표시, 내 기기와의 오차 측정, 세계 시계, 음력·주차·올해 몇 번째 날까지.",
  lead: "서버에서 받은 시간으로 내 기기와의 오차를 측정해 보정합니다. 수강신청·티켓팅·예약 때 몇 초가 필요할 때 써보세요.",
  jsonld: [appLd("서버 시간 시계", "서버 시간으로 보정한 정확한 현재 시각", "/time/"), faqLd(T.timeFaq)], crumbs: [["시계", "/time/"]], script: "time",
  body: `<section class="card"><div class="clock-hero"><div class="big" id="now" aria-live="off">--:--:--</div><div class="sub" id="date"></div></div>
<div class="statusbar" id="facts" style="justify-content:center"></div>
<div class="row center"><span class="small muted" id="sync-state"></span><button class="btn ghost sm" id="resync">다시 측정</button><label class="opt small"><span class="sw" style="transform:scale(.8)"><input type="checkbox" id="t-ms"></span>밀리초 표시</label></div></section>
<section class="card mt"><div class="row"><h2 style="margin:0">세계 시계</h2><span class="sp"></span><select id="c-pick" aria-label="도시"></select><button class="btn sm" id="c-add">추가</button></div><div id="c-list" class="mt"></div></section>
${T.timeBody}${faqHtml(T.timeFaq)}`,
}));

// ═════════ 뽀모도로 ═════════
write("pomodoro/index.html", layout({
  path: "/pomodoro/", title: "뽀모도로 타이머 — 25분 집중·5분 휴식", h1: "뽀모도로 타이머",
  desc: "25분 집중, 5분 휴식을 자동으로 이어 주는 온라인 뽀모도로 타이머. 집중·휴식 시간과 라운드 수를 바꿀 수 있고 오늘 완료한 세션을 세어 줍니다.",
  lead: "집중 25분 → 휴식 5분을 반복하고, 4라운드마다 긴 휴식을 가져요. 시간은 모두 바꿀 수 있어요.",
  jsonld: [appLd("뽀모도로 타이머", "집중과 휴식을 자동으로 전환하는 타이머", "/pomodoro/"), faqLd(T.pomoFaq)], crumbs: [["뽀모도로", "/pomodoro/"]], script: "pomodoro",
  body: `<div class="grid g2"><section class="card center"><span id="p-phase" class="tag">집중</span><div class="big" id="p-time" style="font-size:clamp(3.5rem,16vw,6.5rem);margin:12px 0">25:00</div><div class="bar"><i id="p-bar"></i></div>
<div class="muted small mt" id="p-round"></div><div class="row center mt"><button class="btn lg" id="p-go">시작</button><button class="btn ghost lg" id="p-skip">건너뛰기</button><button class="btn ghost lg" id="p-reset">처음부터</button></div><p class="muted mt" id="p-count"></p></section>
<section class="card"><h2 style="margin-top:0">설정(분)</h2><div class="row"><label class="f">집중<input type="number" id="p-focus" min="1" max="180"></label><label class="f">짧은 휴식<input type="number" id="p-short" min="1" max="60"></label><label class="f">긴 휴식<input type="number" id="p-long" min="1" max="120"></label><label class="f">긴 휴식까지<input type="number" id="p-rounds" min="1" max="12"></label></div>
<label class="opt mt"><span class="sw"><input type="checkbox" id="p-auto"></span><span>다음 단계 자동 시작</span></label><div class="row mt"><label class="f">끝날 때 소리<select id="p-sound"></select></label></div></section></div>
${T.pomoBody}${faqHtml(T.pomoFaq)}`,
}));

// ═════════ 공휴일 ═════════
function holidayYearBody(y, live) {
  const list = cal.list(y), meta = META[y], runs = cal.runs(y).filter((r) => r.start.slice(0, 4) === String(y) || r.end.slice(0, 4) === String(y));
  const typeName = { holiday: "법정 공휴일", substitute: "대체공휴일", election: "선거일", temporary: "임시공휴일" };
  const b = [1, 2, 3].map((k) => [k, cal.bridges(y, k, 2)]);
  const sundays = list.filter((h) => dow(h.d) === 0).length;
  return `<div class="statusbar"><span class="tag ${meta.status === "확정" ? "ok" : "warn"}">${meta.status}</span><span class="tag">공휴일 ${list.length}일 (일요일과 겹침 ${sundays}일)</span><span class="tag">3일 이상 연휴 ${runs.length}번</span></div><p class="small muted">${esc(meta.note)}</p>
<h2>${y}년 공휴일 목록</h2><div class="card" style="padding:4px 12px"><table class="tbl"><thead><tr><th>날짜</th><th>요일</th><th>명칭</th><th>구분</th></tr></thead><tbody>
${list.map((h) => `<tr data-d="${h.d}"><td>${h.d.slice(5).replace("-", "월 ")}일</td><td ${dow(h.d) === 0 || dow(h.d) === 6 ? 'style="color:var(--hol)"' : ""}>${DOW[dow(h.d)]}</td><td><b>${esc(h.n)}</b>${h.e ? ' <span class="tag warn">예정</span>' : ""}</td><td>${typeName[h.t] ?? "공휴일"}</td></tr>`).join("")}</tbody></table></div>
<h2>${y}년 연휴 (3일 이상)</h2>${runs.length ? `<div class="card" style="padding:4px 12px"><table class="tbl"><tbody>${runs.map((r) => `<tr><td><b>${md(r.start)} ~ ${md(r.end)}</b></td><td>${r.len}일</td><td class="muted">${esc([...new Set(r.names)].join(", "))}</td></tr>`).join("")}</tbody></table></div><p class="small muted">토·일요일과 공휴일을 이어서 센 기간입니다(주 5일 근무 기준).</p>` : "<p>3일 이상 이어지는 연휴가 없어요.</p>"}
<h2>연차 활용 가이드 ${y}</h2><p class="muted">연차를 몇 일 쓰느냐에 따라 만들 수 있는 가장 긴 연휴입니다.</p>
${b.map(([k, r]) => `<h3>연차 ${k}일</h3>${r.length ? `<ul>${r.map((x) => `<li><b>${md(x.start)} ~ ${md(x.end)}</b> (${x.len}일 연속) — 연차 ${x.leave.map(md).join(", ")}</li>`).join("")}</ul>` : "<p class=muted>해당 없음</p>"}`).join("")}`;
}
const yearLinks = (cur) => `<div class="chips mt">${YEARS.slice(0, -1).map((y) => `<a class="chip" href="/holidays/${y}/" ${y === cur ? 'aria-pressed="true"' : ""} style="text-decoration:none">${y}년</a>`).join("")}</div>`;
const liveWidgets = (y) => `<div class="grid g2"><section class="card"><div class="muted small">오늘</div><div id="h-today" style="font-size:1.15rem;margin:6px 0 14px"></div>
<div id="h-next" class="hide"><div class="muted small">다음 공휴일</div><div style="font-size:1.2rem;font-weight:700" id="h-next-name"></div><div class="row"><span class="big dd" id="h-next-dd" style="font-size:2.6rem"></span><span class="big" id="h-next-t" style="font-size:1.5rem"></span></div><div class="muted small" id="h-next-run"></div></div></section>
<section class="card"><div class="muted small">날짜 하나 조회</div><div class="row mt"><input type="date" id="q-date" aria-label="조회할 날짜"></div><div id="q-res" class="mt"></div></section></div>
<h2>${y}년 달력</h2><div class="months" id="h-months"></div><p class="small muted">빨간 배경은 공휴일, 점이 있는 날은 대체공휴일입니다.</p>
<h2>연차 활용 연휴 찾기</h2><div class="row"><label class="f">쓸 연차<select id="b-k">${[1, 2, 3, 4, 5].map((k) => `<option value="${k}">${k}일</option>`).join("")}</select></label></div><div class="grid g2 mt" id="b-out"></div>
<h2>영업일 계산기</h2><div class="card"><div class="row"><label class="f">시작일<input type="date" id="c-a"></label><label class="f">종료일<input type="date" id="c-b"></label></div><p id="c-r1" class="mt"></p>
<div class="row mt"><label class="f">시작일에서 며칠 뒤(영업일, 음수는 이전)<input type="number" id="c-n" value="10"></label></div><p id="c-r2" class="mt"></p></div>`;
const holidaySeo = (y) => `<h2>공휴일 데이터 기준과 갱신</h2><p class="muted">${esc(T.holidaySource)}</p>`;
function holidayPage(y, p, h1, live) {
  const faq = T.holidayFaq(y);
  write(`${p === "/holidays/" ? "holidays" : "holidays/" + y}/index.html`, layout({
    path: p, title: `${y}년 공휴일 · 대체공휴일 · 연휴 달력`, h1,
    desc: `${y}년 대한민국 공휴일과 대체공휴일, 3일 이상 연휴, 연차 붙여 쓰는 방법을 한눈에. 오늘이 공휴일인지, 다음 공휴일까지 D-day도 실시간으로 확인하세요.`,
    lead: `오늘이 공휴일인지, 다음 공휴일은 언제인지 실시간으로 알려 드려요. 대체공휴일과 연휴, 연차 활용법까지 정리했어요.`,
    jsonld: [appLd("공휴일 조회", "대한민국 공휴일 실시간 조회·연휴·영업일 계산", p), faqLd(faq)], crumbs: p === "/holidays/" ? [["공휴일", "/holidays/"]] : [["공휴일", "/holidays/"], [`${y}년`, p]], script: "holidays-ui",
    body: `<div id="h-app" data-year="${y}">${liveWidgets(y)}</div>${yearLinks(y)}${holidayYearBody(y, live)}${holidaySeo(y)}${faqHtml(faq)}`,
  }));
}
holidayPage(BUILD_YEAR, "/holidays/", `${BUILD_YEAR}년 공휴일 조회`, true);
for (const y of YEARS.slice(0, -1)) holidayPage(y, `/holidays/${y}/`, `${y}년 공휴일 · 대체공휴일`, false);

// ═════════ 정책·소개 ═════════
for (const [slug, t] of Object.entries(T.static)) {
  write(`${slug}/index.html`, layout({ path: `/${slug}/`, title: t.title, h1: t.h1, desc: t.desc, lead: t.lead, body: t.body(SITE), crumbs: [[t.h1, `/${slug}/`]] }));
}
write("404.html", layout({ path: "/404", title: "페이지를 찾을 수 없어요", h1: "페이지를 찾을 수 없어요", desc: "요청하신 페이지가 없습니다.", body: `<p>주소가 바뀌었거나 없는 페이지예요. 아래에서 찾아보세요.</p><div class="preset-grid">${NAV.map(([h, n]) => `<a href="${h}">${n}</a>`).join("")}</div>`, noindex: true }));

// ═════════ 정적 자산 ═════════
function copyDir(from, to) { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, f.name), b = path.join(to, f.name); f.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); } }
copyDir(path.join(ROOT, "src/js"), path.join(DIST, "js"));
for (const f of ["holidays-compute.js"]) fs.rmSync(path.join(DIST, "js", f), { force: true }); // 빌드 전용
write("js/holiday-data.js", `// 자동 생성 — scripts/build.mjs\nexport default ${JSON.stringify({ generated: today, years: data, meta: META })};\n`);
copyDir(path.join(ROOT, "src/css"), path.join(DIST, "css"));
if (fs.existsSync(path.join(ROOT, "public"))) copyDir(path.join(ROOT, "public"), DIST);
const urls = [...new Set(pages)].sort();
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE.url}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
const swSrc = fs.readFileSync(path.join(ROOT, "src/sw.js"), "utf8").replace("__VERSION__", HASH);
write("sw.js", swSrc);
console.log(`built ${urls.length} pages → dist/ (${HASH})`);

