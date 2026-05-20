# ブロック素材

このフォルダには、盤面に表示するブロック画像を置きます。

設定はリポジトリ直下の `block-assets.js` で行います。

例:

```js
{
  id: "red",
  label: "star",
  image: "assets/blocks/example-star.svg",
}
```

推奨:

- PNG、WebP、SVG、JPEG
- 正方形に近い画像
- 透明PNG、WebP、SVG
- スマホ向けに小さめのファイルサイズ
