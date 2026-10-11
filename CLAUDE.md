# 클락 (clock.adbles.com)

온라인 알람시계·타이머·스톱워치·서버 시계·뽀모도로·대한민국 공휴일 조회. 의존성 없는 정적 사이트(Node 스크립트로 `dist/` 생성 → Cloudflare Workers 정적 에셋).

## 명령
```bash
npm test         # 공휴일 계산 검증 (공식 월력요항·보도 날짜와 대조)
npm run build    # dist/ 생성
npm run serve    # 빌드 후 http://localhost:4401
npm run deploy   # 검증+빌드+wrangler deploy (CI가 main 푸시 때 자동 수행)
```

## 구조
| 경로 | 내용 |
|---|---|
| `scripts/build.mjs` | 페이지 생성기(레이아웃·SEO·JSON-LD·사이트맵·자산 복사) |
| `scripts/content.mjs` | 페이지별 본문·FAQ·정책 문서 텍스트 |
| `scripts/test-holidays.mjs` | 공휴일 테스트 |
| `src/js/holidays-compute.js` | 공휴일 계산(Intl 음력 + 대체공휴일 규칙). **빌드·테스트 전용**, dist에 포함되지 않음 |
| `src/js/holiday-calc.js` | 조회·연휴·연차 활용·영업일 계산(순수 함수, 브라우저와 빌드 공용) |
| `src/js/{alarm,timer,stopwatch,time,pomodoro,holidays-ui}.js` | 페이지별 기능 |
| `src/js/{common,sound}.js` | 공용(워커 틱·알림·화면 유지·WebAudio 알람음) |
| `src/sw.js` | 서비스 워커(오프라인) — 빌드 해시로 캐시 버전 교체 |

## 공휴일 데이터 규칙 (가장 중요)
- **추측해서 넣지 않는다.** 날짜·규칙은 공식 자료(공휴일에 관한 법률, 관공서의 공휴일에 관한 규정, 우주항공청 월력요항)로 확인한다.
- 2026년부터 **노동절(5/1)·제헌절(7/17)이 공휴일**이다(2026-05-11 시행 규정). 그 이전 연도에는 넣지 않는다.
- 대체공휴일 규칙: 설·추석 연휴는 일요일/다른 공휴일과 겹칠 때(토요일 제외), 어린이날·삼일절·노동절·부처님오신날·제헌절·광복절·개천절·한글날·성탄절은 토·일/다른 공휴일과 겹칠 때. 신정·현충일·선거일·임시공휴일은 대체 없음. 대체일 = 그 다음 첫 평일 비공휴일.
- **임시공휴일·선거일은 `holidays-compute.js`의 `EXTRAS`에만 추가**한다(`expected: true`면 예정일). 그다음 `scripts/build.mjs`의 `META`에 연도 상태(확정/예상)와 근거를 적고, `scripts/test-holidays.mjs`에 검증 날짜를 더한다.
- 새 연도 월력요항(통상 전년 6월 말 발표)이 나오면: 해당 연도 `META.status`를 “확정”으로, 근거 문구를 갱신하고, 공식 3일 이상 연휴 구간·공휴일 수와 테스트로 대조한다.
- 검증 기준(2026-10-11): 2027년 월력요항(우주항공청 2026-06-29)의 공휴일 24일·실질 72일·3일 이상 연휴 10회와 일치. 2026년은 월력요항(2025-06-30) 대체공휴일(3/2·5/25·8/17·10/5)과 일치. 2026 월력요항 원문(hwp)은 직접 열어 보지 못하고 보도·검색 결과로 교차 확인했다.

## 알림·소리 관련 한계 (문구 유지)
브라우저 앱이라 탭을 닫거나 모바일에서 화면이 잠기면 알람이 울리지 않을 수 있다. 사이트 곳곳에 이 한계를 안내하는 문구를 유지한다(과장 광고 금지).

## 운영 메모
- 도메인 `clock.adbles.com`은 `wrangler.jsonc`의 `routes`(custom_domain)로 연결. 저장소 시크릿 `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID` 필요.
- 월 1회 예약 배포로 새해 공휴일 페이지·사이트맵 날짜를 갱신한다.
- 애드센스·분석은 아직 넣지 않았다. 도입 전 `scripts/content.mjs`의 개인정보처리방침 4항(쿠키·광고)을 먼저 고친다.
- 문의 이메일은 `scripts/build.mjs`의 `SITE.email`.
