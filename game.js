const COLS = 6;
window.CHAIN_DROP_HAS_DIRECT_TAP = true;
const ROWS = 9;
const MOVES = 24;
const GROUP_SIZE = 4;
const STORAGE_KEY = "chain-drop-best";
const DEFAULT_BLOCKS = [
  { id: "red", label: "slash", image: "" },
  { id: "blue", label: "circle", image: "" },
  { id: "green", label: "cross", image: "" },
  { id: "yellow", label: "square", image: "" },
  { id: "violet", label: "diamond", image: "" },
  { id: "coral", label: "triangle", image: "" },
];
const BLOCKS = normalizeBlocks(window.CHAIN_DROP_BLOCKS);
const BLOCK_BY_ID = indexBlocks(BLOCKS);
const BLOCK_IDS = BLOCKS.map((block) => block.id);
const DEFAULT_CHARACTER = {
  enabled: true,
  name: "Mimi",
  states: {
    idle: { image: "assets/characters/idle.svg", line: "Ready!" },
    drop: { image: "assets/characters/idle.svg", line: "Drop!" },
    clear: { image: "assets/characters/cheer.svg", line: "Nice!" },
    combo: { image: "assets/characters/cheer.svg", line: "Chain!" },
    bigCombo: { image: "assets/characters/wow.svg", line: "Huge!" },
    lowMoves: { image: "assets/characters/worry.svg", line: "Careful!" },
    shuffle: { image: "assets/characters/wow.svg", line: "Shuffle!" },
    paused: { image: "assets/characters/sleep.svg", line: "Pause" },
    finish: { image: "assets/characters/worry.svg", line: "Again?" },
    newBest: { image: "assets/characters/wow.svg", line: "Best!" },
  },
};
const CHARACTER = normalizeCharacter(window.CHAIN_DROP_CHARACTER);

const boardEl = document.querySelector("#board");
const boardWrap = document.querySelector(".board-wrap");
const template = document.querySelector("#cellTemplate");
const scoreText = document.querySelector("#scoreText");
const bestText = document.querySelector("#bestText");
const movesText = document.querySelector("#movesText");
const stateText = document.querySelector("#stateText");
const chainText = document.querySelector("#chainText");
const chainMeter = document.querySelector("#chainMeter");
const comboBadge = document.querySelector("#comboBadge");
const restartButton = document.querySelector("#restartButton");
const pauseButton = document.querySelector("#pauseButton");
const shuffleButton = document.querySelector("#shuffleButton");
const sidekickEl = document.querySelector("#sidekick");
const sidekickImage = document.querySelector("#sidekickImage");
const sidekickLine = document.querySelector("#sidekickLine");

let board = [];
let cells = [];
let score = 0;
let moves = MOVES;
let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
let locked = false;
let paused = false;
let gameOver = false;
let chainPeak = 0;
let characterTimer = 0;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const randomColor = () => BLOCK_IDS[Math.floor(Math.random() * BLOCK_IDS.length)];

function normalizeBlocks(customBlocks) {
  if (!Array.isArray(customBlocks) || customBlocks.length < 4) {
    return DEFAULT_BLOCKS;
  }

  const usedIds = new Set();
  const blocks = customBlocks
    .map((block, index) => {
      const fallback = DEFAULT_BLOCKS[index % DEFAULT_BLOCKS.length];
      const id = String(block.id || fallback.id).trim();
      const label = String(block.label || fallback.label || id).trim();
      const image = String(block.image || "").trim();
      return { id, label, image };
    })
    .filter((block) => {
      if (!block.id || usedIds.has(block.id)) return false;
      usedIds.add(block.id);
      return true;
    });

  return blocks.length >= 4 ? blocks : DEFAULT_BLOCKS;
}

function indexBlocks(blocks) {
  const indexed = {};
  for (const block of blocks) {
    indexed[block.id] = block;
  }
  return indexed;
}

function normalizeCharacter(customCharacter) {
  const custom =
    customCharacter && typeof customCharacter === "object" ? customCharacter : DEFAULT_CHARACTER;
  const customStates =
    custom.states && typeof custom.states === "object" ? custom.states : DEFAULT_CHARACTER.states;
  const states = {};

  for (const key of Object.keys(DEFAULT_CHARACTER.states)) {
    const fallback = DEFAULT_CHARACTER.states[key];
    const state = customStates[key] && typeof customStates[key] === "object" ? customStates[key] : {};
    states[key] = {
      image: String(state.image || fallback.image || "").trim(),
      line: String(state.line || fallback.line || key).trim(),
    };
  }

  return {
    enabled: custom.enabled !== false,
    name: String(custom.name || DEFAULT_CHARACTER.name).trim(),
    states,
  };
}

function getBlock(id) {
  return BLOCK_BY_ID[id] || DEFAULT_BLOCKS[0];
}

function imageUrl(path) {
  return `url("${path.replace(/\\/g, "/").replace(/"/g, '\\"')}")`;
}

