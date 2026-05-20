# コンボボイス素材

このフォルダには、コンボごとのキャラクターボイスを置きます。

設定はリポジトリ直下の `audio-assets.js` の `voices.combos` で行います。

1コンボから8コンボまで、それぞれ最大3種類のボイスを設定できます。ゲーム中は設定済みの候補からランダムで1つ再生します。

例:

```js
voices: {
  combos: {
    1: [
      { src: "combo-1-a.mp3", volume: 0.9 },
      { src: "combo-1-b.mp3", volume: 0.9 },
      { src: "combo-1-c.mp3", volume: 0.9 },
    ],
    2: [
      { src: "combo-2-a.mp3", volume: 0.9 },
      { src: "combo-2-b.mp3", volume: 0.9 },
      { src: "combo-2-c.mp3", volume: 0.9 },
    ],
  },
},
```

推奨:

- MP3 または M4A
- 1秒前後までの短いボイス
- 音量差が大きすぎないように調整済みの素材

ブロックが消える音などの効果音は `assets/sounds/` に置いてください。
