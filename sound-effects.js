(function () {
  var STORAGE_KEY = "chain-drop-sound-muted";
  var soundButton = document.querySelector("#soundButton");
  var shuffleButton = document.querySelector("#shuffleButton");
  var audioContext = null;
  var lastShuffleSoundAt = 0;
  var muted = readMuted();

  var icons = {
    on:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16.4 8.2a5 5 0 0 1 0 7.6l1.4 1.4a7 7 0 0 0 0-10.4z"></path></svg>',
    off:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M17.6 9 20 11.4 22.4 9l1.1 1.1-2.4 2.4 2.4 2.4-1.1 1.1-2.4-2.4-2.4 2.4-1.1-1.1 2.4-2.4-2.4-2.4z"></path></svg>',
  };

  function readMuted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function writeMuted() {
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch (error) {
      // Sound still works even when storage is unavailable.
    }
  }

  function updateButton() {
    if (!soundButton) return;
    soundButton.innerHTML = muted ? icons.off : icons.on;
    soundButton.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
    soundButton.setAttribute("aria-pressed", muted ? "false" : "true");
  }

  function ensureAudio() {
    if (muted) return null;
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;

    if (!audioContext) {
      audioContext = new AudioCtor();
    }

    if (audioContext.state === "suspended") {
      var resume = audioContext.resume();
      if (resume && resume.catch) resume.catch(function () {});
    }

    return audioContext;
  }

  function tone(frequency, duration, options) {
    var context = ensureAudio();
    if (!context) return;

    var settings = options || {};
    var start = context.currentTime + (settings.delay || 0);
    var oscillator = context.createOscillator();
    var gain = context.createGain();

    oscillator.type = settings.type || "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (settings.to) {
      oscillator.frequency.exponentialRampToValueAtTime(settings.to, start + duration);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(settings.volume || 0.08, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = function () {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function noise(duration, options) {
    var context = ensureAudio();
    if (!context || !context.createBuffer) return;

    var settings = options || {};
    var buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    var source = context.createBufferSource();
    var filter = context.createBiquadFilter();
    var gain = context.createGain();
    var start = context.currentTime + (settings.delay || 0);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(settings.frequency || 950, start);
    gain.gain.setValueAtTime(settings.volume || 0.035, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.onended = function () {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function playTap() {
    tone(240, 0.07, { to: 170, type: "sine", volume: 0.035 });
  }

  function playDrop() {
    tone(180, 0.08, { to: 110, type: "triangle", volume: 0.05, delay: 0.08 });
  }

  function playClear(combo) {
    var base = combo > 2 ? 520 : 440;
    tone(base, 0.11, { type: "triangle", volume: 0.055 });
    tone(base * 1.25, 0.12, { type: "triangle", volume: 0.052, delay: 0.08 });
    tone(base * 1.5, 0.14, { type: "sine", volume: 0.05, delay: 0.16 });
  }

  function playShuffle() {
    noise(0.16, { frequency: 760, volume: 0.032 });
    tone(330, 0.08, { to: 520, type: "square", volume: 0.026, delay: 0.04 });
  }

  function playShuffleOnce() {
    var now = Date.now();
    if (now - lastShuffleSoundAt < 220) return;
    lastShuffleSoundAt = now;
    playShuffle();
  }

  function playFinish(newBest) {
    if (newBest) {
      tone(523, 0.11, { type: "triangle", volume: 0.055 });
      tone(659, 0.12, { type: "triangle", volume: 0.052, delay: 0.1 });
      tone(784, 0.18, { type: "sine", volume: 0.05, delay: 0.22 });
      return;
    }
    tone(260, 0.16, { to: 180, type: "triangle", volume: 0.045 });
  }

  function setMuted(nextMuted) {
    muted = nextMuted;
    writeMuted();
    updateButton();

    if (!muted) {
      ensureAudio();
      tone(520, 0.08, { type: "sine", volume: 0.04 });
    }
  }

  if (soundButton) {
    soundButton.addEventListener("click", function (event) {
      if (event.button && event.button !== 0) return;
      setMuted(!muted);
    });
  }

  if (shuffleButton) {
    shuffleButton.addEventListener(
      "click",
      function () {
        if (!locked && !paused && !gameOver && moves > 0) playShuffleOnce();
      },
      true
    );
  }

  ["pointerdown", "touchstart", "keydown"].forEach(function (eventName) {
    window.addEventListener(
      eventName,
      function () {
        ensureAudio();
      },
      { once: true, passive: true }
    );
  });

  var originalHandleCellPress = handleCellPress;
  handleCellPress = async function (row, col) {
    var playable = !locked && !paused && !gameOver && board[row] && board[row][col];
    if (playable) {
      ensureAudio();
      playTap();
      playDrop();
    }
    return originalHandleCellPress(row, col);
  };

  var originalShowCombo = showCombo;
  showCombo = function (combo, points) {
    playClear(combo);
    return originalShowCombo(combo, points);
  };

  var originalShuffleBoard = shuffleBoard;
  shuffleBoard = async function () {
    var canShuffle = !locked && !paused && !gameOver && moves > 0;
    if (canShuffle) playShuffleOnce();
    return originalShuffleBoard();
  };

  var originalEndGame = endGame;
  endGame = function () {
    var newBest = score > best;
    playFinish(newBest);
    return originalEndGame();
  };

  updateButton();
})();
