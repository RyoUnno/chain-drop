# Chain Drop

スマホで短時間遊べる、連鎖型のパズルゲームです。盤面のブロックを1つ消すと、上のブロックが落ちて、同じ種類がつながったグループが消えます。連鎖が続くほどスコアが伸びます。

## ローカルで遊ぶ

`index.html` をブラウザで開くか、このフォルダを任意の静的Webサーバーで配信してください。

## ブロック素材を差し替える

`assets/blocks/` に画像を置き、`block-assets.js` の `image` を変更します。

使える形式:

- PNG
- WebP
- SVG
- JPEG

透明PNG、WebP、SVGだと盤面になじみやすいです。

## キャラ素材を差し替える

`assets/characters/` に表情差分を置き、`character-assets.js` の `expressions` を変更します。

現在の想定表情:

- `idle`: 通常
- `cheer`: クリア、コンボ
- `wow`: 大きいコンボ、シャッフル、ベスト更新
- `worry`: 残り手数が少ない、ゲーム終了
- `sleep`: 一時停止

`states` では、ゲーム状態ごとにどの表情を使うかを割り当てます。縦長で頭身のある立ち絵も使えるように、画面左側に大きく `object-fit: contain` で表示します。

## 効果音を差し替える

`assets/sounds/` に短い音声ファイルを置き、`audio-assets.js` の `sfx` を変更します。

主な効果音:

- `tap`: ブロックを選んだ音
- `drop`: ブロックが落ちる音
- `clearBlocks`: ブロックが消える音
- `shuffle`: シャッフル音
- `finish`: ゲーム終了音
- `newBest`: ベスト更新音
- `soundOn`: 音をオンにした音

`src` が空の効果音は、内蔵の軽い合成音を使います。

## コンボボイスを差し替える

`assets/voices/` にボイスファイルを置き、`audio-assets.js` の `voices.combos` を変更します。

1コンボから8コンボまで、それぞれ最大3種類のボイスを設定できます。ゲーム中は設定済みの候補からランダムで1つ再生します。9コンボ以上は8コンボ用の設定を使います。

例:

```js
voices: {
  combos: {
    1: [
      { src: "combo-1-a.mp3", volume: 0.9 },
      { src: "combo-1-b.mp3", volume: 0.9 },
      { src: "combo-1-c.mp3", volume: 0.9 },
    ],
  },
},
```

効果音とボイスは別管理です。ブロックが消える音は `sfx.clearBlocks`、コンボボイスは `voices.combos` に設定してください。

## GitHub Pages

GitHub Pages では、`main` ブランチのリポジトリルートを公開元にしてください。
