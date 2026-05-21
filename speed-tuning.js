(function () {
  var SPEED_TIMING = {
    pickPop: 160,
    fallSettle: 340,
    clearBlink: 840,
  };
  var BOMB_ID = "__chain_drop_bomb__";
  var VOID_CELL = "__chain_drop_void__";
  var ROW_CLEAR_ID = "__chain_drop_row_clear__";
  var COL_CLEAR_ID = "__chain_drop_col_clear__";
  var BOMB_MIN_GROUP = 5;
  var LINE_MIN_GROUP = 5;
  var BOMB_ANIMATION = 560;
  var LINE_ANIMATION = 620;
  var BOMB_SCORE_BONUS = 120;
  var LINE_SCORE_BONUS = 160;
  var DEFAULT_STAGE_MASK = [
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
  var DEFAULT_STAGES = [
    { name: "Start", target: 1200, moves: 24, mask: DEFAULT_STAGE_MASK },
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
  var STAGES = normalizeStages(window.CHAIN_DROP_STAGES);
  var stageIndex = 0;
  var stageDef = STAGES[stageIndex];
  var stageLabel = document.querySelector("#stageText");
  var goalLabel = document.querySelector("#goalText");
  var stageSelect = document.querySelector("#stageSelect");

  var speedAnimationUntil = 0;
  var originalDrawBoard = drawBoard;
  var originalDrawBlock = drawBlock;

  window.CHAIN_DROP_BOMB_ID = BOMB_ID;
  window.isChainDropBomb = isBombBlock;
  window.CHAIN_DROP_LINE_CLEAR_IDS = { row: ROW_CLEAR_ID, col: COL_CLEAR_ID };
  window.CHAIN_DROP_STAGE_ENABLED = true;

  function speedNow() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }

  function normalizeStages(customStages) {
    var source = Array.isArray(customStages) && customStages.length ? customStages : DEFAULT_STAGES;
    var stages = [];

    for (var i = 0; i < source.length; i += 1) {
      var stage = source[i] || {};
      var fallback = DEFAULT_STAGES[i % DEFAULT_STAGES.length];
      var normalized = {
        name: String(stage.name || fallback.name || "Stage " + (i + 1)).trim(),
        target: Math.max(300, Number(stage.target) || fallback.target || 1200),
        moves: Math.max(8, Number(stage.moves) || fallback.moves || MOVES),
        mask: normalizeStageMask(stage.mask, fallback.mask),
      };
      if (countPlayableCells(normalized.mask) >= GROUP_SIZE) {
        stages.push(normalized);
      }
    }

    return stages.length ? stages : DEFAULT_STAGES;
  }

  function normalizeStageMask(mask, fallbackMask) {
    var source = Array.isArray(mask) ? mask : fallbackMask || DEFAULT_STAGE_MASK;
    var normalized = [];

    for (var row = 0; row < ROWS; row += 1) {
      var line = String(source[row] || DEFAULT_STAGE_MASK[row] || "").padEnd(COLS, "1");
      var normalizedLine = "";
      for (var col = 0; col < COLS; col += 1) {
        normalizedLine += line[col] === "0" ? "0" : "1";
      }
      normalized.push(normalizedLine);
    }

    return normalized;
  }

  function countPlayableCells(mask) {
    var count = 0;
    for (var row = 0; row < mask.length; row += 1) {
      for (var col = 0; col < mask[row].length; col += 1) {
        if (mask[row][col] === "1") count += 1;
      }
    }
    return count;
  }

  function syncBaseStageState() {
    try {
      currentStageIndex = stageIndex;
      currentStage = stageDef;
    } catch (error) {
      // Older game.js versions do not expose these bindings; speed tuning owns stage state.
    }
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
      stageDef &&
      stageDef.mask[row] &&
      stageDef.mask[row][col] === "1"
    );
  }

  function firstPlayableCell() {
    for (var row = ROWS - 1; row >= 0; row -= 1) {
      for (var col = 0; col < COLS; col += 1) {
        if (isPlayableCell(row, col)) return { row: row, col: col };
      }
    }
    return { row: ROWS - 1, col: 0 };
  }

  function buildStageSelect() {
    if (!stageSelect) return;

    stageSelect.textContent = "";
    for (var i = 0; i < STAGES.length; i += 1) {
      var stage = STAGES[i];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "stage-choice";
      button.dataset.stageIndex = String(i);
      button.textContent = String(i + 1);
      button.title =
        "Stage " +
        (i + 1) +
        " / " +
        stage.name +
        " / Goal " +
        stage.target.toLocaleString("ja-JP");
      button.setAttribute(
        "aria-label",
        "Stage " +
          (i + 1) +
          ", " +
          stage.name +
          ", goal " +
          stage.target.toLocaleString("ja-JP") +
          ", moves " +
          stage.moves
      );
      button.addEventListener("click", handleStageChoice);
      stageSelect.appendChild(button);
    }

    updateStageSelect();
  }

  function handleStageChoice(event) {
    var target = event.currentTarget;
    var nextIndex = Number(target && target.dataset ? target.dataset.stageIndex : NaN);
    selectStage(nextIndex);
  }

  function selectStage(nextIndex, force) {
    var normalized = Math.max(0, Math.min(STAGES.length - 1, Math.floor(Number(nextIndex))));
    if (!isFinite(normalized) || (!force && locked && !gameOver)) return;

    stageIndex = normalized;
    stageDef = STAGES[stageIndex];
    startGame();
    setState("Stage " + (stageIndex + 1));
  }

  function updateStageSelect() {
    if (!stageSelect) return;

    var buttons = stageSelect.querySelectorAll(".stage-choice");
    for (var i = 0; i < buttons.length; i += 1) {
      var active = i === stageIndex;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function isBombBlock(value) {
    return value === BOMB_ID;
  }

  function isLineClearBlock(value) {
    return value === ROW_CLEAR_ID || value === COL_CLEAR_ID;
  }

  function isSpecialBlock(value) {
    return isBombBlock(value) || isLineClearBlock(value);
  }

  function effectType(effect) {
    if (!effect) return "";
    return typeof effect === "string" ? effect : effect.type || "";
  }

  function effectStart(effect, fallback) {
    return effect && typeof effect === "object" && Number.isFinite(effect.startedAt)
      ? effect.startedAt
      : fallback;
  }

  function effectDuration(effect, fallback) {
    return effect && typeof effect === "object" && Number.isFinite(effect.duration)
      ? effect.duration
      : fallback;
  }

  async function animateBoardFor(duration) {
    speedAnimationUntil = Math.max(speedAnimationUntil, speedNow() + duration);
    queueRender();
    await wait(duration);
  }

  findGroups = function (sourceBoard) {
    var visited = Array.from({ length: ROWS }, function () {
      return Array(COLS).fill(false);
    });
    var groups = [];

    for (var row = 0; row < ROWS; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var color = sourceBoard[row][col];
        if (!isPlayableCell(row, col) || !color || isVoidCell(color) || isSpecialBlock(color) || visited[row][col]) {
          continue;
        }

        var group = [];
        var queue = [{ row: row, col: col }];
        visited[row][col] = true;

        while (queue.length > 0) {
          var current = queue.shift();
          group.push(current);

          var nextCells = neighbors(current.row, current.col);
          for (var n = 0; n < nextCells.length; n += 1) {
            var next = nextCells[n];
            if (
              visited[next.row][next.col] ||
              !isPlayableCell(next.row, next.col) ||
              isVoidCell(sourceBoard[next.row][next.col]) ||
              isSpecialBlock(sourceBoard[next.row][next.col]) ||
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
  };

  drawBoard = function () {
    originalDrawBoard();
    drawBlockedCells();
    if (speedAnimationUntil > speedNow()) {
      queueRender();
    }
  };

  function drawBlockedCells() {
    if (!boardMetrics || !boardMetrics.width || !boardMetrics.height) return;

    var cellWidth = boardMetrics.cellWidth;
    var cellHeight = boardMetrics.cellHeight;
    var gap = boardMetrics.gap;

    for (var row = 0; row < ROWS; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        if (isPlayableCell(row, col)) continue;
        var x = col * (cellWidth + gap);
        var y = row * (cellHeight + gap);
        drawBlockedCellBlock(x, y, cellWidth, cellHeight, row, col);
      }
    }
  }

  function drawBlockedCellBlock(x, y, width, height, row, col) {
    var inset = Math.max(1.5, Math.min(width, height) * 0.04);
    var bx = x + inset;
    var by = y + inset;
    var bw = width - inset * 2;
    var bh = height - inset * 2;
    var gradient = boardCtx.createLinearGradient(bx, by, bx, by + bh);

    gradient.addColorStop(0, "#9aa1aa");
    gradient.addColorStop(0.46, "#727982");
    gradient.addColorStop(1, "#4d545d");

    boardCtx.save();
    roundedRect(boardCtx, bx, by, bw, bh, 8);
    boardCtx.fillStyle = gradient;
    boardCtx.fill();
    boardCtx.strokeStyle = "rgba(255, 255, 255, 0.26)";
    boardCtx.lineWidth = Math.max(1.5, Math.min(width, height) * 0.035);
    boardCtx.stroke();

    boardCtx.globalAlpha = 0.34;
    boardCtx.strokeStyle = "#313842";
    boardCtx.lineWidth = Math.max(1.2, Math.min(width, height) * 0.028);
    boardCtx.beginPath();
    boardCtx.moveTo(bx + bw * 0.18, by + bh * 0.28);
    boardCtx.lineTo(bx + bw * 0.45, by + bh * 0.5);
    boardCtx.lineTo(bx + bw * 0.33, by + bh * 0.78);
    boardCtx.moveTo(bx + bw * 0.62, by + bh * 0.22);
    boardCtx.lineTo(bx + bw * 0.78, by + bh * 0.44);
    boardCtx.lineTo(bx + bw * 0.68, by + bh * 0.7);
    boardCtx.stroke();

    boardCtx.globalAlpha = 0.18;
    boardCtx.fillStyle = "#ffffff";
    boardCtx.beginPath();
    boardCtx.arc(bx + bw * (0.3 + ((row + col) % 2) * 0.32), by + bh * 0.25, Math.max(1.4, bw * 0.045), 0, Math.PI * 2);
    boardCtx.arc(bx + bw * 0.72, by + bh * 0.72, Math.max(1.2, bw * 0.034), 0, Math.PI * 2);
    boardCtx.fill();
    boardCtx.restore();
  }

  makeFreshBoard = function () {
    var next = [];

    do {
      next = Array.from({ length: ROWS }, function (_, row) {
        return Array.from({ length: COLS }, function (_, col) {
          return isPlayableCell(row, col) ? randomColor() : null;
        });
      });
    } while (findGroups(next).length > 0);

    return next;
  };

  startGame = function () {
    stageDef = STAGES[stageIndex];
    syncBaseStageState();
    score = 0;
    moves = stageDef.moves;
    locked = false;
    paused = false;
    gameOver = false;
    chainPeak = 0;
    selectedCell = firstPlayableCell();
    effects.clear();
    board = makeFreshBoard();
    updatePauseButton();
    updateStats();
    setState("Ready");
    setCharacterMood("idle");
    updateStageSelect();
    render();
  };

  updateStats = function (activeCombo) {
    var combo = activeCombo || 0;
    scoreText.textContent = score.toLocaleString("ja-JP");
    movesText.textContent = String(moves);
    if (bestText) bestText.textContent = Math.max(best, score).toLocaleString("ja-JP");
    if (stageLabel) stageLabel.textContent = stageIndex + 1 + "/" + STAGES.length;
    if (goalLabel) goalLabel.textContent = stageDef.target.toLocaleString("ja-JP");
    chainText.textContent = (combo || chainPeak) + " Chain";
    chainMeter.style.width = Math.min((combo || chainPeak) * 18, 100) + "%";
  };

  cellFromPoint = function (clientX, clientY) {
    var rect = boardCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    var x = clientX - rect.left;
    var y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    var row = Math.min(ROWS - 1, Math.max(0, Math.floor((y / rect.height) * ROWS)));
    var col = Math.min(COLS - 1, Math.max(0, Math.floor((x / rect.width) * COLS)));
    if (!isPlayableCell(row, col)) return null;
    return { row: row, col: col };
  };

  drawBlock = function (row, col, x, y, width, height, color, effect) {
    if (isBombBlock(color)) {
      drawBombBlock(x, y, width, height, effect);
      return;
    }

    if (isLineClearBlock(color)) {
      drawLineClearBlock(x, y, width, height, effect, color === ROW_CLEAR_ID ? "row" : "col");
      return;
    }

    if (effectType(effect) !== "clear") {
      originalDrawBlock(row, col, x, y, width, height, color, effect, speedNow());
      return;
    }

    var frameTime = speedNow();
    var age = Math.max(0, frameTime - effectStart(effect, frameTime));
    var duration = effectDuration(effect, SPEED_TIMING.clearBlink);
    var progress = Math.min(age / duration, 1);
    var flashOn = Math.floor(age / 120) % 2 === 0;
    var fade = 1 - Math.max(0, progress - 0.78) / 0.22;
    var block = getBlock(color);
    var size = Math.min(width, height) * 0.84;
    var alpha = (flashOn ? 1 : 0.32) * Math.max(0.34, fade);
    var scale = 1.04 + (flashOn ? 0.08 : 0);

    boardCtx.save();
    boardCtx.globalAlpha = alpha;
    boardCtx.translate(x + width / 2, y + height / 2);
    boardCtx.scale(scale, scale);
    drawClearPulse(size, frameTime, effect);

    if (block.image) {
      var image = getBlockImage(block);
      if (image && image.complete && image.naturalWidth) {
        drawBlockImage(image, size);
        boardCtx.restore();
        return;
      }
    }

    drawBuiltInBlock(color, block.label, size);
    boardCtx.restore();
  };

  function drawClearPulse(size, frameTime, effect) {
    var age = Math.max(0, frameTime - effectStart(effect, frameTime));
    var duration = effectDuration(effect, SPEED_TIMING.clearBlink);
    var progress = Math.min(age / duration, 1);
    var pulse = 0.5 + Math.sin(progress * Math.PI * 8) * 0.5;

    boardCtx.save();
    boardCtx.globalAlpha = 0.32 + pulse * 0.36;
    boardCtx.strokeStyle = "#fff6d0";
    boardCtx.lineWidth = Math.max(2, size * 0.08);
    boardCtx.beginPath();
    boardCtx.ellipse(0, 0, size * 0.5, size * 0.48, -0.08, 0, Math.PI * 2);
    boardCtx.stroke();
    boardCtx.restore();
  }

  function drawBombBlock(x, y, width, height, effect) {
    var frameTime = speedNow();
    var type = effectType(effect);
    var age = Math.max(0, frameTime - effectStart(effect, frameTime));
    var duration = effectDuration(effect, BOMB_ANIMATION);
    var progress = Math.min(age / duration, 1);
    var flashOn = Math.floor(age / 110) % 2 === 0;
    var size = Math.min(width, height) * 0.84;
    var radius = size * 0.43;
    var centerX = x + width / 2;
    var centerY = y + height / 2;
    var scale = 1;
    var alpha = 1;

    if (type === "clear") {
      scale = 1.05 + (flashOn ? 0.1 : 0);
      alpha = (flashOn ? 1 : 0.35) * (1 - Math.max(0, progress - 0.78) / 0.22);
    } else if (type === "pop") {
      scale = 1.05;
      alpha = 0.82;
    } else if (type === "drop") {
      centerY += size * 0.04;
    }

    boardCtx.save();
    boardCtx.globalAlpha = Math.max(0.18, alpha);
    boardCtx.translate(centerX, centerY);
    boardCtx.scale(scale, scale);

    if (type === "clear") {
      drawClearPulse(size, frameTime, effect);
    }

    var pulse = 0.5 + Math.sin(frameTime / 180) * 0.5;
    var glow = boardCtx.createRadialGradient(
      -radius * 0.28,
      -radius * 0.34,
      radius * 0.1,
      0,
      0,
      radius * 1.15
    );
    glow.addColorStop(0, "#ffe89a");
    glow.addColorStop(0.28, "#7c5cff");
    glow.addColorStop(0.74, "#25184e");
    glow.addColorStop(1, "#130d28");

    boardCtx.shadowColor = "rgba(255, 214, 94, 0.55)";
    boardCtx.shadowBlur = 8 + pulse * 8;
    boardCtx.fillStyle = glow;
    boardCtx.beginPath();
    boardCtx.ellipse(0, radius * 0.06, radius * 1.02, radius * 0.96, -0.08, 0, Math.PI * 2);
    boardCtx.fill();

    boardCtx.shadowBlur = 0;
    boardCtx.strokeStyle = "rgba(255, 255, 255, 0.34)";
    boardCtx.lineWidth = Math.max(2, size * 0.045);
    boardCtx.beginPath();
    boardCtx.ellipse(0, radius * 0.06, radius * 0.88, radius * 0.8, -0.08, 0, Math.PI * 2);
    boardCtx.stroke();

    boardCtx.strokeStyle = "#ffd65e";
    boardCtx.lineWidth = Math.max(3, size * 0.06);
    boardCtx.lineCap = "round";
    boardCtx.beginPath();
    boardCtx.moveTo(radius * 0.18, -radius * 0.82);
    boardCtx.quadraticCurveTo(radius * 0.34, -radius * 1.1, radius * 0.64, -radius * 1.05);
    boardCtx.stroke();

    boardCtx.fillStyle = "#fff2a8";
    boardCtx.beginPath();
    boardCtx.arc(radius * 0.74, -radius * 1.06, radius * (0.12 + pulse * 0.04), 0, Math.PI * 2);
    boardCtx.fill();

    boardCtx.fillStyle = "rgba(255, 255, 255, 0.58)";
    boardCtx.beginPath();
    boardCtx.ellipse(-radius * 0.3, -radius * 0.22, radius * 0.24, radius * 0.15, -0.45, 0, Math.PI * 2);
    boardCtx.fill();

    boardCtx.fillStyle = "#ffffff";
    boardCtx.font = "700 " + Math.max(18, Math.floor(size * 0.4)) + "px system-ui, sans-serif";
    boardCtx.textAlign = "center";
    boardCtx.textBaseline = "middle";
    boardCtx.fillText("!", 0, radius * 0.18);
    boardCtx.restore();
  }

  function drawLineClearBlock(x, y, width, height, effect, axis) {
    var frameTime = speedNow();
    var type = effectType(effect);
    var age = Math.max(0, frameTime - effectStart(effect, frameTime));
    var duration = effectDuration(effect, LINE_ANIMATION);
    var progress = Math.min(age / duration, 1);
    var flashOn = Math.floor(age / 105) % 2 === 0;
    var size = Math.min(width, height) * 0.84;
    var radius = size * 0.5;
    var centerX = x + width / 2;
    var centerY = y + height / 2;
    var scale = type === "clear" ? 1.04 + (flashOn ? 0.08 : 0) : 1;
    var alpha = type === "clear" ? (flashOn ? 1 : 0.36) * (1 - Math.max(0, progress - 0.78) / 0.22) : 1;
    var fill = axis === "row" ? "#0096c7" : "#ffb000";
    var stripe = axis === "row" ? "#d9f6ff" : "#fff4bf";

    boardCtx.save();
    boardCtx.globalAlpha = Math.max(0.18, alpha);
    boardCtx.translate(centerX, centerY);
    boardCtx.scale(scale, scale);

    if (type === "clear") {
      drawClearPulse(size, frameTime, effect);
    }

    boardCtx.shadowColor = "rgba(0, 0, 0, 0.28)";
    boardCtx.shadowBlur = 8;
    boardCtx.shadowOffsetY = 5;
    boardCtx.fillStyle = fill;
    roundedRect(boardCtx, -radius, -radius, size, size, 10);
    boardCtx.fill();
    boardCtx.shadowBlur = 0;
    boardCtx.shadowOffsetY = 0;

    boardCtx.strokeStyle = "rgba(255, 255, 255, 0.66)";
    boardCtx.lineWidth = Math.max(2, size * 0.06);
    roundedRect(boardCtx, -radius + 2, -radius + 2, size - 4, size - 4, 8);
    boardCtx.stroke();

    boardCtx.strokeStyle = stripe;
    boardCtx.fillStyle = stripe;
    boardCtx.lineWidth = Math.max(4, size * 0.11);
    boardCtx.lineCap = "round";
    boardCtx.lineJoin = "round";
    boardCtx.beginPath();
    if (axis === "row") {
      boardCtx.moveTo(-radius * 0.55, 0);
      boardCtx.lineTo(radius * 0.55, 0);
    } else {
      boardCtx.moveTo(0, -radius * 0.55);
      boardCtx.lineTo(0, radius * 0.55);
    }
    boardCtx.stroke();

    drawLineArrow(axis, radius, 1);
    drawLineArrow(axis, radius, -1);

    boardCtx.globalAlpha = Math.max(0.22, alpha * 0.3);
    boardCtx.strokeStyle = "#ffffff";
    boardCtx.lineWidth = Math.max(1.6, size * 0.035);
    boardCtx.beginPath();
    if (axis === "row") {
      boardCtx.moveTo(-radius * 0.72, -radius * 0.34);
      boardCtx.lineTo(radius * 0.72, -radius * 0.34);
      boardCtx.moveTo(-radius * 0.72, radius * 0.34);
      boardCtx.lineTo(radius * 0.72, radius * 0.34);
    } else {
      boardCtx.moveTo(-radius * 0.34, -radius * 0.72);
      boardCtx.lineTo(-radius * 0.34, radius * 0.72);
      boardCtx.moveTo(radius * 0.34, -radius * 0.72);
      boardCtx.lineTo(radius * 0.34, radius * 0.72);
    }
    boardCtx.stroke();
    boardCtx.restore();
  }

  function drawLineArrow(axis, radius, direction) {
    boardCtx.save();
    if (axis === "row") {
      boardCtx.translate(direction * radius * 0.55, 0);
      if (direction < 0) boardCtx.rotate(Math.PI);
    } else {
      boardCtx.translate(0, direction * radius * 0.55);
      boardCtx.rotate(direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    }

    boardCtx.beginPath();
    boardCtx.moveTo(radius * 0.22, 0);
    boardCtx.lineTo(-radius * 0.08, -radius * 0.18);
    boardCtx.lineTo(-radius * 0.08, radius * 0.18);
    boardCtx.closePath();
    boardCtx.fill();
    boardCtx.restore();
  }

  markGroups = function (groupCells) {
    clearTransientClasses();
    var startedAt = speedNow();
    for (var i = 0; i < groupCells.length; i += 1) {
      var cell = groupCells[i];
      effects.set(cellKey(cell.row, cell.col), {
        type: "clear",
        startedAt: startedAt,
        duration: SPEED_TIMING.clearBlink,
      });
    }
    queueRender();
  };

  async function finishStageIfCleared() {
    if (score < stageDef.target) return false;
    var isFinalStage = stageIndex >= STAGES.length - 1;

    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
    }

    updateStats(0);
    comboBadge.textContent = "Stage " + (stageIndex + 1) + " Clear";
    comboBadge.classList.remove("show");
    void comboBadge.offsetWidth;
    comboBadge.classList.add("show");
    gameOver = true;
    locked = true;

    if (
      window.ChainDropFlow &&
      typeof window.ChainDropFlow.stageClear === "function" &&
      window.ChainDropFlow.stageClear({
        stageIndex: stageIndex,
        stage: stageDef,
        score: score,
        final: isFinalStage,
      })
    ) {
      return true;
    }

    setState(isFinalStage ? "All Clear" : "Stage Clear");
    setCharacterMood("newBest");
    render();

    if (isFinalStage) {
      return true;
    }

    await wait(900);
    stageIndex += 1;
    stageDef = STAGES[stageIndex];
    startGame();
    setState("Stage " + (stageIndex + 1));
    return true;
  }

  handleCellPress = async function (row, col) {
    if (locked || paused || gameOver || !isPlayableCell(row, col) || !board[row][col] || isVoidCell(board[row][col])) {
      return;
    }

    if (isBombBlock(board[row][col])) {
      await triggerBomb(row, col);
      return;
    }

    if (isLineClearBlock(board[row][col])) {
      await triggerLineClear(row, col, board[row][col]);
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

      await wait(SPEED_TIMING.pickPop);
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
  };

  async function triggerBomb(row, col) {
    locked = true;
    try {
      var blastCells = collectBlastCells(row, col);
      var points = BOMB_SCORE_BONUS + blastCells.length * 40;
      moves -= 1;
      score += points;
      updateStats();
      showBombBadge(points);
      pulse(scoreText);
      setState("Bomb");
      setCharacterMood("bigCombo", { duration: 1200 });
      markBlastCells(blastCells);
      vibrate([18, 28, 18]);
      await animateBoardFor(BOMB_ANIMATION);

      for (var i = 0; i < blastCells.length; i += 1) {
        var cell = blastCells[i];
        board[cell.row][cell.col] = null;
      }

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
      console.error("Chain Drop bomb failed", error);
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

  async function triggerLineClear(row, col, lineType) {
    locked = true;
    try {
      var lineCells = collectLineCells(row, col, lineType);
      var points = LINE_SCORE_BONUS + lineCells.length * 45;
      moves -= 1;
      score += points;
      updateStats();
      showLineBadge(lineType, points);
      pulse(scoreText);
      setState(lineType === ROW_CLEAR_ID ? "Row Clear" : "Column Clear");
      setCharacterMood("bigCombo", { duration: 1200 });
      markLineCells(lineCells);
      vibrate(lineType === ROW_CLEAR_ID ? [14, 24, 14] : [18, 18, 28]);
      await animateBoardFor(LINE_ANIMATION);

      for (var i = 0; i < lineCells.length; i += 1) {
        var cell = lineCells[i];
        board[cell.row][cell.col] = null;
      }

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
      console.error("Chain Drop line clear failed", error);
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

  resolveBoard = async function () {
    var combo = 0;
    var didMove = await collapseAndFill();

    while (!paused) {
      var groups = findGroups(board);
      if (groups.length === 0) break;

      combo += 1;
      chainPeak = Math.max(chainPeak, combo);
      var clearedCells = flattenGroups(groups);
      var rewards = createGroupRewards(groups);
      var clearScore = clearedCells.length * 45 * combo + groups.length * 80 + rewards.length * 90;
      score += clearScore;
      updateStats(combo);
      showCombo(combo, clearScore);
      setCharacterMood(combo >= 3 ? "bigCombo" : combo > 1 ? "combo" : "clear", {
        duration: 1200,
      });
      markGroups(clearedCells);
      vibrate(combo > 1 ? [16, 25, 20] : 18);
      await animateBoardFor(SPEED_TIMING.clearBlink);

      for (var i = 0; i < clearedCells.length; i += 1) {
        var cell = clearedCells[i];
        board[cell.row][cell.col] = null;
      }

      for (var b = 0; b < rewards.length; b += 1) {
        var target = rewards[b];
        board[target.row][target.col] = target.id;
      }

      render();
      await settleBoardPaint();
      didMove = await collapseAndFill();
    }

    updateStats(0);
    return didMove;
  };

  function createGroupRewards(groups) {
    var targets = [];
    var occupied = {};
    for (var i = 0; i < groups.length; i += 1) {
      var reward = pickLineReward(groups[i]) || (groups[i].length >= BOMB_MIN_GROUP ? pickBombReward(groups[i]) : null);
      if (reward && !occupied[cellKey(reward.row, reward.col)]) {
        occupied[cellKey(reward.row, reward.col)] = true;
        targets.push(reward);
      }
    }
    return targets;
  }

  function pickBombReward(group) {
    var target = pickBombTarget(group);
    return { row: target.row, col: target.col, id: BOMB_ID };
  }

  function pickLineReward(group) {
    var verticalRun = findBestConsecutiveLine(group, "col");
    var horizontalRun = findBestConsecutiveLine(group, "row");

    if (verticalRun.length >= LINE_MIN_GROUP && verticalRun.length >= horizontalRun.length) {
      return lineRewardFromRun(verticalRun, COL_CLEAR_ID);
    }

    if (horizontalRun.length >= LINE_MIN_GROUP) {
      return lineRewardFromRun(horizontalRun, ROW_CLEAR_ID);
    }

    return null;
  }

  function findBestConsecutiveLine(group, fixedAxis) {
    var buckets = {};
    var variableAxis = fixedAxis === "col" ? "row" : "col";
    var best = [];

    for (var i = 0; i < group.length; i += 1) {
      var cell = group[i];
      var key = cell[fixedAxis];
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(cell);
    }

    Object.keys(buckets).forEach(function (key) {
      var cells = buckets[key].slice().sort(function (a, b) {
        return a[variableAxis] - b[variableAxis];
      });
      var run = [];

      for (var i = 0; i < cells.length; i += 1) {
        if (!run.length || cells[i][variableAxis] === run[run.length - 1][variableAxis] + 1) {
          run.push(cells[i]);
        } else {
          if (run.length > best.length) best = run.slice();
          run = [cells[i]];
        }
      }

      if (run.length > best.length) best = run.slice();
    });

    return best;
  }

  function lineRewardFromRun(run, id) {
    var axis = id === ROW_CLEAR_ID ? "col" : "row";
    var cells = run.slice().sort(function (a, b) {
      return a[axis] - b[axis];
    });
    var target = cells[Math.floor((cells.length - 1) / 2)];
    return { row: target.row, col: target.col, id: id };
  }

  function pickBombTarget(group) {
    var centerCol = (COLS - 1) / 2;
    var best = group[0];

    for (var i = 1; i < group.length; i += 1) {
      var cell = group[i];
      var cellDistance = Math.abs(cell.col - centerCol);
      var bestDistance = Math.abs(best.col - centerCol);
      if (cell.row > best.row || (cell.row === best.row && cellDistance < bestDistance)) {
        best = cell;
      }
    }

    return { row: best.row, col: best.col };
  }

  function collectBlastCells(startRow, startCol) {
    var queue = [{ row: startRow, col: startCol }];
    var visitedBombs = {};
    var cells = {};

    while (queue.length > 0) {
      var bomb = queue.shift();
      var bombKey = cellKey(bomb.row, bomb.col);
      if (visitedBombs[bombKey]) continue;
      visitedBombs[bombKey] = true;

      for (var row = bomb.row - 1; row <= bomb.row + 1; row += 1) {
        for (var col = bomb.col - 1; col <= bomb.col + 1; col += 1) {
          if (
            row < 0 ||
            row >= ROWS ||
            col < 0 ||
            col >= COLS ||
            !isPlayableCell(row, col) ||
            !board[row][col] ||
            isVoidCell(board[row][col])
          ) {
            continue;
          }
          var key = cellKey(row, col);
          cells[key] = { row: row, col: col };

          if (isBombBlock(board[row][col]) && !visitedBombs[key]) {
            queue.push({ row: row, col: col });
          }
        }
      }
    }

    return Object.keys(cells).map(function (key) {
      return cells[key];
    });
  }

  function collectLineCells(startRow, startCol, lineType) {
    var cells = [];

    if (lineType === ROW_CLEAR_ID) {
      for (var col = 0; col < COLS; col += 1) {
        collectLineCell(cells, startRow, col);
      }
      return cells;
    }

    for (var row = 0; row < ROWS; row += 1) {
      collectLineCell(cells, row, startCol);
    }
    return cells;
  }

  function collectLineCell(cells, row, col) {
    if (!isPlayableCell(row, col) || !board[row][col] || isVoidCell(board[row][col])) return;
    cells.push({ row: row, col: col });
  }

  function markBlastCells(cells) {
    clearTransientClasses();
    var startedAt = speedNow();
    for (var i = 0; i < cells.length; i += 1) {
      var cell = cells[i];
      effects.set(cellKey(cell.row, cell.col), {
        type: "clear",
        startedAt: startedAt,
        duration: BOMB_ANIMATION,
      });
    }
    queueRender();
  }

  function markLineCells(cells) {
    clearTransientClasses();
    var startedAt = speedNow();
    for (var i = 0; i < cells.length; i += 1) {
      var cell = cells[i];
      effects.set(cellKey(cell.row, cell.col), {
        type: "clear",
        startedAt: startedAt,
        duration: LINE_ANIMATION,
      });
    }
    queueRender();
  }

  function showBombBadge(points) {
    comboBadge.textContent = "Bomb +" + points.toLocaleString("ja-JP");
    comboBadge.classList.remove("show");
    void comboBadge.offsetWidth;
    comboBadge.classList.add("show");
  }

  function showLineBadge(lineType, points) {
    comboBadge.textContent =
      (lineType === ROW_CLEAR_ID ? "Row Clear +" : "Column Clear +") + points.toLocaleString("ja-JP");
    comboBadge.classList.remove("show");
    void comboBadge.offsetWidth;
    comboBadge.classList.add("show");
  }

  collapseAndFill = async function () {
    var moved = false;
    var next = Array.from({ length: ROWS }, function (_, row) {
      return Array.from({ length: COLS }, function (_, col) {
        return null;
      });
    });

    for (var col = 0; col < COLS; col += 1) {
      var stack = [];

      for (var row = ROWS - 1; row >= 0; row -= 1) {
        if (isPlayableCell(row, col) && board[row][col] && !isVoidCell(board[row][col])) {
          stack.push(board[row][col]);
        }
      }

      var targetRows = [];
      for (var target = ROWS - 1; target >= 0; target -= 1) {
        if (isPlayableCell(target, col)) {
          targetRows.push(target);
        }
      }

      var targetIndex = 0;
      for (var s = 0; s < stack.length; s += 1) {
        var targetRow = targetRows[targetIndex];
        next[targetRow][col] = stack[s];
        targetIndex += 1;
      }

      while (targetIndex < targetRows.length) {
        var fillRow = targetRows[targetIndex];
        next[fillRow][col] = randomColor();
        targetIndex += 1;
        moved = true;
      }
    }

    for (var r = 0; r < ROWS; r += 1) {
      for (var c = 0; c < COLS; c += 1) {
        if (next[r][c] !== board[r][c]) {
          moved = true;
        }
      }
    }

    board = next;
    render(moved ? "drop" : "");
    await settleBoardPaint();

    if (moved) {
      await wait(SPEED_TIMING.fallSettle);
      clearTransientClasses();
      await settleBoardPaint();
    }

    return moved;
  };

  window.ChainDropStages = {
    stages: STAGES,
    select: function (nextIndex) {
      selectStage(nextIndex, true);
    },
    current: function () {
      return stageIndex;
    },
  };

  buildStageSelect();
  startGame();
})();
