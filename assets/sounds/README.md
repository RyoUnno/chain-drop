# Sound Assets

Put short sound effect files in this folder, then point to them from `audio-assets.js`.

Example:

```js
window.CHAIN_DROP_SOUNDS = {
  basePath: "assets/sounds/",
  events: {
    tap: {
      src: "tap.mp3",
      volume: 0.45,
    },
    clear: {
      src: "clear.mp3",
      volume: 0.75,
    },
  },
};
```

Supported events:

- `tap`
- `drop`
- `clear`
- `combo`
- `bigCombo`
- `shuffle`
- `finish`
- `newBest`
- `soundOn`

Recommended file format:

- MP3 or M4A for broad mobile support
- OGG or WAV also works in many browsers
- Keep each effect short, ideally under 1 second
- Keep each file small for mobile loading
