const FAMILIES_DEFAULT = { min: 1, max: 99, label: "De 1 a 99" };
const MIN_BALLOONS = 2;
const MAX_BALLOONS = 10;
const BALLOON_WIDTH_MAX = 63;
const BALLOON_HEIGHT_MAX = 116;
const MAZE_WALLS = [
  { left: 8, top: 18, width: 30, height: 4 },
  { left: 58, top: 18, width: 30, height: 4 },
  { left: 18, top: 38, width: 4, height: 28 },
  { left: 38, top: 42, width: 24, height: 4 },
  { left: 76, top: 36, width: 4, height: 32 },
  { left: 11, top: 78, width: 34, height: 4 },
  { left: 58, top: 76, width: 30, height: 4 }
];

const state = {
  family: FAMILIES_DEFAULT,
  balloons: [],
  score: 0,
  audio: true,
  voice: null,
  running: false
};

const els = {
  menu: document.querySelector("#menuScreen"),
  play: document.querySelector("#playScreen"),
  stage: document.querySelector("#stage"),
  familyTitle: document.querySelector("#familyTitle"),
  score: document.querySelector("#scoreValue"),
  feedback: document.querySelector("#feedback"),
  popSound: document.querySelector("#popSound"),
  audioButtons: [document.querySelector("#audioMenu"), document.querySelector("#audioPlay")]
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function sampleValues() {
  const pool = Array.from({ length: state.family.max - state.family.min + 1 }, (_, index) => state.family.min + index);
  const limit = Math.min(MAX_BALLOONS, pool.length);
  const count = randomInt(Math.min(MIN_BALLOONS, limit), limit);
  return shuffle(pool).slice(0, count);
}

function showScreen(name) {
  const play = name === "play";
  els.menu.classList.toggle("is-active", !play);
  els.play.classList.toggle("is-active", play);
}

function startFamily(button) {
  const min = Number(button.dataset.min);
  const max = Number(button.dataset.max);
  state.family = { min, max, label: button.textContent.trim() };
  document.querySelectorAll(".family-button").forEach((item) => item.classList.remove("is-selected"));
  button.classList.add("is-selected");
  state.score = 0;
  showScreen("play");
  resetGame();
  speak(`${state.family.label}. Revienta los globos de mayor a menor.`);
}

function resetGame() {
  const values = sampleValues();
  state.balloons = values.map((value, index) => ({
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${value}-${Date.now()}-${index}`,
    value,
    x: 0,
    y: 0,
    dx: (Math.random() > 0.5 ? 0.38 : -0.38) * (0.85 + Math.random() * 0.45),
    dy: (Math.random() > 0.5 ? 0.3 : -0.3) * (0.85 + Math.random() * 0.45),
    popped: false
  }));
  state.running = true;
  els.familyTitle.textContent = `Familia: ${state.family.label}`;
  updateScore();
  positionBalloons();
  render();
  setFeedback("Selecciona el globo con el numero mayor.");
}

function positionBalloons() {
  const rect = els.stage.getBoundingClientRect();
  const cols = Math.min(3, state.balloons.length);
  const rows = Math.ceil(state.balloons.length / cols);
  state.balloons.forEach((balloon, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    balloon.x = ((col + 0.5) / cols) * Math.max(rect.width - 120, 260);
    balloon.y = ((row + 0.55) / rows) * Math.max(rect.height - 190, 260);
  });
}

function render() {
  els.stage.innerHTML = "";
  renderMaze();
  state.balloons.forEach((balloon) => {
    if (balloon.popped) return;
    const button = document.createElement("button");
    button.className = "balloon";
    button.type = "button";
    button.style.setProperty("--x", `${balloon.x}px`);
    button.style.setProperty("--y", `${balloon.y}px`);
    button.dataset.id = balloon.id;
    button.innerHTML = `<span class="balloon-number">${balloon.value}</span>`;
    button.setAttribute("aria-label", `Globo con el numero ${balloon.value}`);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      chooseBalloon(balloon.id, button);
    });
    els.stage.appendChild(button);
  });
}

function renderMaze() {
  MAZE_WALLS.forEach((wall, index) => {
    const segment = document.createElement("div");
    segment.className = "maze-wall";
    segment.style.left = `${wall.left}%`;
    segment.style.top = `${wall.top}%`;
    segment.style.width = `${wall.width}%`;
    segment.style.height = `${wall.height}%`;
    segment.dataset.wall = String(index);
    segment.setAttribute("aria-hidden", "true");
    els.stage.appendChild(segment);
  });
}

function chooseBalloon(id, element) {
  const balloon = state.balloons.find((item) => item.id === id);
  if (!balloon || balloon.popped) return;
  const expected = Math.max(...state.balloons.filter((item) => !item.popped).map((item) => item.value));

  if (balloon.value !== expected) {
    state.score = Math.max(0, state.score - 1);
    updateScore();
    element.classList.add("is-wrong");
    window.setTimeout(() => element.classList.remove("is-wrong"), 320);
    setFeedback(`Busca primero el numero mayor. Ahora es ${expected}.`);
    speak(`Busca primero el numero mayor. Ahora es ${expected}.`);
    return;
  }

  burstBalloon(element);
  balloon.popped = true;
  state.score += 1;
  updateScore();
  playPop();

  const remaining = state.balloons.filter((item) => !item.popped);
  if (remaining.length === 0) {
    setFeedback("Lo lograste. Felicidades.");
    speak("Lo lograste. Felicidades.");
    return;
  }

  const next = Math.max(...remaining.map((item) => item.value));
  setFeedback(`Muy bien. Ahora busca ${next}.`);
  speak(`Muy bien. Ahora busca ${next}.`);
}

function burstBalloon(element) {
  const stageRect = els.stage.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "burst";
  burst.style.left = `${rect.left - stageRect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top - stageRect.top + rect.height * 0.32}px`;
  els.stage.appendChild(burst);

  element.classList.add("is-pop");
  element.disabled = true;
  window.setTimeout(() => {
    element.remove();
    burst.remove();
  }, 520);
}

function moveBalloons() {
  if (!state.running || !els.play.classList.contains("is-active")) {
    requestAnimationFrame(moveBalloons);
    return;
  }

  const rect = els.stage.getBoundingClientRect();
  const maxX = Math.max(rect.width - BALLOON_WIDTH_MAX, 80);
  const maxY = Math.max(rect.height - BALLOON_HEIGHT_MAX, 120);

  state.balloons.forEach((balloon) => {
    if (balloon.popped) return;
    balloon.x += balloon.dx;
    balloon.y += balloon.dy;
    if (balloon.x < 8 || balloon.x > maxX) balloon.dx *= -1;
    if (balloon.y < 8 || balloon.y > maxY) balloon.dy *= -1;
    balloon.x = Math.max(8, Math.min(maxX, balloon.x));
    balloon.y = Math.max(8, Math.min(maxY, balloon.y));
    bounceFromMaze(balloon, rect);
  });

  document.querySelectorAll(".balloon").forEach((button) => {
    if (button.classList.contains("is-pop")) return;
    const balloon = state.balloons.find((item) => item.id === button.dataset.id);
    if (!balloon) return;
    button.style.setProperty("--x", `${balloon.x}px`);
    button.style.setProperty("--y", `${balloon.y}px`);
  });

  requestAnimationFrame(moveBalloons);
}

function bounceFromMaze(balloon, stageRect) {
  const balloonWidth = Math.min(Math.max(stageRect.width * 0.07, 41), BALLOON_WIDTH_MAX);
  const balloonHeight = Math.min(Math.max(stageRect.width * 0.12, 74), BALLOON_HEIGHT_MAX);
  const body = {
    left: balloon.x + balloonWidth * 0.18,
    right: balloon.x + balloonWidth * 0.82,
    top: balloon.y + balloonHeight * 0.08,
    bottom: balloon.y + balloonHeight * 0.62
  };

  for (const wall of MAZE_WALLS) {
    const rect = {
      left: stageRect.width * wall.left / 100,
      right: stageRect.width * (wall.left + wall.width) / 100,
      top: stageRect.height * wall.top / 100,
      bottom: stageRect.height * (wall.top + wall.height) / 100
    };
    const overlaps = body.left < rect.right && body.right > rect.left && body.top < rect.bottom && body.bottom > rect.top;
    if (!overlaps) continue;

    const overlapX = Math.min(body.right - rect.left, rect.right - body.left);
    const overlapY = Math.min(body.bottom - rect.top, rect.bottom - body.top);
    if (overlapX < overlapY) {
      balloon.dx *= -1;
      balloon.x += balloon.dx > 0 ? overlapX + 2 : -overlapX - 2;
    } else {
      balloon.dy *= -1;
      balloon.y += balloon.dy > 0 ? overlapY + 2 : -overlapY - 2;
    }
  }
}

function updateScore() {
  els.score.textContent = state.score;
}

function setFeedback(text) {
  els.feedback.textContent = text;
}

function playPop() {
  if (!state.audio) return;
  els.popSound.currentTime = 0;
  els.popSound.play().catch(() => {});
}

function chooseSpanishVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = ["es-US", "es-MX", "es-419", "es-CR", "es-CO", "es"];
  return voices.find((voice) => preferred.includes(voice.lang)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ||
    null;
}

function loadVoices() {
  state.voice = chooseSpanishVoice();
}

function speak(text) {
  if (!state.audio || !("speechSynthesis" in window)) return;
  if (!state.voice) loadVoices();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.voice?.lang || "es-US";
  utterance.rate = 0.9;
  if (state.voice) utterance.voice = state.voice;
  window.speechSynthesis.speak(utterance);
}

function toggleAudio() {
  state.audio = !state.audio;
  if (!state.audio && "speechSynthesis" in window) window.speechSynthesis.cancel();
  syncAudio();
  if (state.audio) speak("Audio activo.");
}

function syncAudio() {
  els.audioButtons.forEach((button) => {
    button.classList.toggle("is-on", state.audio);
    button.classList.toggle("is-off", !state.audio);
    button.setAttribute("aria-pressed", String(state.audio));
    const label = button.querySelector(".audio-label");
    if (label) label.textContent = state.audio ? "Audio activo" : "Audio apagado";
  });
}

document.querySelectorAll(".family-button").forEach((button) => {
  button.addEventListener("click", () => startFamily(button));
});

document.querySelector("#restartButton").addEventListener("click", () => {
  resetGame();
  speak("Nuevo juego. Revienta los globos de mayor a menor.");
});

document.querySelector("#familyButton").addEventListener("click", () => {
  state.running = false;
  showScreen("menu");
  speak("Selecciona la familia.");
});

document.querySelector("#exitButton").addEventListener("click", () => {
  window.close();
  if (!window.closed) {
    state.running = false;
    showScreen("menu");
  }
});

els.audioButtons.forEach((button) => button.addEventListener("click", toggleAudio));

window.addEventListener("resize", () => {
  if (!els.play.classList.contains("is-active")) return;
  positionBalloons();
  render();
});

if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

syncAudio();
moveBalloons();
