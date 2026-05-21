(function () {
  var STORAGE_KEY = "chain-drop-unlocked-stage";
  var gameShell = document.querySelector(".game-shell");
  var titleStartButton = document.querySelector("#titleStartButton");
  var stageSelect = document.querySelector("#stageSelect");
  var unlockText = document.querySelector("#unlockText");
  var resultKicker = document.querySelector("#resultKicker");
  var resultTitle = document.querySelector("#resultTitle");
  var resultText = document.querySelector("#resultText");
  var resultMenuButton = document.querySelector("#resultMenuButton");
  var restartButton = document.querySelector("#restartButton");
  var flowMode = "title";
  var stageApi = window.ChainDropStages;
  var unlockedStage = readUnlockedStage();

  if (!gameShell || !stageApi || !Array.isArray(stageApi.stages)) return;

  function readUnlockedStage() {
    try {
      return Math.max(0, Number(localStorage.getItem(STORAGE_KEY)) || 0);
    } catch (error) {
      return 0;
    }
  }

  function saveUnlockedStage() {
    try {
      localStorage.setItem(STORAGE_KEY, String(unlockedStage));
    } catch (error) {
      // Progress still works for the current session if storage is unavailable.
    }
  }

  function clampStage(index) {
    var stages = stageApi.stages;
    var number = Math.floor(Number(index));
    if (!isFinite(number)) return 0;
    return Math.max(0, Math.min(stages.length - 1, number));
  }

  function setFlowMode(mode) {
    flowMode = mode;
    gameShell.dataset.flow = mode;

    if (mode !== "play") {
      try {
        locked = true;
        gameOver = true;
      } catch (error) {
        // Older builds may not expose the game lock binding.
      }
    }
  }

  function showTitle() {
    setFlowMode("title");
    setState("Title");
    setCharacterMood("idle");
  }

  function showStageMenu() {
    buildStageMenu();
    setFlowMode("menu");
    setState("Stage Select");
    setCharacterMood("idle");
  }

  function beginStage(index) {
    var stageIndex = clampStage(index);
    if (stageIndex > unlockedStage) return;

    setFlowMode("play");
    stageApi.select(stageIndex);
    setState("Stage " + (stageIndex + 1));
  }

  function buildStageMenu() {
    var stages = stageApi.stages;
    unlockedStage = Math.min(unlockedStage, stages.length - 1);
    if (unlockText) unlockText.textContent = unlockedStage + 1 + "/" + stages.length;
    if (!stageSelect) return;

    stageSelect.textContent = "";
    for (var i = 0; i < stages.length; i += 1) {
      stageSelect.appendChild(createStageButton(i, stages[i], i <= unlockedStage));
    }
  }

  function createStageButton(index, stage, unlocked) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "stage-card";
    button.disabled = !unlocked;
    button.setAttribute("aria-label", stageLabel(index, stage, unlocked));

    var number = document.createElement("span");
    number.className = "stage-number";
    number.textContent = String(index + 1);

    var copy = document.createElement("span");
    copy.className = "stage-name";

    var name = document.createElement("strong");
    name.textContent = stage.name || "Stage " + (index + 1);

    var meta = document.createElement("span");
    meta.textContent = "Goal " + stage.target.toLocaleString("ja-JP") + " / Moves " + stage.moves;

    var status = document.createElement("span");
    status.className = "stage-status";
    status.textContent = unlocked ? "Play" : "Locked";

    copy.appendChild(name);
    copy.appendChild(meta);
    button.appendChild(number);
    button.appendChild(copy);
    button.appendChild(status);

    if (unlocked) {
      button.addEventListener("click", function () {
        beginStage(index);
      });
    }

    return button;
  }

  function stageLabel(index, stage, unlocked) {
    return (
      "Stage " +
      (index + 1) +
      ", " +
      (stage.name || "Stage " + (index + 1)) +
      ", goal " +
      stage.target.toLocaleString("ja-JP") +
      ", moves " +
      stage.moves +
      (unlocked ? ", playable" : ", locked")
    );
  }

  function unlockThrough(index) {
    var nextUnlocked = Math.min(stageApi.stages.length - 1, Math.max(unlockedStage, index));
    if (nextUnlocked !== unlockedStage) {
      unlockedStage = nextUnlocked;
      saveUnlockedStage();
    }
  }

  function showResult(clear, detail) {
    var stageIndex = clampStage(detail && typeof detail.stageIndex !== "undefined" ? detail.stageIndex : stageApi.current());
    var isFinal = clear && stageIndex >= stageApi.stages.length - 1;

    if (clear) unlockThrough(stageIndex + 1);

    try {
      gameOver = true;
      locked = true;
    } catch (error) {
      // The screen state is enough if these bindings are unavailable.
    }

    if (resultKicker) resultKicker.textContent = "Stage " + (stageIndex + 1);
    if (resultTitle) resultTitle.textContent = clear ? (isFinal ? "All Clear" : "Stage Clear") : "Stage Failed";
    if (resultText) {
      resultText.textContent = clear
        ? isFinal
          ? "All stages cleared"
          : "Next stage unlocked"
        : "Try this stage again";
    }

    setFlowMode("result");
    setState(clear ? (isFinal ? "All Clear" : "Stage Clear") : "Failed");
    setCharacterMood(clear ? "newBest" : "finish");
    return true;
  }

  function stageTargetReached() {
    var index = clampStage(stageApi.current());
    var stage = stageApi.stages[index];
    return stage && score >= stage.target;
  }

  if (titleStartButton) {
    titleStartButton.addEventListener("click", showStageMenu);
  }

  if (resultMenuButton) {
    resultMenuButton.addEventListener("click", showStageMenu);
  }

  if (restartButton) {
    restartButton.addEventListener(
      "click",
      function (event) {
        if (flowMode !== "play") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        beginStage(stageApi.current());
      },
      true
    );
  }

  var originalStartGame = startGame;
  startGame = function () {
    if (flowMode === "result") return;
    return originalStartGame();
  };

  var originalSetState = setState;
  setState = function (text) {
    var result = originalSetState(text);
    if (flowMode === "play" && (text === "Stage Clear" || text === "All Clear")) {
      showResult(true, { stageIndex: stageApi.current(), score: score, final: text === "All Clear" });
    }
    return result;
  };

  var originalEndGame = endGame;
  endGame = function () {
    var reached = stageTargetReached();
    var result = originalEndGame();
    if (flowMode === "play" && !reached) {
      showResult(false, { stageIndex: stageApi.current(), score: score });
    }
    return result;
  };

  window.ChainDropFlow = {
    mode: function () {
      return flowMode;
    },
    stageClear: function (detail) {
      return showResult(true, detail);
    },
    stageFail: function (detail) {
      return showResult(false, detail);
    },
    showStageMenu: showStageMenu,
    beginStage: beginStage,
  };

  showTitle();
})();
