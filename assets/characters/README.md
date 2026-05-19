# Character Assets

Put custom sidekick images in this folder, then point to them from `character-assets.js`.

Example:

```js
window.CHAIN_DROP_CHARACTER = {
  enabled: true,
  name: "Mimi",
  states: {
    idle: {
      image: "assets/characters/my-idle.png",
      line: "Ready!",
    },
    combo: {
      image: "assets/characters/my-combo.png",
      line: "Chain!",
    },
  },
};
```

Supported states:

- `idle`
- `drop`
- `clear`
- `combo`
- `bigCombo`
- `lowMoves`
- `shuffle`
- `paused`
- `finish`
- `newBest`

Recommended image format:

- Transparent PNG, WebP, or SVG
- Square-ish images work best
- Keep each file small for mobile loading
