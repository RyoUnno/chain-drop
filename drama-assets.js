// ドラマ用のキャラと台詞をここで差し替えます。
// 立ち絵は assets/characters/ に置くと、ファイル名だけで指定できます。
// 背景は assets/drama/ に置くと、ファイル名だけで指定できます。
// ボイスは assets/voices/drama/ に置くと、ファイル名だけで指定できます。
(function () {
  var characterBasePath = "assets/characters/";
  var backgroundBasePath = "assets/drama/";
  var voiceBasePath = "assets/voices/drama/";

  function characterAsset(src) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:|\/|assets\/)/.test(value)) return value;
    return characterBasePath + value;
  }

  function backgroundAsset(src) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:|\/|assets\/)/.test(value)) return value;
    return backgroundBasePath + value;
  }

  window.CHAIN_DROP_DRAMAS = {
    basePath: characterBasePath,
    backgroundBasePath: backgroundBasePath,
    voiceBasePath: voiceBasePath,
    defaultBackground: "field",
    backgrounds: {
      field: backgroundAsset("default-background.svg"),
    },
    characters: {
      mimi: {
        name: "Mimi",
        image: characterAsset("idle.jpg"),
      },
      pico: {
        name: "Pico",
        image: characterAsset("cheer.svg"),
      },
      sora: {
        name: "Sora",
        image: characterAsset("wow.svg"),
      },
      rina: {
        name: "Rina",
        image: characterAsset("worry.svg"),
      },
    },
    stages: {
      1: {
        before: {
          background: "field",
          cast: ["mimi", "pico"],
          lines: [
            { speaker: "mimi", text: "ここから始めよう。まずは色をつなげて消してみて！", voice: "" },
            { speaker: "pico", text: "ステージ1、いってみよう！", voice: "" },
          ],
        },
        clear: {
          background: "field",
          cast: ["pico", "sora"],
          lines: [
            { speaker: "pico", text: "いい感じ！ 次のステージが開いたよ。", voice: "" },
            { speaker: "sora", text: "連鎖のコツ、つかめてきたかも！", voice: "" },
          ],
        },
      },
      2: {
        before: [
          { speaker: "mimi", text: "盤面の形が少し変わるよ。落ち方をよく見てね。" },
        ],
        clear: [
          { speaker: "pico", text: "クリア！ だんだん道がつながってきたね。" },
        ],
      },
      3: {
        before: [
          { speaker: "mimi", text: "穴のある盤面では、横に回り込む連鎖も狙えるよ。" },
        ],
        clear: [
          { speaker: "sora", text: "すごい連鎖！ この調子で先へ進もう。" },
        ],
      },
      4: {
        before: [
          { speaker: "rina", text: "手数に気をつけて。大きく消せる場所を探そう。" },
        ],
        clear: [
          { speaker: "pico", text: "落ち着いてクリアできたね！ ラストまであと少し。" },
        ],
      },
      5: {
        before: [
          { speaker: "sora", text: "最後のステージ！ ここまで来た力を見せて。" },
        ],
        clear: [
          { speaker: "pico", text: "全ステージクリア！ 最高のプレイだったよ。" },
        ],
      },
    },
  };
})();
