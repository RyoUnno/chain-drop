# Chain Drop

スマホで短時間遊べる、連鎖型のパズルゲームです。盤面のブロックを1つ消すと、上のブロックが落ちて、同じ種類がつながったグループが消えます。連鎖が続くほどスコアが伸びます。

## 追加ギミック

縦に5個以上まっすぐつながったグループを消すと、消えた場所に縦ラインブロックが1つ残ります。
縦ラインブロックをタップすると、その列のブロックを一気に消せます。

横に5個以上まっすぐつながったグループを消すと、消えた場所に横ラインブロックが1つ残ります。
横ラインブロックをタップすると、その行のブロックを一気に消せます。

直線ではない5個以上のグループを消すと、消えた場所にボムが1つ残ります。
ボムをタップすると周囲3x3のブロックをまとめて消せます。近くに別のボムがある場合は連鎖爆発します。

## ステージ制

ステージごとに目標スコア、手数、盤面の形が変わります。
目標スコアに届くと次のステージへ進み、最後のステージをクリアすると `All Clear` になります。

ゲームは `タイトル -> ステージセレクト -> パズル -> クリア/失敗 -> ステージセレクト` の流れで進みます。
最初はステージ1だけ遊べます。ステージをクリアすると次のステージが解放され、解放状況はブラウザに保存されます。

各ステージにはミッションがあります。クリア結果は3つ星で評価され、ステージセレクトにも最高評価が保存表示されます。

- 1つ星: ステージクリア
- 2つ星: ステージクリア + ミッション達成
- 3つ星: 2つ星条件 + 高スコア、または残り手数条件を達成

ステージセレクト画面はマップ形式です。背景画像の差し替えやステージ位置の変更は `map-assets.js` で行います。

```js
window.CHAIN_DROP_STAGE_MAP = {
  basePath: "assets/maps/",
  background: "default-map.svg",
  aspectRatio: "1 / 1.18",
  markerImage: "",
  clearedMarkerImage: "",
  lockedMarkerImage: "",
  nodes: [
    { x: 18, y: 80 },
    { x: 38, y: 66 },
  ],
};
```

`background` と各 `*MarkerImage` には PNG、WebP、SVG、JPEG を使えます。`nodes` の `x` と `y` はマップ左上を基準にしたパーセント指定です。

ステージを変更したい場合は、`index.html` で `game.js` より前に `window.CHAIN_DROP_STAGES` を定義します。

例:

```js
window.CHAIN_DROP_STAGES = [
  {
    name: "Stage 1",
    target: 1200,
    moves: 24,
    mission: { type: "chain", value: 2, text: "2 Chain以上を出す" },
    starScoreMultiplier: 1.25,
    starMoves: 5,
    mask: [
      "111111",
      "111111",
      "111111",
      "111111",
      "111111",
      "111111",
      "111111",
      "111111",
      "111111",
    ],
  },
];
```

`mask` は9行x6列です。`1` が使えるマス、`0` が穴マスです。穴マスは盤面上で灰色の石ブロックとして表示されます。

`mission.type` には以下を指定できます。

- `chain`: 指定Chain以上を出す
- `line`: ラインブロックを指定回数使う
- `bomb`: ボムを指定回数使う
- `score`: 指定スコア以上を取る
- `moves`: 指定手数以上残してクリアする

3つ星の追加条件は `starScore`、`starScoreMultiplier`、`starMoves` で調整できます。

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
- `wow`: 大きいコンボ、ベスト更新
- `worry`: 残り手数が少ない、ゲーム終了
- `sleep`: 一時停止

`states` では、ゲーム状態ごとにどの表情を使うかを割り当てます。縦長で頭身のある立ち絵も使えるように、画面左側に大きく `object-fit: contain` で表示します。

## ドラマを差し替える

ステージ開始前とステージクリア後の会話は `drama-assets.js` で設定します。
立ち絵は `assets/characters/` に置き、`characters` に名前と画像を登録します。
背景は `assets/drama/` に置き、`backgrounds` に名前を登録します。

```js
window.CHAIN_DROP_DRAMAS = {
  basePath: "assets/characters/",
  backgroundBasePath: "assets/drama/",
  voiceBasePath: "assets/voices/drama/",
  defaultBackground: "field",
  backgrounds: {
    field: "default-background.svg",
    town: "town.png",
  },
  characters: {
    hero: { name: "ヒーロー", image: "hero.png" },
    rival: { name: "ライバル", image: "rival.png" },
  },
  stages: {
    1: {
      before: {
        background: "town",
        cast: ["hero", "rival"],
        lines: [
          { speaker: "hero", text: "ここが最初のステージだね。", voice: "stage1-hero-1.mp3" },
          { speaker: "rival", text: "油断しないでいこう。", voice: "stage1-rival-1.mp3" },
        ],
      },
      clear: [
        { speaker: "hero", text: "クリア！ 次へ進もう。", voice: "stage1-hero-clear.mp3" },
      ],
    },
  },
};
```

`stages` の数字はステージ番号です。`before` がステージ開始前、`clear` がクリア後に再生されます。
`cast` に表示したいキャラを並べ、各行の `speaker` に発言者のIDを指定します。発言していないキャラは自動で暗くグレーアウトします。
`background` には `backgrounds` に登録した名前か、画像ファイル名を直接指定できます。`background` を省略したシーンでは `defaultBackground` が使われます。
`voice` には `voiceBasePath` から見た音声ファイル名を指定できます。音声ごとに音量を変えたい場合は `{ src: "voice.mp3", volume: 0.85 }` の形でも書けます。

## 効果音を差し替える

`assets/sounds/` に短い音声ファイルを置き、`audio-assets.js` の `sfx` を変更します。

主な効果音:

- `tap`: ブロックを選んだ音
- `drop`: ブロックが落ちる音
- `clearBlocks`: ブロックが消える音
- `bomb`: ボムが爆発する音
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