function init() {
  setupCharacter();
  createCells();
  setBoardSize();
  startGame();

  bindTap(restartButton, startGame);
  bindTap(pauseButton, togglePause);
  bindTap(shuffleButton, shuffleBoard);
  window.addEventListener("resize", setBoardSize);

  if ("ResizeObserver" in window) {
    new ResizeObserver(setBoardSize).observe(boardWrap);
  }
}

function bindTap(element, action) {
  let lastDirectTap = 0;

  const run = (event, directTap) => {
    if (directTap) {
      lastDirectTap = Date.now();
      if (event.cancelable) event.preventDefault();
    } else if (Date.now() - lastDirectTap < 500) {
      return;
    }

    action(event);
  };

  if ("PointerEvent" in window) {
    element.addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      run(event, true);
    });
  } else {
    element.addEventListener(
      "touchend",
      (event) => {
        run(event, true);
      },
      { passive: false },
    );
  }

  element.addEventListener("click", (event) => {
    run(event, false);
  });
}

function setupCharacter() {
  if (!sidekickEl || !sidekickImage || !sidekickLine || !CHARACTER.enabled) {
    if (sidekickEl) sidekickEl.hidden = true;
    return;
  }

  sidekickEl.hidden = false;
  setCharacterMood("idle");
}

function setCharacterMood(mood, options = {}) {
  if (!sidekickEl || !sidekickImage || !sidekickLine || !CHARACTER.enabled) return;

  window.clearTimeout(characterTimer);
  const state = CHARACTER.states[mood] || CHARACTER.states.idle;
  sidekickEl.dataset.mood = mood;
  sidekickImage.src = state.image;
  sidekickImage.alt = `${CHARACTER.name}: ${state.line}`;
  sidekickLine.textContent = state.line;

  if (options.duration) {
    characterTimer = window.setTimeout(() => {
      characterTimer = 0;
      settleCharacterMood();
    }, options.duration);
  }
}

function settleCharacterMood() {
  if (characterTimer) return;
  if (gameOver) return;

  if (paused) {
    setCharacterMood("paused");
    return;
  }

  setCharacterMood(moves <= 5 ? "lowMoves" : "idle");
}

function setBoardSize() {
  const rect = boardWrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const width = Math.floor(Math.min(rect.width, 430, rect.height * (COLS / ROWS)));
  boardEl.style.setProperty("--board-width", `${width}px`);
}

function createCells() {
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < ROWS; row += 1) {
    cells[row] = [];

    for (let col = 0; col < COLS; col += 1) {
      const cell = template.content.firstElementChild.cloneNode(true);
      cell.dataset.row = row;
      cell.dataset.col = col;
      bindTap(cell, () => handleCellPress(row, col));
      cells[row][col] = cell;
      fragment.append(cell);
    }
  }

  boardEl.append(fragment);
}

function startGame() {
  score = 0;
  moves = MOVES;
  locked = false;
  paused = false;
  gameOver = false;
  chainPeak = 0;
  board = makeFreshBoard();
  updatePauseButton();
  updateStats();
  setState("Ready");
  setCharacterMood("idle");
  render();
}

function makeFreshBoard() {
  let next = [];

  do {
    next = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => randomColor()),
    );
  } while (findGroups(next).length > 0);

  return next;
}

async function handleCellPress(row, col) {
  if (locked || paused || gameOver || !board[row][col]) return;

  locked = true;
  try {
    setCellClass(row, col, "pop", true);
    board[row][col] = null;
    moves -= 1;
    score += 10;
    updateStats();
    pulse(scoreText);
    setState("Drop");
    setCharacterMood("drop", { duration: 700 });
    vibrate(12);

    await wait(160);
    render();
    await resolveBoard();

    if (moves <= 0) {
      endGame();
      return;
    }

    setState("Ready");
    settleCharacterMood();
  } catch (error) {
    console.error("Chain Drop action failed", error);
    setState("Ready");
    settleCharacterMood();
  } finally {
    if (!gameOver && !paused) {
      locked = false;
      clearTransientClasses();
      render();
    }
  }
}

async function resolveBoard() {
  let combo = 0;
  let didMove = await collapseAndFill();

  while (!paused) {
    const groups = findGroups(board);
    if (groups.length === 0) break;

    combo += 1;
    chainPeak = Math.max(chainPeak, combo);
    const clearedCells = flattenGroups(groups);
    const clearScore = clearedCells.length * 45 * combo + groups.length * 80;
    score += clearScore;
    updateStats(combo);
    showCombo(combo, clearScore);
    setCharacterMood(combo >= 3 ? "bigCombo" : combo > 1 ? "combo" : "clear", {
      duration: 1200,
    });
    markGroups(clearedCells);
    vibrate(combo > 1 ? [16, 25, 20] : 18);

    await wait(340);
    for (const { row, col } of clearedCells) {
      board[row][col] = null;
    }
    render();
    didMove = await collapseAndFill();
  }

  updateStats(0);
  return didMove;
}

function flattenGroups(groups) {
  const flattened = [];
  for (const group of groups) {
    for (const cell of group) {
      flattened.push(cell);
    }
  }
  return flattened;
}

