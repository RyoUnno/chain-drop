// Swap sidekick art here.
// Put PNG, WebP, SVG, or JPEG expression files in assets/characters/.
// Change expressions to your file names, then map each game state to an expression.
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
