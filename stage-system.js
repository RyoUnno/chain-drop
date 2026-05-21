(function () {
  if (window.CHAIN_DROP_STAGE_ENABLED) return;
  window.CHAIN_DROP_STAGE_ENABLED = true;

  var STAGE_TIMING = {
    fallSettle: 340,
    clearBlink: 840,
  };
  var BOMB_ID = window.CHAIN_DROP_BOMB_ID || "__chain_drop_bomb__";
  var BOMB_MIN_GROUP = 5;
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
  var originalHandleCellPress = handleCellPress;
  var originalDrawBoard = drawBoard;
  var stageAnimationUntil = 0;

  function stageNow() {
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
      if (countPlayableCells(normalized.mask) >= GROUP_SIZE) stages.push(normalized);
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

  function isBombBlock(value) {
    return value === BOMB_ID || (window.isChainDropBomb && window.isChainDropBomb(value));
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

  function animateStageBoardFor(duration) {
    stageAnimationUntil = Math.max(stageAnimationUntil, stageNow() + duration);
    queueRender();
    return wait(duration);
  }

  function createBombTargets(groups) {
    var targets = [];
    for (var i = 0; i < groups.length; i += 1) {
      if (groups[i].length >= BOMB_MIN_GROUP) targets.push(pickBombTarget(groups[i]));
    }
    return targets;
  }

  function pickBombTarget(group) {
    var centerCol = (COLS - 1) / 2;
    var best = group[0];

    for (var i = 1; i < group.length; i += 1) {
      var cell = group[i];
      if (
        cell.row > best.row ||
        (cell.row === best.row && Math.abs(cell.col - centerCol) < Math.abs(best.col - centerCol))
      ) {
        best = cell;
      }
    }

    return { row: best.row, col: best.col };
  }

  drawBoard = function () {
    originalDrawBoard();
    if (stageAnimationUntil > stageNow()) queueRender();
  };

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
    render();
  };

  updateStats = function (activeCombo) {
    var combo = activeCombo || 0;
    scoreText.textContent = score.toLocaleString("ja-JP");
    movesText.textContent = String(moves);
    if (bestText) bestText.textContent = Math.max(best, score).toLocaleString("ja-JP");
    if (stageLabel) stageLabel.textContent = String(stageIndex + 1);
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

  findGroups = function (sourceBoard) {
    var visited = Array.from({ length: ROWS }, function () {
      return Array(COLS).fill(false);
    });
    var groups = [];

    for (var row = 0; row < ROWS; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var color = sourceBoard[row][col];
        if (!isPlayableCell(row, col) || !color || isBombBlock(color) || visited[row][col]) continue;

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
              isBombBlock(sourceBoard[next.row][next.col]) ||
              sourceBoard[next.row][next.col] !== color
            ) {
              continue;
            }
            visited[next.row][next.col] = true;
            queue.push(next);
          }
        }

        if (group.length >= GROUP_SIZE) groups.push(group);
      }
    }

    return groups;
  };

  collapseAndFill = async function () {
    var moved = false;
    var next = Array.from({ length: ROWS }, function () {
      return Array(COLS).fill(null);
    });

    for (var col = 0; col < COLS; col += 1) {
      var stack = [];
      var targetRows = [];

      for (var row = ROWS - 1; row >= 0; row -= 1) {
        if (isPlayableCell(row, col)) {
          targetRows.push(row);
          if (board[row][col]) stack.push(board[row][col]);
        }
      }

      for (var i = 0; i < targetRows.length; i += 1) {
        var targetRow = targetRows[i];
        next[targetRow][col] = i < stack.length ? stack[i] : randomColor();
        if (i >= stack.length) moved = true;
      }
    }

    for (var r = 0; r < ROWS; r += 1) {
      for (var c = 0; c < COLS; c += 1) {
        if (next[r][c] !== board[r][c]) moved = true;
      }
    }

    board = next;
    render(moved ? "drop" : "");
    await settleBoardPaint();

    if (moved) {
      await wait(STAGE_TIMING.fallSettle);
      clearTransientClasses();
      await settleBoardPaint();
    }

    return moved;
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
      await animateStageBoardFor(STAGE_TIMING.clearBlink);

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

  async function finishStageIfCleared() {
    if (score < stageDef.target) return false;

    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
    }

    updateStats(0);
    comboBadge.textContent = "Stage " + (stageIndex + 1) + " Clear";
    comboBadge.classList.remove("show");
    void comboBadge.offsetWidth;
    comboBadge.classList.add("show");

    if (stageIndex >= STAGES.length - 1) {
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
    stageIndex += 1;
    stageDef = STAGES[stageIndex];
    startGame();
    setState("Stage " + (stageIndex + 1));
    return true;
  }

  handleCellPress = async function (row, col) {
    if (locked || paused || !isPlayableCell(row, col)) return;
    await originalHandleCellPress(row, col);
    await finishStageIfCleared();
  };

  startGame();
})();
