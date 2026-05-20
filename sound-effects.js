(function () {
  var STORAGE_KEY = "chain-drop-sound-muted";
  var DEFAULT_SOUND_CONFIG = {
    enabled: true,
    fallback: "synth",
    masterVolume: 1,
    basePath: "assets/sounds/",
    events: {
      tap: { src: "", volume: 0.45 },
      drop: { src: "", volume: 0.55 },
      clear: { src: "", volume: 0.75 },
      combo: { src: "", volume: 0.8 },
      bigCombo: { src: "", volume: 0.85 },
      shuffle: { src: "", volume: 0.7 },
      finish: { src: "", volume: 0.65 },
      newBest: { src: "", volume: 0.8 },
      soundOn: { src: "", volume: 0.5 },
    },
  };

  var soundButton = document.querySelector("#soundButton");
  var shuffleButton = document.querySelector("#shuffleButton");
  var soundConfig = normalizeSoundConfig(window.CHAIN_DROP_SOUNDS);
  var audioContext = null;
  var soundBuffers = {};
  var soundLoading = {};
  var soundFailed = {};
  var lastShuffleSoundAt = 0;
  var muted = readMuted();

  var icons = {
    on:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16.4 8.2a5 5 0 0 1 0 7.6l1.4 1.4a7 7 0 0 0 0-10.4z"></path></svg>',
    off:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M17.6 9 20 11.4 22.4 9l1.1 1.1-2.4 2.4 2.4 2.4-1.1 1.1-2.4-2.4-2.4 2.4-1.1-1.1 2.4-2.4-2.4-2.4z"></path></svg>',
  };

  function normalizeSoundConfig(customSounds) {
    var custom = customSounds && typeof customSounds === "object" ? customSounds : {};
    var basePath = String(custom.basePath || DEFAULT_SOUND_CONFIG.basePath || "");
    var customEvents = custom.events && typeof custom.events === "object" ? custom.events : {};
    var events = {};

    Object.keys(DEFAULT_SOUND_CONFIG.events).forEach(function (name) {
      var fallback = DEFAULT_SOUND_CONFIG.events[name];
      var event = customEvents[name] && typeof customEvents[name] === "object" ? customEvents[name] : {};
      events[name] = {
        src: resolveSoundSrc(event.src || fallback.src || "", basePath),
        volume: clampVolume(event.volume, fallback.volume),
        playbackRate: clampRate(event.playbackRate, 1),
      };
    });

    return {
      enabled: custom.enabled !== false,
      fallback: custom.fallback === "none" ? "none" : "synth",
      masterVolume: clampVolume(custom.masterVolume, DEFAULT_SOUND_CONFIG.masterVolume),
      basePath: basePath,
      events: events,
    };
  }

  function clampVolume(value, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
  }

  function clampRate(value, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.max(0.25, Math.min(4, number));
  }

  function resolveSoundSrc(src, basePath) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:|\/)/.test(value)) return value;
    return String(basePath || "") + value;
  }

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

  function getAudioContext() {
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;

    if (!audioContext) {
      audioContext = new AudioCtor();
    }

    return audioContext;
  }

  function ensureAudio() {
    if (muted || !soundConfig.enabled) return null;
    var context = getAudioContext();
    if (!context) return null;

    if (context.state === "suspended") {
      var resume = context.resume();
      if (resume && resume.catch) resume.catch(function () {});
    }

    return context;
  }

  function decodeAudio(context, data) {
    return new Promise(function (resolve, reject) {
      var settled = false;

      function done(buffer) {
        if (settled) return;
        settled = true;
        resolve(buffer);
      }

      function fail(error) {
        if (settled) return;
        settled = true;
        reject(error);
      }

      try {
        var result = context.decodeAudioData(data.slice(0), done, fail);
        if (result && result.then) result.then(done, fail);
      } catch (error) {
        fail(error);
      }
    });
  }

  function loadFileSound(name) {
    var event = soundConfig.events[name];
    if (!event || !event.src || soundBuffers[name] || soundFailed[name] || !window.fetch) {
      return soundLoading[name] || null;
    }

    var context = getAudioContext();
    if (!context) return null;

    soundLoading[name] = window
      .fetch(event.src)
      .then(function (response) {
        if (!response.ok) throw new Error("Sound file not found: " + event.src);
        return response.arrayBuffer();
      })
      .then(function (data) {
        return decodeAudio(context, data);
      })
      .then(function (buffer) {
        soundBuffers[name] = buffer;
        return buffer;
      })
      .catch(function () {
        soundFailed[name] = true;
        return null;
      });

    return soundLoading[name];
  }

  function preloadFileSounds() {
    Object.keys(soundConfig.events).forEach(function (name) {
      if (soundConfig.events[name].src) loadFileSound(name);
    });
  }

  function playFileSound(name, options) {
    if (muted || !soundConfig.enabled) return true;

    var event = soundConfig.events[name];
    if (!event || !event.src) return false;

    if (!soundBuffers[name]) {
      loadFileSound(name);
      return false;
    }

    var context = ensureAudio();
    if (!context) return true;

    var settings = options || {};
    var source = context.createBufferSource();
    var gain = context.createGain();
    var start = context.currentTime + (settings.delay || 0);

    source.buffer = soundBuffers[name];
    source.playbackRate.setValueAtTime(settings.playbackRate || event.playbackRate || 1, start);
    gain.gain.setValueAtTime(event.volume * soundConfig.masterVolume, start);

    source.connect(gain);
    gain.connect(context.destination);
    source.onended = function () {
      source.disconnect();
      gain.disconnect();
    };
    source.start(start);
    return true;
  }

  function playSound(name, synthCallback) {
    if (muted || !soundConfig.enabled) return;
    if (playFileSound(name)) return;
    if (soundConfig.fallback !== "none" && synthCallback) synthCallback();
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
    gain.gain.exponentialRampToValueAtTime(
      (settings.volume || 0.08) * soundConfig.masterVolume,
      start + 0.012
    );
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
    gain.gain.setValueAtTime((settings.volume || 0.035) * soundConfig.masterVolume, start);
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

  function synthTap() {
    tone(240, 0.07, { to: 170, type: "sine", volume: 0.035 });
  }

  function synthDrop() {
    tone(180, 0.08, { to: 110, type: "triangle", volume: 0.05, delay: 0.08 });
  }

  function synthClear(combo) {
    var base = combo > 2 ? 520 : 440;
    tone(base, 0.11, { type: "triangle", volume: 0.055 });
    tone(base * 1.25, 0.12, { type: "triangle", volume: 0.052, delay: 0.08 });
    tone(base * 1.5, 0.14, { type: "sine", volume: 0.05, delay: 0.16 });
  }

  function synthShuffle() {
    noise(0.16, { frequency: 760, volume: 0.032 });
    tone(330, 0.08, { to: 520, type: "square", volume: 0.026, delay: 0.04 });
  }

  function synthFinish(newBest) {
    if (newBest) {
      tone(523, 0.11, { type: "triangle", volume: 0.055 });
      tone(659, 0.12, { type: "triangle", volume: 0.052, delay: 0.1 });
      tone(784, 0.18, { type: "sine", volume: 0.05, delay: 0.22 });
      return;
    }
    tone(260, 0.16, { to: 180, type: "triangle", volume: 0.045 });
  }

  function playTap() {
    playSound("tap", synthTap);
  }

  function playDrop() {
    playSound("drop", synthDrop);
  }

  function playClear(combo) {
    var eventName = combo >= 3 ? "bigCombo" : combo > 1 ? "combo" : "clear";
    if (muted || !soundConfig.enabled) return;
    if (playFileSound(eventName) || (eventName !== "clear" && playFileSound("clear"))) return;
    if (soundConfig.fallback !== "none") synthClear(combo);
  }

  function playShuffle() {
    playSound("shuffle", synthShuffle);
  }

  function playShuffleOnce() {
    var now = Date.now();
    if (now - lastShuffleSoundAt < 220) return;
    lastShuffleSoundAt = now;
    playShuffle();
  }

  function playFinish(newBest) {
    if (muted || !soundConfig.enabled) return;
    if (newBest && playFileSound("newBest")) return;
    if (playFileSound("finish")) return;
    if (soundConfig.fallback !== "none") synthFinish(newBest);
  }

  function setMuted(nextMuted) {
    muted = nextMuted;
    writeMuted();
    updateButton();

    if (!muted) {
      ensureAudio();
      preloadFileSounds();
      playSound("soundOn", function () {
        tone(520, 0.08, { type: "sine", volume: 0.04 });
      });
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
        preloadFileSounds();
      },
      { once: true, passive: true }
    );
  });

  var originalHandleCellPress = handleCellPress;
  handleCellPress = async function (row, col) {
    var playable = !locked && !paused && !gameOver && board[row] && board[row][col];
    if (playable) {
      ensureAudio();
      preloadFileSounds();
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

  preloadFileSounds();
  updateButton();
})();
