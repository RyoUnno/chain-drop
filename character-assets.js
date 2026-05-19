// Swap sidekick art here. Each state can use any PNG, WebP, SVG, or JPEG.
// Leave a state image blank to reuse the default built-in mascot for that state.
window.CHAIN_DROP_CHARACTER = {
  enabled: true,
  name: "Mimi",
  states: {
    idle: {
      image: "assets/characters/idle.svg",
      line: "Ready!",
    },
    drop: {
      image: "assets/characters/idle.svg",
      line: "Drop!",
    },
    clear: {
      image: "assets/characters/cheer.svg",
      line: "Nice!",
    },
    combo: {
      image: "assets/characters/cheer.svg",
      line: "Chain!",
    },
    bigCombo: {
      image: "assets/characters/wow.svg",
      line: "Huge!",
    },
    lowMoves: {
      image: "assets/characters/worry.svg",
      line: "Careful!",
    },
    shuffle: {
      image: "assets/characters/wow.svg",
      line: "Shuffle!",
    },
    paused: {
      image: "assets/characters/sleep.svg",
      line: "Pause",
    },
    finish: {
      image: "assets/characters/worry.svg",
      line: "Again?",
    },
    newBest: {
      image: "assets/characters/wow.svg",
      line: "Best!",
    },
  },
};