async function collapseAndFill() {
  let moved = false;
  const next = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  for (let col = 0; col < COLS; col += 1) {
    const stack = [];

    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (board[row][col]) {
        stack.push(board[row][col]);
      }
    }

    let targetRow = ROWS - 1;
    for (const color of stack) {
      next[targetRow][col] = color;
      targetRow -= 1;
    }

    while (targetRow >= 0) {
      next[targetRow][col] = randomColor();
      targetRow -= 1;
      moved = true;
    }
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (next[row][col] !== board[row][col]) {
        moved = true;
      }
    }
  }

  board = next;
  render(moved ? "drop" : "");

  if (moved) {
    await wait(230);
    clearTransientClasses();
  }

  return moved;
}

function findGroups(sourceBoard) {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const color = sourceBoard[row][col];
      if (!color || visited[row][col]) continue;

      const group = [];
      const queue = [{ row, col }];
      visited[row][col] = true;

      while (queue.length > 0) {
        const current = queue.shift();
        group.push(current);

        for (const next of neighbors(current.row, current.col)) {
          if (visited[next.row][next.col] || sourceBoard[next.row][next.col] !== color) {
            continue;
          }
          visited[next.row][next.col] = true;
          queue.push(next);
        }
      }

      if (group.length >= GROUP_SIZE) {
        groups.push(group);
      }
    }
  }

  return groups;
}

function neighbors(row, col) {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter((cell) => cell.row >= 0 && cell.row < ROWS && cell.col >= 0 && cell.col < COLS);
}

function render(extraClass = "") {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = cells[row][col];
      const color = board[row][col];
      const block = color ? getBlock(color) : null;
      cell.className = "cell";
      cell.disabled = locked || paused || gameOver || !color;
      cell.setAttribute("aria-label", block ? `${block.label} block` : "empty");
      cell.style.removeProperty("--piece-image");
      delete cell.dataset.color;
      delete cell.dataset.asset;

      if (color) {
        cell.dataset.color = color;
        if (block.image) {
          cell.dataset.asset = "image";
          cell.style.setProperty("--piece-image", imageUrl(block.image));
        }
      } else {
        cell.classList.add("empty");
      }

      if (extraClass && color) {
        cell.classList.add(extraClass);
      }

      if (locked || paused || gameOver) {
        cell.classList.add("locked");
      }
    }
  }
}

function markGroups(groupCells) {
  clearTransientClasses();
  for (const { row, col } of groupCells) {
    cells[row][col].classList.add("clear");
  }
}

function setCellClass(row, col, className, on) {
  cells[row][col].classList.toggle(className, on);
}

function clearTransientClasses() {
  for (const row of cells) {
    for (const cell of row) {
      cell.classList.remove("pop", "clear", "drop");
    }
  }
}

function updateStats(activeCombo = 0) {
  scoreText.textContent = score.toLocaleString("ja-JP");
  movesText.textContent = String(moves);
  bestText.textContent = Math.max(best, score).toLocaleString("ja-JP");
  chainText.textContent = `${activeCombo || chainPeak} Chain`;
  chainMeter.style.width = `${Math.min((activeCombo || chainPeak) * 18, 100)}%`;
}

function showCombo(combo, points) {
  comboBadge.textContent = `${combo} Chain +${points.toLocaleString("ja-JP")}`;
  comboBadge.classList.remove("show");
  void comboBadge.offsetWidth;
  comboBadge.classList.add("show");
  setState(combo > 1 ? `${combo} Chain` : "Clear");
}

function setState(text) {
  stateText.textContent = text;
}

function pulse(element) {
  element.classList.remove("toast");
  void element.offsetWidth;
  element.classList.add("toast");
}

function endGame() {
  gameOver = true;
  locked = true;

  if (score > best) {
    best = score;
    localStorage.setItem(STORAGE_KEY, String(best));
    setState("New Best");
    setCharacterMood("newBest");
  } else {
    setState("Finish");
    setCharacterMood("finish");
  }

  updateStats(0);
  render();
}

function togglePause() {
  if (gameOver || (locked && !paused)) return;
  paused = !paused;
  locked = paused;
  setState(paused ? "Paused" : "Ready");
  if (paused) {
    setCharacterMood("paused");
  } else {
    settleCharacterMood();
  }
  updatePauseButton();
  render();
}

function updatePauseButton() {
  pauseButton.setAttribute("aria-label", paused ? "Resume" : "Pause");
  pauseButton.innerHTML = paused
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z"></path></svg>';
}

async function shuffleBoard() {
  if (locked || paused || gameOver || moves <= 0) return;
  locked = true;
  moves -= 1;
  score = Math.max(0, score - 40);
  setState("Shuffle");
  setCharacterMood("shuffle", { duration: 800 });
  board = makeFreshBoard();
  render("drop");
  updateStats(0);
  vibrate(18);
  await wait(260);
  clearTransientClasses();

  if (moves <= 0) {
    endGame();
    return;
  }

  locked = false;
  setState("Ready");
  settleCharacterMood();
  render();
}

function vibrate(pattern) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

init();
