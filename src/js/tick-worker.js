// 백그라운드 탭에서도 타이머가 밀리지 않도록 워커에서 박자를 보낸다.
let id = null;
self.onmessage = (e) => {
  if (e.data === "start" && id === null) id = setInterval(() => self.postMessage(1), 250);
  if (e.data === "stop") { clearInterval(id); id = null; }
};
