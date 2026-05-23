const COLS = 6;
window.CHAIN_DROP_HAS_DIRECT_TAP = true;
const ROWS = 9;
const MOVES = 24;
const GROUP_SIZE = 4;
const VOID_CELL = "__chain_drop_void__";
const TIMING = {
  pickPop: 160,
  fallSettle: 340,
  clearBlink: 840,
  shuffleSettle: 300,
};
const STORAGE_KEY = "chain-drop-best";
const DEFAULT_STAGE_MASK = [
  "111111",
  "111111",
  "111111",
  "111111",
  "111111",
  "111111",
  "111111",
  "111111",
  "111111",
];
const DEFAULT_STAGES = [
  {
    name: "Start",
    target: 1200,
    moves: 24,
    mask: DEFAULT_STAGE_MASK,
  },
  {
    name: "Notch",
    target: 1800,
    moves: 24,
    mask: ["011110", "111111", "111111", "111111", "111111", "111111", "111111", "111111", "011110"],
  },
  {
    name: "Hourglass",
    target: 2400,
    moves: 25,
    mask: ["111111", "111111", "011110", "001100", "001100", "011110", "111111", "111111", "111111"],
  },
  {
    name: "Pillars",
    target: 3200,
    moves: 26,
    mask: ["110011", "111111", "111111", "011110", "011110", "111111", "111111", "111111", "110011"],
  },
  {
    name: "Diamond",
    target: 4200,
    moves: 27,
    mask: ["001100", "011110", "111111", "111111", "111111", "111111", "111111", "011110", "001100"],
  },
];
const DEFAULT_BLOCKS = [
  { id: "red", label: "slash", image: "" },
  { id: "blue", label: "circle", image: "" },
  { id: "green", label: "cross", image: "" },
  { id: "yellow", label: "square", image: "" },
  { id: "violet", label: "diamond", image: "" },
  { id: "coral", label: "triangle", image: "" },
];
const BLOCK_COLORS = {
  red: "#d55e00",
  blue: "#0072b2",
  green: "#009e73",
  yellow: "#f0e442",
  violet: "#cc79a7",
  coral: "#56b4e9",
};
const BLOCKS = normalizeBlocks(window.CHAIN_DROP_BLOCKS);
const BLOCK_BY_ID = indexBlocks(BLOCKS);
const BLOCK_IDS = BLOCKS.map((block) => block.id);
const STAGES = normalizeStages(window.CHAIN_DROP_STAGES);
const DEFAULT_CHARACTER = {
  enabled: true,
  name: "Mimi",
  states: {
    idle: { image: "assets/characters/idle.jpg" },
    drop: { image: "assets/characters/idle.jpg" },
    clear: { image: "assets/characters/cheer.svg" },
    combo: { image: "assets/characters/cheer.svg" },
    bigCombo: { image: "assets/characters/wow.svg" },
    lowMoves: { image: "assets/characters/worry.svg" },
    shuffle: { image: "assets/characters/wow.svg" },
    paused: { image: "assets/characters/sleep.svg" },
    finish: { image: "assets/characters/worry.svg" },
    newBest: { image: "assets/characters/wow.svg" },
  },
};
const CHARACTER = normalizeCharacter(window.CHAIN_DROP_CHARACTER);

const boardEl = document.querySelector("#board");
const boardCanvas = document.querySelector("#boardCanvas");
const boardCtx = boardCanvas.getContext("2d", { alpha: true });
const boardWrap = document.querySelector(".board-wrap");
const scoreText = document.querySelector("#scoreText");
const bestText = document.querySelector("#bestText");
const movesText = document.querySelector("#movesText");
const stageText = document.querySelector("#stageText");
const goalText = document.querySelector("#goalText");
const stateText = document.querySelector("#stateText");
const chainText = document.querySelector("#chainText");
const chainMeter = document.querySelector("#chainMeter");
const comboBadge = document.querySelector("#comboBadge");
const restartButton = document.querySelector("#restartButton");
const pauseButton = document.querySelector("#pauseButton");
const shuffleButton = document.querySelector("#shuffleButton");
const sidekickEl = document.querySelector("#sidekick");
const sidekickImage = document.querySelector("#sidekickImage");

