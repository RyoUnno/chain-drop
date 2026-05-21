(function () {
  var STORAGE_KEY = "chain-drop-unlocked-stage";
  var gameShell = document.querySelector(".game-shell");
  var stageSelect = document.querySelector("#stageSelect");
  var stageApi = window.ChainDropStages;
  var flowApi = window.ChainDropFlow;
  var mapConfig = normalizeMapConfig(window.CHAIN_DROP_STAGE_MAP);

  if (!gameShell || !stageSelect || !stageApi || !Array.isArray(stageApi.stages)) return;

  function normalizeMapConfig(customMap) {
    var custom = customMap && typeof customMap === "object" ? customMap : {};
    var basePath = String(custom.basePath || "assets/maps/");
    var defaultNodes = [
      { x: 18, y: 80 },
      { x: 38, y: 66 },
      { x: 28, y: 45 },
      { x: 58, y: 34 },
      { x: 77, y: 18 },
    ];
    var nodes = Array.isArray(custom.nodes) && custom.nodes.length ? custom.nodes : defaultNodes;

    return {
      background: resolveMapAsset(custom.background || "", basePath),
      aspectRatio: String(custom.aspectRatio || "1 / 1.18").trim(),
      markerImage: resolveMapAsset(custom.markerImage || "", basePath),
      clearedMarkerImage: resolveMapAsset(custom.clearedMarkerImage || custom.markerImage || "", basePath),
      lockedMarkerImage: resolveMapAsset(custom.lockedMarkerImage || "", basePath),
      nodes: nodes.map(function (node, index) {
        var fallback = defaultNodes[index % defaultNodes.length];
        return {
          x: clampPercent(node && node.x, fallback.x),
          y: clampPercent(node && node.y, fallback.y),
        };
      }),
    };
  }

  function resolveMapAsset(src, basePath) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:|\/|assets\/)/.test(value)) return value;
    return String(basePath || "") + value;
  }

  function clampPercent(value, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.max(6, Math.min(94, number));
  }

  function readUnlockedStage() {
    try {
      return Math.max(0, Number(localStorage.getItem(STORAGE_KEY)) || 0);
    } catch (error) {
      return 0;
    }
  }

  function refreshMap() {
    if (gameShell.dataset.flow !== "menu" || stageSelect.querySelector(".stage-map")) return;

    var stages = stageApi.stages;
    var unlockedStage = Math.min(readUnlockedStage(), stages.length - 1);
    stageSelect.textContent = "";
    stageSelect.appendChild(createStageMap(stages, unlockedStage));
  }

  function createStageMap(stages, unlockedStage) {
    var map = document.createElement("div");
    map.className = "stage-map";
    map.style.aspectRatio = mapConfig.aspectRatio;

    if (mapConfig.background) {
      var image = document.createElement("img");
      image.className = "stage-map-image";
      image.src = mapConfig.background;
      image.alt = "";
      image.decoding = "async";
      map.appendChild(image);
    }

    map.appendChild(createRoadSvg(stages.length, false));
    map.appendChild(createRoadSvg(Math.min(unlockedStage + 1, stages.length), true));

    for (var i = 0; i < stages.length; i += 1) {
      map.appendChild(createStageNode(i, stages[i], i <= unlockedStage, i < unlockedStage));
    }

    return map;
  }

  function createRoadSvg(count, unlocked) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("class", unlocked ? "stage-road-svg stage-road-svg-unlocked" : "stage-road-svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", buildRoadPath(count));
    path.setAttribute("pathLength", "1");
    svg.appendChild(path);
    return svg;
  }

  function buildRoadPath(count) {
    var nodeCount = Math.max(0, Math.min(count, mapConfig.nodes.length));
    if (!nodeCount) return "";

    var commands = [];
    for (var i = 0; i < nodeCount; i += 1) {
      var node = mapConfig.nodes[i];
      commands.push((i === 0 ? "M " : "L ") + node.x + " " + node.y);
    }
    return commands.join(" ");
  }

  function createStageNode(index, stage, unlocked, cleared) {
    var node = mapConfig.nodes[index % mapConfig.nodes.length];
    var button = document.createElement("button");
    button.type = "button";
    button.className = "map-stage-node";
    if (cleared) button.classList.add("is-cleared");
    if (!unlocked) button.classList.add("is-locked");
    button.disabled = !unlocked;
    button.style.left = node.x + "%";
    button.style.top = node.y + "%";
    button.setAttribute("aria-label", stageLabel(index, stage, unlocked));

    var markerImage = markerImageFor(unlocked, cleared);
    if (markerImage) {
      var image = document.createElement("img");
      image.className = "map-marker-image";
      image.src = markerImage;
      image.alt = "";
      image.decoding = "async";
      button.appendChild(image);
    }

    var number = document.createElement("span");
    number.className = "map-stage-number";
    number.textContent = String(index + 1);

    var tag = document.createElement("span");
    tag.className = "map-stage-tag";
    tag.textContent = stage.name || "Stage " + (index + 1);

    button.appendChild(number);
    button.appendChild(tag);

    if (unlocked) {
      button.addEventListener("click", function () {
        if (flowApi && typeof flowApi.beginStage === "function") {
          flowApi.beginStage(index);
        }
      });
    }

    return button;
  }

  function markerImageFor(unlocked, cleared) {
    if (!unlocked && mapConfig.lockedMarkerImage) return mapConfig.lockedMarkerImage;
    if (cleared && mapConfig.clearedMarkerImage) return mapConfig.clearedMarkerImage;
    return mapConfig.markerImage;
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

  if ("MutationObserver" in window) {
    new MutationObserver(refreshMap).observe(gameShell, {
      attributes: true,
      attributeFilter: ["data-flow"],
    });
  }

  window.addEventListener("click", function () {
    window.setTimeout(refreshMap, 0);
  });
  refreshMap();
})();
