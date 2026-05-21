// 効果音とボイスの差し替え設定です。
// 効果音は assets/sounds/、コンボボイスは assets/voices/ に置いてください。
// src が空の効果音は、内蔵の軽い合成音にフォールバックします。
window.CHAIN_DROP_AUDIO = {
  enabled: true,
  fallback: "synth",
  masterVolume: 1,
  sfxBasePath: "assets/sounds/",
  voiceBasePath: "assets/voices/",
  sfx: {
    tap: {
      src: "",
      volume: 0.45,
    },
    drop: {
      src: "",
      volume: 0.55,
    },
    clearBlocks: {
      src: "",
      volume: 0.75,
    },
    bomb: {
      src: "",
      volume: 0.8,
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
  voices: {
    volume: 0.9,
    combos: {
      1: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
      2: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
      3: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
      4: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
      5: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
      6: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
      7: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
      8: [
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
        { src: "", volume: 0.9 },
      ],
    },
  },
};

// 古い名前を参照しているコードがあっても動くように残しています。
window.CHAIN_DROP_SOUNDS = window.CHAIN_DROP_AUDIO;