let board = [];
let score = 0;
let moves = MOVES;
let currentStageIndex = 0;
let currentStage = STAGES[currentStageIndex];
let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
let locked = false;
let paused = false;
let gameOver = false;
let chainPeak = 0;
let characterTimer = 0;
let renderQueued = false;
let selectedCell = { row: ROWS - 1, col: 0 };
let lastTouchTime = 0;
let effects = new Map();
let animationUntil = 0;
let boardMetrics = {
  width: 0,
  height: 0,
  cellWidth: 0,
  cellHeight: 0,
  gap: 6,
  dpr: 1,
};

const imageCache = new Map();
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const randomColor = () => BLOCK_IDS[Math.floor(Math.random() * BLOCK_IDS.length)];
const now = () =>
  window.performance && window.performance.now ? window.performance.now() : Date.now();

function nextPaint() {
  return new Promise((resolve) => {
    if (!window.requestAnimationFrame) {
      window.setTimeout(resolve, 16);
      return;
    }
    window.requestAnimationFrame(resolve);
  });
}

function commitBoardPaint() {
  queueRender();
}

async function settleBoardPaint() {
  queueRender();
  await nextPaint();
}

async function animateBoardFor(duration) {
  animationUntil = Math.max(animationUntil, now() + duration);
  queueRender();
  await wait(duration);
}

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

function normalizeStages(customStages) {
  const source = Array.isArray(customStages) && customStages.length ? customStages : DEFAULT_STAGES;
  const stages = source
    .map((stage, index) => {
      const fallback = DEFAULT_STAGES[index % DEFAULT_STAGES.length];
      const mask = normalizeStageMask(stage && stage.mask, fallback.mask);
      const target = Math.max(300, Number(stage && stage.target) || fallback.target || 1200);
      const moves = Math.max(8, Number(stage && stage.moves) || fallback.moves || MOVES);
      const name = String((stage && stage.name) || fallback.name || `Stage ${index + 1}`).trim();
      return { name, target, moves, mask };
    })
    .filter((stage) => countPlayableCells(stage.mask) >= GROUP_SIZE);

  return stages.length ? stages : DEFAULT_STAGES;
}

function normalizeStageMask(mask, fallbackMask) {
  const source = Array.isArray(mask) ? mask : fallbackMask || DEFAULT_STAGE_MASK;
  const normalized = [];

  for (let row = 0; row < ROWS; row += 1) {
    const line = String(source[row] || DEFAULT_STAGE_MASK[row] || "").padEnd(COLS, "1");
    let normalizedLine = "";
    for (let col = 0; col < COLS; col += 1) {
      normalizedLine += line[col] === "0" ? "0" : "1";
    }
    normalized.push(normalizedLine);
  }

  return normalized;
}

function countPlayableCells(mask) {
  return mask.reduce((count, row) => count + row.split("").filter((cell) => cell === "1").length, 0);
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

function getBlockColor(id) {
  return BLOCK_COLORS[id] || "#9aa3b2";
}

function isVoidCell(value) {
  return value === VOID_CELL;
}

function isPlayableCell(row, col) {
  return (
    row >= 0 &&
    row < ROWS &&
    col >= 0 &&
    col < COLS &&
    currentStage &&
    currentStage.mask[row] &&
    currentStage.mask[row][col] === "1"
  );
}

function firstPlayableCell() {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (isPlayableCell(row, col)) return { row, col };
    }
  }
  return { row: ROWS - 1, col: 0 };
}

function moveSelection(deltaRow, deltaCol) {
  let row = selectedCell.row;
  let col = selectedCell.col;

  for (let step = 0; step < Math.max(ROWS, COLS); step += 1) {
    row = Math.min(ROWS - 1, Math.max(0, row + deltaRow));
    col = Math.min(COLS - 1, Math.max(0, col + deltaCol));
    if (isPlayableCell(row, col)) {
      selectedCell = { row, col };
      return;
    }
  }

  selectedCell = firstPlayableCell();
}

function init() {
  setupCharacter();
  bindBoardInput();
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
  element.addEventListener("click", (event) => {
    if (event.button && event.button !== 0) return;
    action(event);
  });
}

