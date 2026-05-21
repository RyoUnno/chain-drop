(function () {
  var BOMB_ID = "__chain_drop_bomb__";
  var BOMB_MIN_GROUP = 5;
  var BOMB_ANIMATION = 560;
  var BOMB_SCORE_BONUS = 120;
  var originalFindGroups = findGroups;
  var originalDrawBlock = drawBlock;
  var originalHandleCellPress = handleCellPress;

  window.CHAIN_DROP_BOMB_ID = BOMB_ID;
  window.isChainDropBomb = isBombBlock;

  function bombNow() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }

  function effectKind(effect) {
    if (!effect) return "";
    return typeof effect === "string" ? effect : effect.type || "";
  }

  function effectStartedAt(effect, fallback) {
    return effect && typeof effect === "object" && Number.isFinite(effect.startedAt)
      ? effect.startedAt
      : fallback;
  }

  function effectLength(effect, fallback) {
    return effect && typeof effect === "object" && Number.isFinite(effect.duration)
      ? effect.duration
      : fallback;
  }

  function isBombBlock(value) {
    return value === BOMB_ID;
  }

  findGroups = function (sourceBoard) {
    var visited = Array.from({ length: ROWS }, function () {
      return Array(COLS).fill(false);
    });
    var groups = [];

    for (var row = 0; row < ROWS; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var color = sourceBoard[row][col];
        if (!color || isBombBlock(color) || visited[row][col]) continue;

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
              isBombBlock(sourceBoard[next.row][next.col]) ||
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

  drawBlock = function (row, col, x, y, width, height, color, effect, frameTime) {
    if (!isBombBlock(color)) {
      originalDrawBlock(row, col, x, y, width, height, color, effect, frameTime);
      return;
    }

    drawBombBlock(x, y, width, height, effect, frameTime || bombNow());
  };

  handleCellPress = async function (row, col) {
    if (!board[row] || !isBombBlock(board[row][col])) {
      return originalHandleCellPress(row, col);
    }

    if (locked || paused || gameOver || moves <= 0) return;
    await triggerBomb(row, col);
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
      var bombTargets = createBombTargets(groups);
      var clearScore = clearedCells.length * 45 * combo + groups.length * 80;
      score += clearScore;
      updateStats(combo);
      showCombo(combo, clearScore);
      setCharacterMood(combo >= 3 ? "bigCombo" : combo > 1 ? "combo" : "clear", {
        duration: 1200,
      });
      markGroups(clearedCells);
      vibrate(combo > 1 ? [16, 25, 20] : 18);
      await animateBoardFor(TIMING.clearBlink);

      for (var i = 0; i < clearedCells.length; i += 1) {
        var cell = clearedCells[i];
        board[cell.row][cell.col] = null;
      }

      for (var b = 0; b < bombTargets.length; b += 1) {
        var target = bombTargets[b];
        board[target.row][target.col] = BOMB_ID;
      }

      render();
      await settleBoardPaint();
      didMove = await collapseAndFill();
    }

    updateStats(0);
    return didMove;
  };

  async function triggerBomb(row, col) {
    locked = true;
    try {
      var blastCells = collectBlastCells(row, col);
      if (blastCells.length === 0) return;

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

  function createBombTargets(groups) {
    var targets = [];
    for (var i = 0; i < groups.length; i += 1) {
      if (groups[i].length >= BOMB_MIN_GROUP) {
        targets.push(pickBombTarget(groups[i]));
      }
    }
    return targets;
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
          if (row < 0 || row >= ROWS || col < 0 || col >= COLS || !board[row][col]) continue;
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

  function markBlastCells(cells) {
    clearTransientClasses();
    var startedAt = bombNow();
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

  function showBombBadge(points) {
    if (!comboBadge) return;
    comboBadge.textContent = "Bomb +" + points.toLocaleString("ja-JP");
    comboBadge.classList.remove("show");
    void comboBadge.offsetWidth;
    comboBadge.classList.add("show");
  }

  function drawBombBlock(x, y, width, height, effect, frameTime) {
    var type = effectKind(effect);
    var age = Math.max(0, frameTime - effectStartedAt(effect, frameTime));
    var duration = effectLength(effect, BOMB_ANIMATION);
    var progress = Math.min(age / duration, 1);
    var flashOn = Math.floor(age / 110) % 2 === 0;
    var size = Math.min(width, height) * 0.84;
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

    if (type === "clear" && typeof drawClearPulse === "function") {
      drawClearPulse(size, frameTime, effect);
    }

    var radius = size * 0.43;
    var pulse = 0.5 + Math.sin(frameTime / 180) * 0.5;
    var glow = boardCtx.createRadialGradient(-radius * 0.28, -radius * 0.34, radius * 0.1, 0, 0, radius * 1.15);
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

  if (!originalFindGroups || !originalDrawBlock || !originalHandleCellPress) {
    console.warn("Chain Drop bomb gimmick loaded before the game was ready.");
  }
})();
