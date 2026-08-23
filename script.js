const SIZE = 4;
const ANIMATION_MS = 180; // keep in sync with the tile transition duration in style.css

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const messageEl = document.getElementById("message");
const messageTextEl = document.getElementById("message-text");
const newGameBtn = document.getElementById("new-game");
const tryAgainBtn = document.getElementById("try-again");
const hardModeToggle = document.getElementById("hard-mode");

const vectors = {
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
};

let cells; // SIZE x SIZE array of tile objects or null
let nextId = 1;
let score = 0;
let best = Number(localStorage.getItem("2048-best") || 0);
let won = false;
let gameOver = false;
let animating = false;
let hardMode = false;

bestEl.textContent = best;

function emptyCells() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function withinBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function availableCells() {
  const list = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!cells[r][c]) list.push({ r, c });
    }
  }
  return list;
}

function createTile(r, c, value) {
  return { id: nextId++, r, c, value, merged: false, el: null };
}

function spawnRandomTile() {
  const empty = availableCells();
  if (empty.length === 0) return null;
  const { r, c } = empty[Math.floor(Math.random() * empty.length)];
  const tile = createTile(r, c, Math.random() < 0.9 ? 2 : 4);
  cells[r][c] = tile;
  return tile;
}

function startGame() {
  cells = emptyCells();
  boardEl.querySelectorAll(".tile").forEach((el) => el.remove());
  score = 0;
  won = false;
  gameOver = false;
  animating = false;
  messageEl.classList.add("hidden");

  if (!boardEl.querySelector(".cell")) {
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      boardEl.appendChild(cell);
    }
  }

  updateScore();
  renderNewTile(spawnRandomTile());
  renderNewTile(spawnRandomTile());
}

function updateScore() {
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem("2048-best", String(best));
  }
  bestEl.textContent = best;
}

function getCellMetrics() {
  const rect = boardEl.getBoundingClientRect();
  const gap = 12;
  const size = (rect.width - gap * (SIZE + 1)) / SIZE;
  return { gap, size };
}

function positionEl(el, r, c) {
  const { gap, size } = getCellMetrics();
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${gap + c * (size + gap)}px`;
  el.style.top = `${gap + r * (size + gap)}px`;
}

function renderNewTile(tile) {
  if (!tile) return;
  const el = document.createElement("div");
  el.className = "tile new";
  el.dataset.value = tile.value;
  el.textContent = tile.value;
  positionEl(el, tile.r, tile.c);
  boardEl.appendChild(el);
  tile.el = el;
}

function buildTraversals(vector) {
  const rows = [0, 1, 2, 3];
  const cols = [0, 1, 2, 3];
  if (vector.dr === 1) rows.reverse();
  if (vector.dc === 1) cols.reverse();
  return { rows, cols };
}

function findFarthest(r, c, vector) {
  let pr = r;
  let pc = c;
  let nr = r + vector.dr;
  let nc = c + vector.dc;
  while (withinBounds(nr, nc) && !cells[nr][nc]) {
    pr = nr;
    pc = nc;
    nr += vector.dr;
    nc += vector.dc;
  }
  return { farthest: { r: pr, c: pc }, next: { r: nr, c: nc } };
}

function move(direction) {
  if (gameOver || animating) return;

  const vector = vectors[direction];
  const { rows, cols } = buildTraversals(vector);

  let moved = false;
  let gained = 0;
  const removals = [];
  const merges = [];

  rows.forEach((r) => {
    cols.forEach((c) => {
      const tile = cells[r][c];
      if (!tile) return;

      const { farthest, next } = findFarthest(r, c, vector);
      const target = withinBounds(next.r, next.c) ? cells[next.r][next.c] : null;

      if (target && target.value === tile.value && !target.merged) {
        cells[r][c] = null;
        target.merged = true;
        target.value *= 2;
        gained += target.value;
        if (target.value === 2048) won = true;
        moved = true;
        positionEl(tile.el, target.r, target.c);
        removals.push(tile);
        merges.push(target);
      } else if (farthest.r !== r || farthest.c !== c) {
        cells[r][c] = null;
        tile.r = farthest.r;
        tile.c = farthest.c;
        cells[farthest.r][farthest.c] = tile;
        positionEl(tile.el, tile.r, tile.c);
        moved = true;
      }
    });
  });

  if (!moved) return;

  animating = true;
  score += gained;
  updateScore();

  setTimeout(() => {
    removals.forEach((t) => t.el && t.el.remove());
    merges.forEach((t) => {
      t.el.dataset.value = t.value;
      t.el.textContent = t.value;
      t.el.classList.remove("merged");
      void t.el.offsetWidth; // restart the pop animation
      t.el.classList.add("merged");
      t.merged = false;
    });

    renderNewTile(spawnRandomTile());
    if (hardMode) renderNewTile(spawnRandomTile());
    animating = false;

    if (won) {
      showMessage("You win! 🎉");
      gameOver = true;
      return;
    }
    if (!movesAvailable()) {
      showMessage("Game over");
      gameOver = true;
    }
  }, ANIMATION_MS);
}

function movesAvailable() {
  if (availableCells().length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = cells[r][c].value;
      if (c < SIZE - 1 && cells[r][c + 1].value === v) return true;
      if (r < SIZE - 1 && cells[r + 1][c].value === v) return true;
    }
  }
  return false;
}

function showMessage(text) {
  messageTextEl.textContent = text;
  messageEl.classList.remove("hidden");
}

document.addEventListener("keydown", (e) => {
  const map = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };
  const dir = map[e.key];
  if (!dir) return;
  e.preventDefault();
  move(dir);
});

// Touch swipe support
let touchStartX = 0;
let touchStartY = 0;

boardEl.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

boardEl.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const threshold = 24;
  if (Math.max(absDx, absDy) < threshold) return;
  if (absDx > absDy) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy > 0 ? "down" : "up");
  }
}, { passive: true });

newGameBtn.addEventListener("click", startGame);
tryAgainBtn.addEventListener("click", startGame);
hardModeToggle.addEventListener("change", () => {
  hardMode = hardModeToggle.checked;
});
window.addEventListener("resize", () => {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = cells[r][c];
      if (t && t.el) positionEl(t.el, t.r, t.c);
    }
  }
});

startGame();