function bindBoardInput() {
  boardEl.addEventListener("keydown", handleBoardKey);

  if ("PointerEvent" in window) {
    boardEl.addEventListener("pointerup", (event) => {
      if (event.button && event.button !== 0) return;
      if (event.cancelable) event.preventDefault();
      handleBoardPoint(event.clientX, event.clientY);
    });
    return;
  }

  boardEl.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      lastTouchTime = Date.now();
      if (event.cancelable) event.preventDefault();
      handleBoardPoint(touch.clientX, touch.clientY);
    },
    { passive: false }
  );

  boardEl.addEventListener("click", (event) => {
    if (Date.now() - lastTouchTime < 500) return;
    handleBoardPoint(event.clientX, event.clientY);
  });
}

function handleBoardKey(event) {
  if (event.key === "ArrowUp") {
    moveSelection(-1, 0);
  } else if (event.key === "ArrowDown") {
    moveSelection(1, 0);
  } else if (event.key === "ArrowLeft") {
    moveSelection(0, -1);
  } else if (event.key === "ArrowRight") {
    moveSelection(0, 1);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (isPlayableCell(selectedCell.row, selectedCell.col)) {
      handleCellPress(selectedCell.row, selectedCell.col);
    }
    return;
  } else {
    return;
  }

  event.preventDefault();
  queueRender();
}

function handleBoardPoint(clientX, clientY) {
  const cell = cellFromPoint(clientX, clientY);
  if (!cell) return;
  selectedCell = cell;
  queueRender();
  handleCellPress(cell.row, cell.col);
}

function cellFromPoint(clientX, clientY) {
  const rect = boardCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

  const row = Math.min(ROWS - 1, Math.max(0, Math.floor((y / rect.height) * ROWS)));
  const col = Math.min(COLS - 1, Math.max(0, Math.floor((x / rect.width) * COLS)));
  if (!isPlayableCell(row, col)) return null;

  return { row, col };
}

function setupCharacter() {
  if (!sidekickEl || !sidekickImage || !CHARACTER.enabled) {
    if (sidekickEl) sidekickEl.hidden = true;
    return;
  }

  sidekickEl.hidden = false;
  setCharacterMood("idle");
}

function setCharacterMood(mood, options = {}) {
  if (!sidekickEl || !sidekickImage || !CHARACTER.enabled) return;

  window.clearTimeout(characterTimer);
  const state = CHARACTER.states[mood] || CHARACTER.states.idle;
  sidekickEl.dataset.mood = mood;
  sidekickImage.src = state.image;
  sidekickImage.alt = CHARACTER.name;

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
  window.requestAnimationFrame(syncCanvasSize);
}

function syncCanvasSize() {
  const rect = boardCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  if (boardCanvas.width !== pixelWidth || boardCanvas.height !== pixelHeight) {
    boardCanvas.width = pixelWidth;
    boardCanvas.height = pixelHeight;
  }

  const styles = window.getComputedStyle(boardEl);
  const gap = Number.parseFloat(styles.getPropertyValue("--grid-gap")) || 6;
  boardMetrics = {
    width,
    height,
    gap,
    dpr,
    cellWidth: (width - gap * (COLS - 1)) / COLS,
    cellHeight: (height - gap * (ROWS - 1)) / ROWS,
  };
  queueRender();
}

function startGame() {
  currentStage = STAGES[currentStageIndex];
  score = 0;
  moves = currentStage.moves;
  locked = false;
  paused = false;
  gameOver = false;
  chainPeak = 0;
  selectedCell = firstPlayableCell();
  effects.clear();
  animationUntil = 0;
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
    next = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, col) => (isPlayableCell(row, col) ? randomColor() : VOID_CELL))
    );
  } while (findGroups(next).length > 0);

  return next;
}

async function handleCellPress(row, col) {
  if (locked || paused || gameOver || !isPlayableCell(row, col) || !board[row][col] || isVoidCell(board[row][col])) {
    return;
  }

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
    commitBoardPaint();

    await wait(TIMING.pickPop);
    render();
    await settleBoardPaint();
    await resolveBoard();

    if (await finishStageIfCleared()) {
      return;
    }

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
      duration: 1200
    });
    markGroups(clearedCells);
    vibrate(combo > 1 ? [16, 25, 20] : 18);
    await animateBoardFor(TIMING.clearBlink);
    for (const { row, col } of clearedCells) {
      board[row][col] = null;
    }
    render();
    await settleBoardPaint();
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
  const next = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => (isPlayableCell(row, col) ? null : VOID_CELL))
  );

  for (let col = 0; col < COLS; col += 1) {
    const stack = [];

    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (isPlayableCell(row, col) && board[row][col] && !isVoidCell(board[row][col])) {
        stack.push(board[row][col]);
      }
    }

    const targetRows = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (isPlayableCell(row, col)) {
        targetRows.push(row);
      }
    }

    let targetIndex = 0;
    for (const color of stack) {
      const targetRow = targetRows[targetIndex];
      next[targetRow][col] = color;
      targetIndex += 1;
    }

    while (targetIndex < targetRows.length) {
      const targetRow = targetRows[targetIndex];
      next[targetRow][col] = randomColor();
      targetIndex += 1;
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
  await settleBoardPaint();

  if (moved) {
    await wait(TIMING.fallSettle);
    clearTransientClasses();
    await settleBoardPaint();
  }

  return moved;
}

