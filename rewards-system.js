(function () {
  var STAR_STORAGE_KEY = "chain-drop-stage-stars";
  var stageApi = window.ChainDropStages;
  var flowApi = window.ChainDropFlow;
  var gameShell = document.querySelector(".game-shell");
  var stageSelect = document.querySelector("#stageSelect");
  var resultScreen = document.querySelector("#resultScreen");
  var resultCopy = resultScreen && resultScreen.querySelector(".flow-result-copy");
  var pendingResult = null;
  var stats = createStats();

  setupDramaVoiceFallback();

  if (!stageApi || !flowApi || !Array.isArray(stageApi.stages) || typeof stageApi.result === "function") {
    return;
  }

  var defaultMissions = [
    { type: "chain", value: 2, text: "2 Chain以上を出す" },
    { type: "line", value: 1, text: "ラインブロックを1回使う" },
    { type: "chain", value: 3, text: "3 Chain以上を出す" },
    { type: "bomb", value: 1, text: "ボムを1回使う" },
    { type: "chain", value: 4, text: "4 Chain以上を出す" },
  ];

  stageApi.stages.forEach(function (stage, index) {
    var customStages = Array.isArray(window.CHAIN_DROP_STAGES) ? window.CHAIN_DROP_STAGES : [];
    var customStage = customStages[index] || {};
    var customMission = customStage.mission || stage.mission;
    var customStarScore = customStage.starScore || stage.starScore;
    var customStarScoreMultiplier = customStage.starScoreMultiplier || stage.starScoreMultiplier;
    var customStarMoves = customStage.starMoves || stage.starMoves;

    stage.mission = normalizeMission(customMission, defaultMissions[index % defaultMissions.length]);
    stage.starScore = Math.max(
      stage.target || 0,
      Math.floor(Number(customStarScore) || (stage.target || 1200) * (Number(customStarScoreMultiplier) || 1.25))
    );
    stage.starMoves = Math.max(1, Math.ceil(Number(customStarMoves) || (stage.moves || 24) * 0.2));
  });

  ensureMissionStrip();
  ensureResultFields();
  wrapGameHooks();
  wrapFlowHooks();
  setupMenuDecorators();
  updateMissionText();

  function createStats() {
    return {
      maxChain: 0,
      bombsUsed: 0,
      lineClearsUsed: 0,
      score: 0,
      movesLeft: 0,
    };
  }

  function currentStageIndex() {
    return stageApi && typeof stageApi.current === "function" ? stageApi.current() : 0;
  }

  function currentStage() {
    return stageApi.stages[Math.max(0, Math.min(stageApi.stages.length - 1, currentStageIndex()))] || {};
  }

  function normalizeMission(mission, fallback) {
    var source = mission && typeof mission === "object" ? mission : fallback || {};
    var type = String(source.type || source.kind || "chain").trim();
    var value = Math.max(1, Math.floor(Number(source.value || source.count || source.target) || 2));

    if (["chain", "line", "bomb", "score", "moves"].indexOf(type) === -1) type = "chain";
    return {
      type: type,
      value: value,
      text: String(source.text || source.label || defaultMissionText(type, value)).trim(),
    };
  }

  function defaultMissionText(type, value) {
    if (type === "line") return "ラインブロックを" + value + "回使う";
    if (type === "bomb") return "ボムを" + value + "回使う";
    if (type === "score") return value.toLocaleString("ja-JP") + "点以上を取る";
    if (type === "moves") return "残り" + value + "手以上でクリア";
    return value + " Chain以上を出す";
  }

  function syncStats() {
    try {
      stats.score = typeof score === "number" ? score : stats.score;
      stats.movesLeft = typeof moves === "number" ? moves : stats.movesLeft;
      stats.maxChain = Math.max(stats.maxChain, typeof chainPeak === "number" ? chainPeak : 0);
    } catch (error) {
      // If a game binding is unavailable, keep the last known value.
    }
    return stats;
  }

  function missionProgressValue(mission) {
    syncStats();
    if (!mission) return 0;
    if (mission.type === "line") return stats.lineClearsUsed;
    if (mission.type === "bomb") return stats.bombsUsed;
    if (mission.type === "score") return stats.score;
    if (mission.type === "moves") return stats.movesLeft;
    return stats.maxChain;
  }

  function missionCleared(mission) {
    return missionProgressValue(mission) >= mission.value;
  }

  function missionProgressText(mission) {
    if (!mission) return "";
    var progress = Math.min(missionProgressValue(mission), mission.value);
    if (missionCleared(mission)) return mission.text + " 達成";
    if (mission.type === "score") {
      return mission.text + " " + progress.toLocaleString("ja-JP") + "/" + mission.value.toLocaleString("ja-JP");
    }
    return mission.text + " " + progress + "/" + mission.value;
  }

  function buildResult(clear, detail) {
    var stage = currentStage();
    var mission = stage.mission;
    var missionDone = missionCleared(mission);
    var stars = clear ? 1 + (missionDone ? 1 : 0) : 0;
    syncStats();
    if (clear && (stats.score >= stage.starScore || stats.movesLeft >= stage.starMoves)) stars += 1;
    stars = clear ? Math.max(1, Math.min(3, stars)) : 0;

    return merge(
      {
        stageIndex: currentStageIndex(),
        stage: stage,
        score: stats.score,
        moves: stats.movesLeft,
        chainPeak: stats.maxChain,
        clear: Boolean(clear),
        stars: stars,
        mission: mission,
        missionCleared: missionDone,
        missionText: missionProgressText(mission),
        starBonusText:
          stars >= 3
            ? "3つ星達成"
            : "3つ星条件: " + stage.starScore.toLocaleString("ja-JP") + "点以上、または残り" + stage.starMoves + "手以上",
      },
      detail || {}
    );
  }

  function merge(base, override) {
    var result = {};
    Object.keys(base || {}).forEach(function (key) {
      result[key] = base[key];
    });
    Object.keys(override || {}).forEach(function (key) {
      if (typeof override[key] !== "undefined") result[key] = override[key];
    });
    return result;
  }

  function readStars() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STAR_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function getStageStars(index) {
    var ratings = readStars();
    return Math.max(0, Math.min(3, Math.floor(Number(ratings[String(index)]) || 0)));
  }

  function saveStageStars(index, stars) {
    var ratings = readStars();
    var normalized = Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
    if (normalized <= getStageStars(index)) return;
    ratings[String(index)] = normalized;
    try {
      localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify(ratings));
    } catch (error) {
      // Ratings still work visually during this session if storage is unavailable.
    }
  }

  function ensureMissionStrip() {
    if (document.querySelector("#missionText")) return;
    var bottomPanel = document.querySelector(".bottom-panel");
    if (!bottomPanel) return;

    var strip = document.createElement("div");
    var label = document.createElement("span");
    var text = document.createElement("strong");
    strip.className = "mission-strip";
    strip.setAttribute("aria-label", "mission");
    label.textContent = "Mission";
    text.id = "missionText";
    strip.appendChild(label);
    strip.appendChild(text);
    bottomPanel.insertBefore(strip, bottomPanel.firstChild);
  }

  function updateMissionText() {
    var missionText = document.querySelector("#missionText");
    if (!missionText) return;
    var mission = currentStage().mission;
    missionText.textContent = missionProgressText(mission);
    missionText.classList.toggle("is-complete", missionCleared(mission));
  }

  function ensureResultFields() {
    if (!resultCopy) return;
    if (!document.querySelector("#resultStars")) {
      var stars = document.createElement("div");
      stars.id = "resultStars";
      stars.className = "result-stars";
      resultCopy.insertBefore(stars, document.querySelector("#resultText"));
    }
    if (!document.querySelector("#resultMission")) {
      var mission = document.createElement("p");
      mission.id = "resultMission";
      mission.className = "result-mission";
      resultCopy.appendChild(mission);
    }
    if (!document.querySelector("#resultBonus")) {
      var bonus = document.createElement("p");
      bonus.id = "resultBonus";
      bonus.className = "result-bonus";
      resultCopy.appendChild(bonus);
    }
  }

  function wrapGameHooks() {
    var originalStartGame = window.startGame || startGame;
    startGame = function () {
      stats = createStats();
      var result = originalStartGame.apply(this, arguments);
      syncStats();
      updateMissionText();
      return result;
    };

    var originalUpdateStats = updateStats;
    updateStats = function () {
      var result = originalUpdateStats.apply(this, arguments);
      syncStats();
      updateMissionText();
      return result;
    };

    var originalShowCombo = showCombo;
    showCombo = function (combo, points) {
      stats.maxChain = Math.max(stats.maxChain, Number(combo) || 0);
      updateMissionText();
      return originalShowCombo(combo, points);
    };

    var originalHandleCellPress = handleCellPress;
    handleCellPress = function (row, col) {
      try {
        var value = board[row] && board[row][col];
        var ids = window.CHAIN_DROP_LINE_CLEAR_IDS || {};
        if (!locked && !paused && !gameOver && value) {
          if (window.isChainDropBomb && window.isChainDropBomb(value)) stats.bombsUsed += 1;
          if ((window.isChainDropLineClear && window.isChainDropLineClear(value)) || value === ids.row || value === ids.col) {
            stats.lineClearsUsed += 1;
          }
        }
      } catch (error) {
        // Input still works even if tracking misses a tap.
      }
      return originalHandleCellPress(row, col);
    };

    var originalEndGame = endGame;
    endGame = function () {
      var result = originalEndGame.apply(this, arguments);
      if (gameShell && gameShell.dataset.flow === "result") {
        pendingResult = buildResult(false, { stageIndex: currentStageIndex() });
        window.setTimeout(decoratePendingResult, 0);
      }
      return result;
    };
  }

  function wrapFlowHooks() {
    stageApi.result = function (clear) {
      return buildResult(Boolean(clear));
    };
    stageApi.missionText = function () {
      return missionProgressText(currentStage().mission);
    };

    var originalStageClear = flowApi.stageClear;
    flowApi.stageClear = function (detail) {
      var enriched = buildResult(true, detail || {});
      pendingResult = enriched;
      var result = originalStageClear.call(flowApi, enriched);
      window.setTimeout(decoratePendingResult, 0);
      return result;
    };

    var originalStageFail = flowApi.stageFail;
    flowApi.stageFail = function (detail) {
      var enriched = buildResult(false, detail || {});
      pendingResult = enriched;
      var result = originalStageFail.call(flowApi, enriched);
      window.setTimeout(decoratePendingResult, 0);
      return result;
    };
  }

  function renderStars(container, stars, starClass) {
    if (!container) return;
    container.textContent = "";
    container.setAttribute("aria-label", stars + " stars");
    for (var i = 1; i <= 3; i += 1) {
      var star = document.createElement("span");
      star.className = starClass + (i <= stars ? " is-lit" : "");
      star.textContent = "★";
      if (starClass === "result-star") star.style.animationDelay = i * 120 + "ms";
      container.appendChild(star);
    }
  }

  function decoratePendingResult() {
    if (!pendingResult || !resultScreen || gameShell.dataset.flow !== "result") return;
    var detail = pendingResult;
    var clear = Boolean(detail.clear || detail.stars > 0);
    var resultStars = document.querySelector("#resultStars");
    var resultMission = document.querySelector("#resultMission");
    var resultBonus = document.querySelector("#resultBonus");

    resultScreen.classList.toggle("is-clear", clear);
    resultScreen.classList.toggle("is-fail", !clear);
    resultScreen.dataset.stars = String(detail.stars || 0);
    renderStars(resultStars, detail.stars || 0, "result-star");

    if (resultMission) {
      resultMission.textContent = detail.missionText
        ? (detail.missionCleared ? "Mission Clear: " : "Mission: ") + detail.missionText
        : "";
      resultMission.classList.toggle("is-complete", Boolean(detail.missionCleared));
    }
    if (resultBonus) resultBonus.textContent = clear && detail.starBonusText ? detail.starBonusText : "";

    if (clear) {
      saveStageStars(detail.stageIndex, detail.stars);
      playClearBurst(detail.stars || 1);
    }
  }

  function playClearBurst(stars) {
    if (!resultScreen) return;
    var oldBurst = resultScreen.querySelector(".result-burst");
    if (oldBurst) oldBurst.remove();

    var burst = document.createElement("div");
    var colors = ["#ffd65e", "#55c7ff", "#8ff0bd", "#ff6f91", "#fff6d0"];
    burst.className = "result-burst";
    for (var i = 0; i < 18; i += 1) {
      var piece = document.createElement("span");
      var angle = (Math.PI * 2 * i) / 18;
      var distance = 88 + (i % 5) * 18 + stars * 12;
      piece.style.setProperty("--burst-x", Math.cos(angle) * distance + "px");
      piece.style.setProperty("--burst-y", Math.sin(angle) * distance - 48 + "px");
      piece.style.setProperty("--burst-rotate", i * 31 + "deg");
      piece.style.setProperty("--burst-color", colors[i % colors.length]);
      piece.style.animationDelay = (i % 4) * 35 + "ms";
      burst.appendChild(piece);
    }
    resultScreen.appendChild(burst);
  }

  function setupMenuDecorators() {
    decorateStageMenu();
    if (gameShell && "MutationObserver" in window) {
      new MutationObserver(function () {
        window.setTimeout(function () {
          if (gameShell.dataset.flow === "menu") decorateStageMenu();
          if (gameShell.dataset.flow === "result") decoratePendingResult();
        }, 0);
      }).observe(gameShell, { attributes: true, attributeFilter: ["data-flow"] });
    }
    if (stageSelect) {
      stageSelect.addEventListener(
        "click",
        function (event) {
          var button = event.target && event.target.closest ? event.target.closest(".map-stage-node, .stage-card, .stage-choice") : null;
          if (!button || button.disabled || !flowApi || typeof flowApi.beginStage !== "function") return;
          var buttons = Array.prototype.slice.call(stageSelect.querySelectorAll(".map-stage-node, .stage-card, .stage-choice"));
          var index = buttons.indexOf(button);
          if (index < 0) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          flowApi.beginStage(index);
        },
        true
      );
    }
  }

  function decorateStageMenu() {
    if (!stageSelect) return;
    var nodes = stageSelect.querySelectorAll(".map-stage-node, .stage-card");
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].querySelector(".map-stage-stars")) continue;
      var stars = getStageStars(i);
      var meter = document.createElement("span");
      meter.className = "map-stage-stars";
      renderStars(meter, stars, "map-stage-star");
      nodes[i].appendChild(meter);
      if (stars > 0) nodes[i].classList.add("is-cleared");
    }
  }

  function setupDramaVoiceFallback() {
    if (window.ChainDropAudio && typeof window.ChainDropAudio.playVoice === "function") return;

    var context = null;
    var buffers = {};
    var loading = {};
    var lastVoiceKey = "";

    function getContext() {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!context) context = new AudioCtor();
      if (context.state === "suspended") {
        var resume = context.resume();
        if (resume && resume.catch) resume.catch(function () {});
      }
      return context;
    }

    function resolveVoice(src, basePath) {
      var value = String(src || "").trim();
      if (!value) return "";
      if (/^(https?:|data:|blob:|\/|assets\/)/.test(value)) return value;
      return String(basePath || "assets/voices/drama/") + value;
    }

    function playVoice(entry, basePath) {
      var voice = typeof entry === "string" ? { src: entry } : entry || {};
      var src = resolveVoice(voice.src || voice.file || voice.path || "", voice.basePath || basePath);
      if (!src || !window.fetch) return;

      var audioContext = getContext();
      if (!audioContext) return;

      function play(buffer) {
        var source = audioContext.createBufferSource();
        var gain = audioContext.createGain();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(Number(voice.playbackRate) || 1, audioContext.currentTime);
        gain.gain.setValueAtTime(Math.max(0, Math.min(1, Number(voice.volume) || 0.9)), audioContext.currentTime);
        source.connect(gain);
        gain.connect(audioContext.destination);
        source.start(audioContext.currentTime + (Number(voice.delay) || 0));
      }

      if (buffers[src]) {
        play(buffers[src]);
        return;
      }

      if (!loading[src]) {
        loading[src] = fetch(src)
          .then(function (response) {
            if (!response.ok) throw new Error("Drama voice not found");
            return response.arrayBuffer();
          })
          .then(function (data) {
            return audioContext.decodeAudioData(data);
          })
          .then(function (buffer) {
            buffers[src] = buffer;
            return buffer;
          })
          .catch(function () {
            return null;
          });
      }

      loading[src].then(function (buffer) {
        if (buffer) play(buffer);
      });
    }

    function findVoice(speaker, message) {
      var config = window.CHAIN_DROP_DRAMAS || {};
      var stages = config.stages || {};
      var basePath = config.voiceBasePath || "assets/voices/drama/";
      var found = null;

      Object.keys(stages).some(function (stageKey) {
        var stage = stages[stageKey] || {};
        return ["before", "clear"].some(function (type) {
          var scene = stage[type];
          var lines = Array.isArray(scene) ? scene : scene && Array.isArray(scene.lines) ? scene.lines : [];
          return lines.some(function (line) {
            if (!line || !line.voice) return false;
            var character = config.characters && config.characters[line.speaker];
            var displayName = character && character.name ? String(character.name) : String(line.speaker || "");
            if (
              (String(line.speaker || "") === speaker || displayName === speaker) &&
              String(line.text || line.message || "") === message
            ) {
              found = { entry: line.voice, basePath: scene.voiceBasePath || basePath };
              return true;
            }
            return false;
          });
        });
      });

      return found;
    }

    function checkDramaLine() {
      var speakerEl = document.querySelector("#dramaSpeaker");
      var messageEl = document.querySelector("#dramaMessage");
      if (!speakerEl || !messageEl || !messageEl.textContent) return;

      var key = speakerEl.textContent + "\n" + messageEl.textContent;
      if (key === lastVoiceKey) return;
      lastVoiceKey = key;

      var voice = findVoice(speakerEl.textContent, messageEl.textContent);
      if (voice) playVoice(voice.entry, voice.basePath);
    }

    ["pointerdown", "touchstart", "keydown"].forEach(function (eventName) {
      window.addEventListener(eventName, getContext, { once: true, passive: true });
    });

    if ("MutationObserver" in window) {
      new MutationObserver(checkDramaLine).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }
})();
