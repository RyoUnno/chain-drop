(function () {
  var gameShell = document.querySelector(".game-shell");
  var dramaScreen = document.querySelector("#dramaScreen");
  var dramaBackdrop = document.querySelector("#dramaBackdrop");
  var dramaCast = document.querySelector("#dramaCast");
  var dramaSpeaker = document.querySelector("#dramaSpeaker");
  var dramaMessage = document.querySelector("#dramaMessage");
  var dramaNextButton = document.querySelector("#dramaNextButton");
  var flowApi = window.ChainDropFlow;
  var stageApi = window.ChainDropStages;

  if (!gameShell || !dramaScreen || !dramaCast || !dramaSpeaker || !dramaMessage || !dramaNextButton || !flowApi) {
    return;
  }

  var config = normalizeConfig(window.CHAIN_DROP_DRAMAS);
  var originalBeginStage = flowApi.beginStage;
  var originalStageClear = flowApi.stageClear;
  var activeScene = null;

  function normalizeConfig(source) {
    var custom = source && typeof source === "object" ? source : {};
    var basePath = String(custom.basePath || "assets/characters/");
    var backgroundBasePath = String(custom.backgroundBasePath || "assets/drama/");
    var characters = {};
    var backgrounds = {};
    var defaultBackgroundRef = String(custom.defaultBackground || custom.background || "");
    var rawCharacters = custom.characters && typeof custom.characters === "object" ? custom.characters : {};
    var rawBackgrounds = custom.backgrounds && typeof custom.backgrounds === "object" ? custom.backgrounds : {};

    Object.keys(rawCharacters).forEach(function (id) {
      var character = rawCharacters[id] || {};
      characters[id] = {
        id: id,
        name: String(character.name || id),
        image: resolveAsset(character.image || character.src || "", basePath),
      };
    });

    Object.keys(rawBackgrounds).forEach(function (id) {
      backgrounds[id] = resolveAsset(rawBackgrounds[id], backgroundBasePath);
    });

    if (!Object.keys(characters).length && window.CHAIN_DROP_CHARACTER) {
      var fallback = window.CHAIN_DROP_CHARACTER.states && window.CHAIN_DROP_CHARACTER.states.idle;
      characters.sidekick = {
        id: "sidekick",
        name: window.CHAIN_DROP_CHARACTER.name || "Character",
        image: fallback && fallback.image ? fallback.image : "",
      };
    }

    return {
      basePath: basePath,
      backgroundBasePath: backgroundBasePath,
      characters: characters,
      backgrounds: backgrounds,
      defaultBackground: backgrounds[defaultBackgroundRef] || resolveAsset(defaultBackgroundRef, backgroundBasePath),
      stages: custom.stages && typeof custom.stages === "object" ? custom.stages : {},
      defaults: custom.defaults && typeof custom.defaults === "object" ? custom.defaults : {},
    };
  }

  function resolveAsset(src, basePath) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:|\/|assets\/)/.test(value)) return value;
    return String(basePath || "") + value;
  }

  function resolveDramaBackground(src) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (config.backgrounds[value]) return config.backgrounds[value];
    return resolveAsset(value, config.backgroundBasePath);
  }

  function getStageScene(stageIndex, type) {
    var key = String(Number(stageIndex) + 1);
    var stageConfig = config.stages[key] || config.stages[stageIndex] || {};
    return buildScene(stageConfig[type] || config.defaults[type], stageIndex, type);
  }

  function buildScene(rawScene, stageIndex, type) {
    if (!rawScene) return null;

    var sceneCast = [];
    var lines = [];
    var sceneBackground = "";

    if (Array.isArray(rawScene)) {
      lines = rawScene;
    } else if (rawScene && typeof rawScene === "object") {
      sceneCast = Array.isArray(rawScene.cast) ? rawScene.cast.slice() : [];
      lines = Array.isArray(rawScene.lines) ? rawScene.lines : Array.isArray(rawScene.steps) ? rawScene.steps : [];
      sceneBackground = String(rawScene.background || rawScene.backdrop || "");
    }

    var normalizedLines = lines
      .map(function (line) {
        if (!line || typeof line !== "object") return null;
        var speaker = String(line.speaker || "").trim();
        var cast = Array.isArray(line.cast) ? line.cast.slice() : sceneCast.slice();
        return {
          speaker: speaker,
          text: String(line.text || line.message || ""),
          cast: cast.map(String),
          background: String(line.background || line.backdrop || ""),
        };
      })
      .filter(function (line) {
        return line && line.text;
      });

    if (!normalizedLines.length) return null;

    var sceneWideCast = unique(
      sceneCast.concat(
        normalizedLines
          .map(function (line) {
            return line.speaker;
          })
          .filter(Boolean)
      )
    );

    if (!sceneWideCast.length) {
      sceneWideCast = Object.keys(config.characters).slice(0, 1);
    }

    normalizedLines.forEach(function (line) {
      if (!line.cast.length) line.cast = sceneWideCast.slice();
    });

    return {
      stageIndex: stageIndex,
      type: type,
      background: resolveDramaBackground(sceneBackground) || config.defaultBackground,
      cast: sceneWideCast,
      lines: normalizedLines,
    };
  }

  function unique(values) {
    var result = [];
    values.forEach(function (value) {
      var id = String(value || "").trim();
      if (id && result.indexOf(id) === -1) result.push(id);
    });
    return result;
  }

  function playScene(scene, onDone) {
    if (!scene || !scene.lines.length) return false;
    activeScene = {
      scene: scene,
      index: 0,
      onDone: typeof onDone === "function" ? onDone : function () {},
    };

    dramaScreen.hidden = false;
    document.body.classList.add("is-drama-open");
    gameShell.dataset.flow = "drama";
    applySceneBackground(scene.lines[0].background || scene.background);

    try {
      locked = true;
      if (typeof setState === "function") setState("Drama");
    } catch (error) {
      // The visual drama screen is enough if game bindings are unavailable.
    }

    renderSceneLine();
    return true;
  }

  function finishScene() {
    if (!activeScene) return;
    var done = activeScene.onDone;
    activeScene = null;
    dramaScreen.hidden = true;
    dramaCast.textContent = "";
    dramaSpeaker.textContent = "";
    dramaMessage.textContent = "";
    clearSceneBackground();
    document.body.classList.remove("is-drama-open");
    done();
  }

  function advanceScene() {
    if (!activeScene) return;
    activeScene.index += 1;
    if (activeScene.index >= activeScene.scene.lines.length) {
      finishScene();
      return;
    }
    renderSceneLine();
  }

  function renderSceneLine() {
    if (!activeScene) return;
    var line = activeScene.scene.lines[activeScene.index];
    var castIds = line.cast && line.cast.length ? line.cast : activeScene.scene.cast;
    var speaker = getCharacter(line.speaker);
    applySceneBackground(line.background || activeScene.scene.background);

    dramaCast.textContent = "";
    castIds.forEach(function (id) {
      dramaCast.appendChild(createCharacterNode(id, line.speaker));
    });

    dramaSpeaker.textContent = speaker.name || line.speaker || "Story";
    dramaMessage.textContent = line.text;
    dramaNextButton.textContent = activeScene.index >= activeScene.scene.lines.length - 1 ? "OK" : "Next";
  }

  function getCharacter(id) {
    return config.characters[id] || { id: id, name: id || "Story", image: "" };
  }

  function applySceneBackground(src) {
    var background = resolveDramaBackground(src);
    if (!dramaBackdrop) return;
    dramaBackdrop.style.backgroundImage = background ? "url(\"" + background.replace(/"/g, "%22") + "\")" : "";
    dramaScreen.classList.toggle("has-drama-background", Boolean(background));
  }

  function clearSceneBackground() {
    if (!dramaBackdrop) return;
    dramaBackdrop.style.backgroundImage = "";
    dramaScreen.classList.remove("has-drama-background");
  }

  function createCharacterNode(id, speakerId) {
    var character = getCharacter(id);
    var figure = document.createElement("figure");
    var isSpeaking = id && id === speakerId;

    figure.className = "drama-character";
    if (speakerId && !isSpeaking) figure.classList.add("is-muted");
    if (isSpeaking) figure.classList.add("is-speaking");

    if (character.image) {
      var image = document.createElement("img");
      image.src = character.image;
      image.alt = "";
      image.decoding = "async";
      figure.appendChild(image);
    } else {
      var placeholder = document.createElement("span");
      placeholder.className = "drama-character-placeholder";
      placeholder.textContent = character.name.slice(0, 1).toUpperCase();
      figure.appendChild(placeholder);
    }

    var label = document.createElement("figcaption");
    label.textContent = character.name;
    figure.appendChild(label);
    return figure;
  }

  if (typeof originalBeginStage === "function") {
    flowApi.beginStage = function (stageIndex, options) {
      var nextIndex = typeof stageIndex === "number" ? stageIndex : stageApi && typeof stageApi.current === "function" ? stageApi.current() : 0;
      if (options && options.skipDrama) return originalBeginStage(nextIndex);

      var beforeScene = getStageScene(nextIndex, "before");
      if (
        beforeScene &&
        playScene(beforeScene, function () {
          originalBeginStage(nextIndex);
        })
      ) {
        return true;
      }

      return originalBeginStage(nextIndex);
    };
  }

  if (typeof originalStageClear === "function") {
    flowApi.stageClear = function (detail) {
      var clearDetail = detail || {};
      var nextIndex = typeof clearDetail.stageIndex === "number" ? clearDetail.stageIndex : stageApi && typeof stageApi.current === "function" ? stageApi.current() : 0;
      var clearScene = getStageScene(nextIndex, "clear");

      if (
        clearScene &&
        playScene(clearScene, function () {
          originalStageClear(clearDetail);
        })
      ) {
        return true;
      }

      return originalStageClear(clearDetail);
    };
  }

  dramaNextButton.addEventListener("click", advanceScene);
  dramaScreen.addEventListener("click", function (event) {
    if (event.target && event.target.closest && event.target.closest("button")) return;
    advanceScene();
  });
  document.addEventListener("keydown", function (event) {
    if (!activeScene) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    advanceScene();
  });

  window.ChainDropDrama = {
    play: function (stageIndex, type, onDone) {
      return playScene(getStageScene(stageIndex, type), onDone);
    },
    config: config,
  };
})();