function findGroups(sourceBoard) {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const color = sourceBoard[row][col];
      if (!isPlayableCell(row, col) || !color || isVoidCell(color) || visited[row][col]) continue;

      const group = [];
      const queue = [{ row, col }];
      visited[row][col] = true;

      while (queue.length > 0) {
        const current = queue.shift();
        group.push(current);

        for (const next of neighbors(current.row, current.col)) {
          if (
            visited[next.row][next.col] ||
            !isPlayableCell(next.row, next.col) ||
            isVoidCell(sourceBoard[next.row][next.col]) ||
            sourceBoard[next.row][next.col] !== color
          ) {
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
  if (extraClass) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (board[row][col]) {
          effects.set(cellKey(row, col), extraClass);
        }
      }
    }
  }

  boardEl.setAttribute(
    "aria-label",
    `game board, score ${score}, moves ${moves}, ${locked || paused || gameOver ? "busy" : "ready"}`
  );
  queueRender();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(drawBoard);
}

function drawBoard() {
  renderQueued = false;
  const frameTime = now();
  syncCanvasSizeIfNeeded();
  const { width, height, dpr, cellWidth, cellHeight, gap } = boardMetrics;
  if (!width || !height) return;

  boardCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  boardCtx.clearRect(0, 0, width, height);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = col * (cellWidth + gap);
      const y = row * (cellHeight + gap);
      if (!isPlayableCell(row, col)) {
        drawVoidCell(x, y, cellWidth, cellHeight);
        continue;
      }
      drawCell(x, y, cellWidth, cellHeight);

      const color = board[row][col];
      if (color && !isVoidCell(color)) {
        const effect = effects.get(cellKey(row, col));
        drawBlock(row, col, x, y, cellWidth, cellHeight, color, effect, frameTime);
      }
    }
  }

  if (document.activeElement === boardEl) {
    drawSelectedCell();
  }

  if (animationUntil > frameTime) {
    queueRender();
  }
}

function syncCanvasSizeIfNeeded() {
  const rect = boardCanvas.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width !== boardMetrics.width || height !== boardMetrics.height) {
    syncCanvasSize();
  }
}

function drawCell(x, y, width, height) {
  boardCtx.save();
  boardCtx.fillStyle = "rgba(0, 0, 0, 0.14)";
  roundedRect(boardCtx, x, y, width, height, 8);
  boardCtx.fill();
  boardCtx.restore();
}

function drawVoidCell(x, y, width, height) {
  boardCtx.save();
  boardCtx.fillStyle = "rgba(2, 4, 9, 0.34)";
  roundedRect(boardCtx, x, y, width, height, 8);
  boardCtx.fill();
  boardCtx.restore();
}

function drawBlock(row, col, x, y, width, height, color, effect, frameTime) {
  const block = getBlock(color);
  const size = Math.min(width, height) * 0.84;
  const centerX = x + width / 2;
  let centerY = y + height / 2;
  let scale = 1;
  let alpha = 1;
  const type = getEffectType(effect);

  if (type === "clear") {
    const age = Math.max(0, frameTime - getEffectStart(effect, frameTime));
    const duration = getEffectDuration(effect, TIMING.clearBlink);
    const progress = Math.min(age / duration, 1);
    const flashOn = Math.floor(age / 120) % 2 === 0;
    const fade = 1 - Math.max(0, progress - 0.78) / 0.22;
    scale = 1.04 + (flashOn ? 0.08 : 0);
    alpha = (flashOn ? 1 : 0.32) * Math.max(0.34, fade);
  } else if (type === "pop") {
    scale = 1.04;
    alpha = 0.75;
  } else if (type === "drop") {
    centerY += size * 0.04;
  }

  boardCtx.save();
  boardCtx.globalAlpha = alpha;
  boardCtx.translate(centerX, centerY);
  boardCtx.scale(scale, scale);

  if (type === "clear") {
    drawClearPulse(size, frameTime, effect);
  }

  if (block.image) {
    const image = getBlockImage(block);
    if (image && image.complete && image.naturalWidth) {
      drawBlockImage(image, size);
      boardCtx.restore();
      return;
    }
  }

  drawBuiltInBlock(color, block.label, size);
  boardCtx.restore();
}

