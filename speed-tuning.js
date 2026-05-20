(function () {
  var SPEED_TIMING = {
    pickPop: 160,
    fallSettle: 340,
    clearBlink: 840,
  };

  var speedAnimationUntil = 0;
  var originalDrawBoard = drawBoard;
  var originalDrawBlock = drawBlock;

  function speedNow() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
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

  drawBoard = function () {
    originalDrawBoard();
    if (speedAnimationUntil > speedNow()) {
      queueRender();
    }
  };

  drawBlock = function (row, col, x, y, width, height, color, effect) {
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

  handleCellPress = async function (row, col) {
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
      commitBoardPaint();

      await wait(SPEED_TIMING.pickPop);
      render();
      await settleBoardPaint();
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
  };

  resolveBoard = async function () {
    var combo = 0;
    var didMove = await collapseAndFill();

    while (!paused) {
      var groups = findGroups(board);
      if (groups.length === 0) break;

      combo += 1;
      chainPeak = Math.max(chainPeak, combo);
      var clearedCells = flattenGroups(groups);
      var clearScore = clearedCells.length * 45 * combo + groups.length * 80;
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
      render();
      await settleBoardPaint();
      didMove = await collapseAndFill();
    }

    updateStats(0);
    return didMove;
  };

  collapseAndFill = async function () {
    var moved = false;
    var next = Array.from({ length: ROWS }, function () {
      return Array(COLS).fill(null);
    });

    for (var col = 0; col < COLS; col += 1) {
      var stack = [];

      for (var row = ROWS - 1; row >= 0; row -= 1) {
        if (board[row][col]) {
          stack.push(board[row][col]);
        }
      }

      var targetRow = ROWS - 1;
      for (var s = 0; s < stack.length; s += 1) {
        next[targetRow][col] = stack[s];
        targetRow -= 1;
      }

      while (targetRow >= 0) {
        next[targetRow][col] = randomColor();
        targetRow -= 1;
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
})();
