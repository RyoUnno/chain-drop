// ドラマ用のキャラと台詞をここで差し替えます。
// 立ち絵は assets/characters/ に置くと、ファイル名だけで指定できます。
(function () {
  var basePath = "assets/characters/";

  function asset(src) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:|\/|assets\/)/.test(value)) return value;
    return basePath + value;
  }

  window.CHAIN_DROP_DRAMAS = {
    basePath: basePath,
    characters: {
      mimi: {
        name: "Mimi",
        image: asset("idle.svg"),
      },
      pico: {
        name: "Pico",
        image: asset("cheer.svg"),
      },
      sora: {
        name: "Sora",
        image: asset("wow.svg"),
      },
      rina: {
        name: "Rina",
        image: asset("worry.svg"),
      },
    },
    stages: {
      1: {
        before: {
          cast: ["mimi", "pico"],
          lines: [
            { speaker: "mimi", text: "ここから始めよう。まずは色をつなげて消してみて！" },
            { speaker: "pico", text: "ステージ1、いってみよう！" },
          ],
        },
        clear: {
          cast: ["pico", "sora"],
          lines: [
            { speaker: "pico", text: "いい感じ！ 次のステージが開いたよ。" },
            { speaker: "sora", text: "連鎖のコツ、つかめてきたかも！" },
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
