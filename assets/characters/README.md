# Character Assets

Put custom sidekick expression images in this folder, then point to them from
`character-assets.js`.

Example:

```js
var expressions = {
  idle: "my-idle.png",
  cheer: "my-cheer.png",
  wow: "my-wow.png",
  worry: "my-worry.png",
  sleep: "my-sleep.png",
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

Recommended expression set:

- `idle`
- `cheer`
- `wow`
- `worry`
- `sleep`

Recommended image format:

- Transparent PNG, WebP, or SVG
- Square-ish images work best
- Keep each file small for mobile loading
