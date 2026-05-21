# 効果音素材

このフォルダには、ブロックが消える音やシャッフル音などの効果音を置きます。

設定はリポジトリ直下の `audio-assets.js` の `sfx` で行います。

例:

```js
sfx: {
  clearBlocks: {
    src: "clear-blocks.mp3",
    volume: 0.75,
  },
}
```

対応している主な効果音:

- `tap`
- `drop`
- `clearBlocks`
- `bomb`
- `shuffle`
- `finish`
- `newBest`
- `soundOn`

推奨:

- MP3 または M4A
- 1秒未満の短い音
- スマホ向けに小さめのファイルサイズ

コンボボイスはこのフォルダではなく `assets/voices/` に置いてください。
