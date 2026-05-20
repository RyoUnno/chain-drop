# キャラ素材

このフォルダには、右下ではなく画面左側に表示するキャラクターの表情差分を置きます。

設定はリポジトリ直下の `character-assets.js` で行います。

例:

```js
var expressions = {
  idle: "my-idle.png",
  cheer: "my-cheer.png",
  wow: "my-wow.png",
  worry: "my-worry.png",
  sleep: "my-sleep.png",
};
```

想定している表情:

- `idle`: 通常
- `cheer`: クリア、コンボ
- `wow`: 大きいコンボ、シャッフル、ベスト更新
- `worry`: 残り手数が少ない、ゲーム終了
- `sleep`: 一時停止

推奨:

- 透明PNG、WebP、SVG
- 縦長の立ち絵も可
- 全身が入った素材は下寄せで表示されます
- スマホ向けにファイルサイズは小さめ