function getEffectType(effect) {
  if (!effect) return "";
  return typeof effect === "string" ? effect : effect.type || "";
}

function getEffectStart(effect, fallback) {
  return effect && typeof effect === "object" && Number.isFinite(effect.startedAt)
    ? effect.startedAt
    : fallback;
}

function getEffectDuration(effect, fallback) {
  return effect && typeof effect === "object" && Number.isFinite(effect.duration)
    ? effect.duration
    : fallback;
}

function drawClearPulse(size, frameTime, effect) {
  const age = Math.max(0, frameTime - getEffectStart(effect, frameTime));
  const duration = getEffectDuration(effect, TIMING.clearBlink);
  const progress = Math.min(age / duration, 1);
  const pulse = 0.5 + Math.sin(progress * Math.PI * 8) * 0.5;

  boardCtx.save();
  boardCtx.globalAlpha = 0.32 + pulse * 0.36;
  boardCtx.strokeStyle = "#fff6d0";
  boardCtx.lineWidth = Math.max(2, size * 0.08);
  boardCtx.beginPath();
  boardCtx.ellipse(0, 0, size * 0.5, size * 0.48, -0.08, 0, Math.PI * 2);
  boardCtx.stroke();
  boardCtx.restore();
}

function drawBuiltInBlock(color, label, size) {
  const radius = size / 2;
  const fill = getBlockColor(color);
  const symbol = color === "yellow" ? "rgba(25, 27, 36, 0.7)" : "rgba(255, 255, 255, 0.88)";

  boardCtx.save();
  boardCtx.shadowColor = "rgba(0, 0, 0, 0.22)";
  boardCtx.shadowBlur = 6;
  boardCtx.shadowOffsetY = 5;
  boardCtx.fillStyle = fill;
  boardCtx.beginPath();
  boardCtx.ellipse(0, 0, radius * 0.98, radius * 0.94, -0.08, 0, Math.PI * 2);
  boardCtx.fill();
  boardCtx.restore();

  boardCtx.save();
  boardCtx.globalAlpha = 0.24;
  boardCtx.fillStyle = "#ffffff";
  boardCtx.beginPath();
  boardCtx.ellipse(-radius * 0.28, -radius * 0.34, radius * 0.24, radius * 0.17, -0.15, 0, Math.PI * 2);
  boardCtx.fill();
  boardCtx.restore();

  drawFace(radius);
  drawSymbol(label, symbol, radius);
}

function drawFace(radius) {
  boardCtx.save();
  boardCtx.fillStyle = "rgba(29, 31, 39, 0.52)";
  boardCtx.beginPath();
  boardCtx.arc(-radius * 0.18, -radius * 0.02, Math.max(2, radius * 0.06), 0, Math.PI * 2);
  boardCtx.arc(radius * 0.18, -radius * 0.02, Math.max(2, radius * 0.06), 0, Math.PI * 2);
  boardCtx.fill();
  boardCtx.restore();
}

