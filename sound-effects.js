(function () {
  var STORAGE_KEY = "chain-drop-sound-muted";
  var MAX_COMBO_VOICE = 8;
  var DEFAULT_AUDIO_CONFIG = {
    enabled: true,
    fallback: "synth",
    masterVolume: 1,
    sfxBasePath: "assets/sounds/",
    voiceBasePath: "assets/voices/",
    sfx: {
      tap: { src: "", volume: 0.45 },
      drop: { src: "", volume: 0.55 },
      clearBlocks: { src: "", volume: 0.75 },
      bomb: { src: "", volume: 0.8 },
      shuffle: { src: "", volume: 0.7 },
      finish: { src: "", volume: 0.65 },
      newBest: { src: "", volume: 0.8 },
      soundOn: { src: "", volume: 0.5 },
    },
    voices: {
      volume: 0.9,
      combos: {},
    },
  };

  var soundButton = document.querySelector("#soundButton");
  var shuffleButton = document.querySelector("#shuffleButton");
  var audioConfig = normalizeAudioConfig(window.CHAIN_DROP_AUDIO || window.CHAIN_DROP_SOUNDS);
  var audioContext = null;
  var fileBuffers = {};
  var fileLoading = {};
  var fileFailed = {};
  var lastShuffleSoundAt = 0;
  var muted = readMuted();

  var icons = {
    on:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16.4 8.2a5 5 0 0 1 0 7.6l1.4 1.4a7 7 0 0 0 0-10.4z"></path></svg>',
    off:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M17.6 9 20 11.4 22.4 9l1.1 1.1-2.4 2.4 2.4 2.4-1.1 1.1-2.4-2.4-2.4 2.4-1.1-1.1 2.4-2.4-2.4-2.4z"></path></svg>',
  };

  function normalizeAudioConfig(customAudio) {
    var custom = customAudio && typeof customAudio === "object" ? customAudio : {};
    var legacyEvents = custom.events && typeof custom.events === "object" ? custom.events : {};
    var customSfx = custom.sfx && typeof custom.sfx === "object" ? custom.sfx : legacyEvents;
    var sfxBasePath = String(custom.sfxBasePath || custom.basePath || DEFAULT_AUDIO_CONFIG.sfxBasePath);
    var voiceBasePath = String(custom.voiceBasePath || "assets/voices/");
    var sfx = {};

    Object.keys(DEFAULT_AUDIO_CONFIG.sfx).forEach(function (name) {
      var fallback = DEFAULT_AUDIO_CONFIG.sfx[name];
      var legacyName = name === "clearBlocks" ? "clear" : name;
      var item =
        (customSfx[name] && typeof customSfx[name] === "object" && customSfx[name]) ||
        (customSfx[legacyName] && typeof customSfx[legacyName] === "object" && customSfx[legacyName]) ||
        {};
      sfx[name] = normalizeFileEntry(item, fallback, sfxBasePath);
    });

    return {
      enabled: custom.enabled !== false,
      fallback: custom.fallback === "none" ? "none" : "synth",
      masterVolume: clampVolume(custom.masterVolume, DEFAULT_AUDIO_CONFIG.masterVolume),
      sfxBasePath: sfxBasePath,
      voiceBasePath: voiceBasePath,
      sfx: sfx,
      voices: normalizeVoices(custom.voices, voiceBasePath),
    };
  }

  function normalizeVoices(customVoices, basePath) {
    var voices = customVoices && typeof customVoices === "object" ? customVoices : {};
    var customCombos = voices.combos && typeof voices.combos === "object" ? voices.combos : {};
    var combos = {};

    for (var combo = 1; combo <= MAX_COMBO_VOICE; combo += 1) {
      var list = Array.isArray(customCombos[combo]) ? customCombos[combo] : [];
      combos[combo] = list
        .slice(0, 3)
        .map(function (item) {
          return normalizeFileEntry(item, { src: "", volume: voices.volume || 0.9 }, basePath);
        })
        .filter(function (item) {
          return item.src;
        });
    }

    return {
      volume: clampVolume(voices.volume, DEFAULT_AUDIO_CONFIG.voices.volume),
      combos: combos,
    };
  }

  function normalizeFileEntry(item, fallback, basePath) {
    var source = item && typeof item === "object" ? item : {};
    return {
      src: resolveFileSrc(source.src || fallback.src || "", basePath),
      volume: clampVolume(source.volume, fallback.volume),
      playbackRate: clampRate(source.playbackRate, 1),
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

  function resolveFileSrc(src, basePath) {
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
      // Storage can be unavailable in privacy modes; sound still works.
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
    if (muted || !audioConfig.enabled) return null;
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

  function loadFile(entry) {
    if (!entry || !entry.src || fileBuffers[entry.src] || fileFailed[entry.src] || !window.fetch) {
      return entry && entry.src ? fileLoading[entry.src] || null : null;
    }

    var context = getAudioContext();
    if (!context) return null;

    fileLoading[entry.src] = window
      .fetch(entry.src)
      .then(function (response) {
        if (!response.ok) throw new Error("Sound file not found: " + entry.src);
        return response.arrayBuffer();
      })
      .then(function (data) {
        return decodeAudio(context, data);
      })
      .then(function (buffer) {
        fileBuffers[entry.src] = buffer;
        return buffer;
      })
      .catch(function () {
        fileFailed[entry.src] = true;
        return null;
      });

    return fileLoading[entry.src];
  }

  function preloadFiles() {
    Object.keys(audioConfig.sfx).forEach(function (name) {
      if (audioConfig.sfx[name].src) loadFile(audioConfig.sfx[name]);
    });

    for (var combo = 1; combo <= MAX_COMBO_VOICE; combo += 1) {
      audioConfig.voices.combos[combo].forEach(loadFile);
    }
  }

  function playFile(entry, options) {
    if (muted || !audioConfig.enabled) return true;
    if (!entry || !entry.src) return false;

    if (!fileBuffers[entry.src]) {
      var loading = loadFile(entry);
      if (loading && loading.then) {
        loading.then(function (buffer) {
          if (buffer) playFile(entry, options);
        });
      }
      return true;
    }

    var context = ensureAudio();
    if (!context) return true;

    var settings = options || {};
    var source = context.createBufferSource();
    var gain = context.createGain();
    var start = context.currentTime + (settings.delay || 0);

    source.buffer = fileBuffers[entry.src];
    source.playbackRate.setValueAtTime(settings.playbackRate || entry.playbackRate || 1, start);
    gain.gain.setValueAtTime(entry.volume * audioConfig.masterVolume, start);

    source.connect(gain);
    gain.connect(context.destination);
    source.onended = function () {
      source.disconnect();
      gain.disconnect();
    };
    source.start(start);
    return true;
  }

  function playSfx(name, synthCallback) {
    if (muted || !audioConfig.enabled) return;
    if (playFile(audioConfig.sfx[name])) return;
    if (audioConfig.fallback !== "none" && synthCallback) synthCallback();
  }

  function playComboVoice(combo) {
    if (muted || !audioConfig.enabled) return;
    var voiceCombo = Math.max(1, Math.min(MAX_COMBO_VOICE, combo));
    var variants = audioConfig.voices.combos[voiceCombo] || [];
    if (!variants.length) return;

    var entry = variants[Math.floor(Math.random() * variants.length)];
    playFile(entry, { delay: 0.08 });
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
      (settings.volume || 0.08) * audioConfig.masterVolume,
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
    gain.gain.setValueAtTime((settings.volume || 0.035) * audioConfig.masterVolume, start);
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

  function synthClearBlocks(combo) {
    var base = combo > 2 ? 520 : 440;
    tone(base, 0.11, { type: "triangle", volume: 0.055 });
    tone(base * 1.25, 0.12, { type: "triangle", volume: 0.052, delay: 0.08 });
    tone(base * 1.5, 0.14, { type: "sine", volume: 0.05, delay: 0.16 });
  }

  function synthShuffle() {
    noise(0.16, { frequency: 760, volume: 0.032 });
    tone(330, 0.08, { to: 520, type: "square", volume: 0.026, delay: 0.04 });
  }

  function synthBomb() {
    noise(0.2, { frequency: 420, volume: 0.055 });
    tone(150, 0.16, { to: 75, type: "triangle", volume: 0.07 });
    tone(520, 0.08, { to: 260, type: "square", volume: 0.032, delay: 0.04 });
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

  function playClear(combo) {
    playSfx("clearBlocks", function () {
      synthClearBlocks(combo);
    });
    playComboVoice(combo);
  }

  function playShuffleOnce() {
    var now = Date.now();
    if (now - lastShuffleSoundAt < 220) return;
    lastShuffleSoundAt = now;
    playSfx("shuffle", synthShuffle);
  }

  function playFinish(newBest) {
    if (newBest) {
      playSfx("newBest", function () {
        synthFinish(true);
      });
      return;
    }

    playSfx("finish", function () {
      synthFinish(false);
    });
  }

  function setMuted(nextMuted) {
    muted = nextMuted;
    writeMuted();
    updateButton();

    if (!muted) {
      ensureAudio();
      preloadFiles();
      playSfx("soundOn", function () {
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
        preloadFiles();
      },
      { once: true, passive: true }
    );
  });

  var originalHandleCellPress = handleCellPress;
  handleCellPress = async function (row, col) {
    var playable = !locked && !paused && !gameOver && board[row] && board[row][col];
    if (playable) {
      ensureAudio();
      preloadFiles();
      if (window.isChainDropBomb && window.isChainDropBomb(board[row][col])) {
        playSfx("bomb", synthBomb);
      } else {
        playSfx("tap", synthTap);
        playSfx("drop", synthDrop);
      }
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
