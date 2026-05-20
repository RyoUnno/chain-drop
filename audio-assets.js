// Swap sound effect files here.
// Put short mp3, m4a, ogg, or wav files in assets/sounds/ and set src to the file name.
// Leave src blank to use the built-in synthesized sound for that event.
window.CHAIN_DROP_SOUNDS = {
  enabled: true,
  fallback: "synth",
  masterVolume: 1,
  basePath: "assets/sounds/",
  events: {
    tap: {
      src: "",
      volume: 0.45,
    },
    drop: {
      src: "",
      volume: 0.55,
    },
    clear: {
      src: "",
      volume: 0.75,
    },
    combo: {
      src: "",
      volume: 0.8,
    },
    bigCombo: {
      src: "",
      volume: 0.85,
    },
    shuffle: {
      src: "",
      volume: 0.7,
    },
    finish: {
      src: "",
      volume: 0.65,
    },
    newBest: {
      src: "",
      volume: 0.8,
    },
    soundOn: {
      src: "",
      volume: 0.5,
    },
  },
};