function drawSymbol(label, color, radius) {
  const size = radius * 0.5;
  boardCtx.save();
  boardCtx.translate(0, radius * 0.32);
  boardCtx.strokeStyle = color;
  boardCtx.fillStyle = color;
  boardCtx.lineWidth = Math.max(3, radius * 0.12);
  boardCtx.lineCap = "round";
  boardCtx.lineJoin = "round";

  if (label === "circle") {
    boardCtx.beginPath();
    boardCtx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
    boardCtx.stroke();
  } else if (label === "cross") {
    boardCtx.beginPath();
    boardCtx.moveTo(-size * 0.45, 0);
    boardCtx.lineTo(size * 0.45, 0);
    boardCtx.moveTo(0, -size * 0.45);
    boardCtx.lineTo(0, size * 0.45);
    boardCtx.stroke();
  } else if (label === "square") {
    boardCtx.strokeRect(-size * 0.42, -size * 0.42, size * 0.84, size * 0.84);
  } else if (label === "diamond") {
    boardCtx.rotate(Math.PI / 4);
    boardCtx.fillRect(-size * 0.34, -size * 0.34, size * 0.68, size * 0.68);
  } else if (label === "triangle") {
    boardCtx.beginPath();
    boardCtx.moveTo(0, -size * 0.52);
    boardCtx.lineTo(size * 0.5, size * 0.42);
    boardCtx.lineTo(-size * 0.5, size * 0.42);
    boardCtx.closePath();
    boardCtx.fill();
  } else {
    boardCtx.beginPath();
    boardCtx.moveTo(-size * 0.5, size * 0.35);
    boardCtx.lineTo(size * 0.48, -size * 0.35);
    boardCtx.stroke();
  }

  boardCtx.restore();
}

function drawBlockImage(image, size) {
  const radius = 8;
  boardCtx.save();
  roundedRect(boardCtx, -size / 2, -size / 2, size, size, radius);
  boardCtx.clip();
  boardCtx.drawImage(image, -size / 2, -size / 2, size, size);
  boardCtx.restore();
}

function getBlockImage(block) {
  if (!block.image) return null;
  if (imageCache.has(block.image)) return imageCache.get(block.image);

  const image = new Image();
  image.decoding = "async";
  image.onload = queueRender;
  image.src = block.image;
  imageCache.set(block.image, image);
  return image;
}

function drawSelectedCell() {
  if (!isPlayableCell(selectedCell.row, selectedCell.col)) return;
  const { cellWidth, cellHeight, gap } = boardMetrics;
  const x = selectedCell.col * (cellWidth + gap);
  const y = selectedCell.row * (cellHeight + gap);

  boardCtx.save();
  boardCtx.strokeStyle = "rgba(255, 255, 255, 0.86)";
  boardCtx.lineWidth = 3;
  roundedRect(boardCtx, x + 2, y + 2, cellWidth - 4, cellHeight - 4, 8);
  boardCtx.stroke();
  boardCtx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function markGroups(groupCells) {
  clearTransientClasses();
  const startedAt = now();
  for (const { row, col } of groupCells) {
    effects.set(cellKey(row, col), {
      type: "clear",
      startedAt,
      duration: TIMING.clearBlink,
    });
  }
  queueRender();
}

function setCellClass(row, col, className, on) {
  const key = cellKey(row, col);
  if (on) {
    effects.set(key, className);
  } else {
    effects.delete(key);
  }
  queueRender();
}

function clearTransientClasses() {
  effects.clear();
  queueRender();
}

function cellKey(row, col) {
  return `${row}:${col}`;
}

function updateStats(activeCombo = 0) {
  scoreText.textContent = score.toLocaleString("ja-JP");
  movesText.textContent = String(moves);
  bestText.textContent = Math.max(best, score).toLocaleString("ja-JP");
  if (stageText) stageText.textContent = String(currentStageIndex + 1);
  if (goalText) goalText.textContent = currentStage.target.toLocaleString("ja-JP");
  chainText.textContent = `${activeCombo || chainPeak} Chain`;
  chainMeter.style.width = `${Math.min((activeCombo || chainPeak) * 18, 100)}%`;
}

async function finishStageIfCleared() {
  if (score < currentStage.target) return false;

  if (score > best) {
    best = score;
    localStorage.setItem(STORAGE_KEY, String(best));
  }

  updateStats(0);
  comboBadge.textContent = `Stage ${currentStageIndex + 1} Clear`;
  comboBadge.classList.remove("show");
  void comboBadge.offsetWidth;
  comboBadge.classList.add("show");

  if (currentStageIndex >= STAGES.length - 1) {
    gameOver = true;
    locked = true;
    setState("All Clear");
    setCharacterMood("newBest");
    render();
    return true;
  }

  locked = true;
  setState("Stage Clear");
  setCharacterMood("newBest", { duration: 900 });
  render();
  await wait(900);
  currentStageIndex += 1;
  startGame();
  setState(`Stage ${currentStageIndex + 1}`);
  return true;
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
  await settleBoardPaint();
  updateStats(0);
  vibrate(18);
  await wait(TIMING.shuffleSettle);
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
