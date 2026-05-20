// キャラ素材の差し替え設定です。
// assets/characters/ に PNG, WebP, SVG, JPEG の表情差分を置いてください。
// 縦長の立ち絵もそのまま入れられます。画面左側で object-fit: contain により全身が収まります。
(function () {
  var basePath = "assets/characters/";
  var expressions = {
    idle: "idle.svg",
    cheer: "cheer.svg",
    wow: "wow.svg",
    worry: "worry.svg",
    sleep: "sleep.svg",
  };

  function expressionImage(expressionName) {
    var src = expressions[expressionName] || "";
    if (!src) return "";
    if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
    return basePath + src;
  }

  function state(expression, line) {
    return {
      expression: expression,
      image: expressionImage(expression),
      line: line,
    };
  }

  window.CHAIN_DROP_CHARACTER = {
    enabled: true,
    name: "Mimi",
    basePath: basePath,
    expressions: expressions,
    states: {
      idle: state("idle", "Ready!"),
      drop: state("idle", "Drop!"),
      clear: state("cheer", "Nice!"),
      combo: state("cheer", "Chain!"),
      bigCombo: state("wow", "Huge!"),
      lowMoves: state("worry", "Careful!"),
      shuffle: state("wow", "Shuffle!"),
      paused: state("sleep", "Pause"),
      finish: state("worry", "Again?"),
      newBest: state("wow", "Best!"),
    },
  };
})();
