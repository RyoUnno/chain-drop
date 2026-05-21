# ドラマ背景素材

ドラマ画面の背景画像を置くフォルダです。

`drama-assets.js` の `backgrounds` に名前を登録して、各シーンの `background` にその名前を指定します。

```js
backgrounds: {
  field: "default-background.svg",
  town: "town.png",
},
stages: {
  1: {
    before: {
      background: "town",
      lines: [{ speaker: "hero", text: "街から出発しよう。" }],
    },
  },
},
```

PNG、WebP、SVG、JPEG が使えます。横長の画像にしておくとスマホでも収まりやすいです。
