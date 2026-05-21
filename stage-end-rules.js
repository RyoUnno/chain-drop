(function () {
  var flowApi = window.ChainDropFlow;
  var stageApi = window.ChainDropStages;
  var resultText = document.querySelector("#resultText");
  var resultMission = document.querySelector("#resultMission");
  var resultBonus = document.querySelector("#resultBonus");
  var comboBadge = document.querySelector("#comboBadge");

  if (!flowApi || !stageApi || !Array.isArray(stageApi.stages)) return;

  function currentStageIndex() {
    return typeof stageApi.current === "function" ? stageApi.current() : 0;
  }

  function currentStage() {
    return stageApi.stages[currentStageIndex()] || {};
  }

  function safeNumber(value, fallback) {
    var number = Number(value);
    return isFinite(number) ? number : fallback;
  }

  function currentScore() {
    try {
      return safeNumber(score, 0);
    } catch (error) {
      return 0;
    }
  }

  function currentMoves() {
    try {
      return safeNumber(moves, 0);
    } catch (error) {
      return 0;
    }
  }

  function scoreCleared(stage, scoreValue) {
    return scoreValue >= safeNumber(stage.target, 0);
  }

  function buildScoreFailureText(stage, scoreValue) {
    return (
      "スコア未達: " +
      scoreValue.toLocaleString("ja-JP") +
      "/" +
      safeNumber(stage.target, 0).toLocaleString("ja-JP") +
      "点"
    );
  }

  function buildMissionFailureText(detail) {
    return "ミッション未達: " + (detail.missionText || (detail.mission && detail.mission.text) || "未達成");
  }

  function enrichDetail(detail, forceClear) {
    var stage = currentStage();
    var scoreValue = currentScore();
    var base = {};

    if (stageApi && typeof stageApi.result === "function") {
      base = stageApi.result(false) || {};
    }

    Object.keys(detail || {}).forEach(function (key) {
      if (typeof detail[key] !== "undefined") base[key] = detail[key];
    });

    var scoreDone =
      typeof base.scoreCleared !== "undefined" ? Boolean(base.scoreCleared) : scoreCleared(stage, scoreValue);
    var missionDone = Boolean(base.missionCleared);
    var clear = typeof forceClear === "boolean" ? forceClear : scoreDone && missionDone;
    var failureReasons = [];

    base.stageIndex = typeof base.stageIndex !== "undefined" ? base.stageIndex : currentStageIndex();
    base.stage = base.stage || stage;
    base.score = typeof base.score !== "undefined" ? base.score : scoreValue;
    base.moves = typeof base.moves !== "undefined" ? base.moves : currentMoves();
    base.scoreCleared = scoreDone;
    base.clear = clear;

    if (!scoreDone) {
      base.scoreFailureText = base.scoreFailureText || buildScoreFailureText(stage, scoreValue);
      failureReasons.push({ type: "score", text: base.scoreFailureText });
    }
    if (!missionDone) {
      base.missionFailureText = base.missionFailureText || buildMissionFailureText(base);
      failureReasons.push({ type: "mission", text: base.missionFailureText });
    }

    base.failureReasons = base.failureReasons || failureReasons;
    base.failureSummary =
      base.failureSummary ||
      failureReasons
        .map(function (reason) {
          return reason.text;
        })
        .join(" / ");

    return base;
  }

  function restorePlayState() {
    try {
      gameOver = false;
      locked = false;
    } catch (error) {
      // Screen state restoration is best-effort for older builds.
    }
    if (comboBadge) comboBadge.classList.remove("show");
    if (typeof setState === "function") setState("Ready");
    if (typeof settleCharacterMood === "function") settleCharacterMood();
    if (typeof render === "function") render();
  }

  function decorateFailure(detail) {
    window.setTimeout(function () {
      if (detail.clear) return;
      if (resultText) resultText.textContent = detail.failureSummary || "条件未達: スコアとミッションを確認してね";
      if (resultMission) {
        resultMission.textContent =
          detail.missionFailureText ||
          (detail.missionCleared
            ? "Mission Clear: " + (detail.missionText || (detail.mission && detail.mission.text) || "")
            : "");
        resultMission.classList.toggle("is-complete", Boolean(detail.missionCleared));
      }
      if (resultBonus) resultBonus.textContent = detail.scoreFailureText || "";
    }, 0);
  }

  if (typeof flowApi.stageClear === "function") {
    var originalStageClear = flowApi.stageClear;
    flowApi.stageClear = function (detail) {
      var enriched = enrichDetail(detail);
      if (currentMoves() > 0) {
        restorePlayState();
        return true;
      }
      if (!enriched.clear && typeof flowApi.stageFail === "function") {
        var failed = flowApi.stageFail(enriched);
        decorateFailure(enriched);
        return failed;
      }
      return originalStageClear.call(flowApi, enrichDetail(detail, true));
    };
  }

  if (typeof flowApi.stageFail === "function") {
    var originalStageFail = flowApi.stageFail;
    flowApi.stageFail = function (detail) {
      var enriched = enrichDetail(detail, false);
      var result = originalStageFail.call(flowApi, enriched);
      decorateFailure(enriched);
      return result;
    };
  }

  if (typeof endGame === "function") {
    var originalEndGame = endGame;
    endGame = function () {
      var wasPlaying = typeof flowApi.mode === "function" ? flowApi.mode() === "play" : true;
      var detail = enrichDetail();
      var result = originalEndGame.apply(this, arguments);
      if (wasPlaying && typeof flowApi[detail.clear ? "stageClear" : "stageFail"] === "function") {
        flowApi[detail.clear ? "stageClear" : "stageFail"](detail);
      }
      return result;
    };
  }
})();
