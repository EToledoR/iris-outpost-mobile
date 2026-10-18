/**
 * Iris Outpost Mobile player.
 * Local audio files are selected by the user and played directly in-browser.
 * Nothing is uploaded anywhere.
 */
(() => {
  const audioEl = document.getElementById("player-audio");
  const titleEl = document.getElementById("player-title");
  const countEl = document.getElementById("player-count");
  const messageEl = document.getElementById("player-message");
  const playBtn = document.getElementById("player-play");
  const prevBtn = document.getElementById("player-prev");
  const nextBtn = document.getElementById("player-next");
  const loopBtn = document.getElementById("player-loop");
  const volumeEl = document.getElementById("player-volume");
  const filesEl = document.getElementById("music-files");
  const dropZone = document.getElementById("drop-zone");
  const spectrumCanvas = document.getElementById("audio-spectrum");
  const spectrumCtx = spectrumCanvas ? spectrumCanvas.getContext("2d") : null;

  // Keep the visualiser deliberately small for older mobile browsers.
  let audioContext = null;
  let analyser = null;
  let sourceNode = null;
  let spectrumFrame = 0;
  let spectrumData = null;
  let spectrumReady = false;

  function setupSpectrum() {
    if (!spectrumCtx || spectrumReady) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128; // 64 bins; inexpensive on older devices.
      analyser.smoothingTimeConstant = 0.78;
      spectrumData = new Uint8Array(analyser.frequencyBinCount);
      sourceNode = audioContext.createMediaElementSource(audioEl);
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
      spectrumReady = true;
    } catch (error) {
      // Audio playback must continue even if Web Audio is unavailable.
      if (audioContext) audioContext.close().catch(() => {});
      audioContext = analyser = sourceNode = spectrumData = null;
      spectrumReady = false;
    }
  }

  function drawSpectrum() {
    if (!spectrumCtx || !spectrumCanvas || !analyser || audioEl.paused) {
      stopSpectrum();
      return;
    }
    analyser.getByteFrequencyData(spectrumData);
    const width = spectrumCanvas.width;
    const height = spectrumCanvas.height;
    spectrumCtx.clearRect(0, 0, width, height);
    const bars = 32;
    const gap = 3;
    const barWidth = (width - gap * (bars - 1)) / bars;
    const segments = 6;
    const segmentHeight = 5;
    const segmentGap = 2;
    for (let i = 0; i < bars; i++) {
      const firstBin = Math.floor(i * spectrumData.length / bars);
      const lastBin = Math.max(firstBin + 1, Math.floor((i + 1) * spectrumData.length / bars));
      let peak = 0;
      for (let bin = firstBin; bin < lastBin; bin++) peak = Math.max(peak, spectrumData[bin]);
      const magnitude = peak / 255;
      const litSegments = Math.min(segments, Math.max(1, Math.round(magnitude * segments * 1.25)));
      spectrumCtx.fillStyle = "rgba(143, 163, 125, " + (0.48 + magnitude * 0.52) + ")";
      for (let segment = 0; segment < litSegments; segment++) {
        const y = height - segmentHeight - segment * (segmentHeight + segmentGap) - 2;
        spectrumCtx.fillRect(i * (barWidth + gap), y, barWidth, segmentHeight);
      }
    }
    spectrumFrame = requestAnimationFrame(drawSpectrum);
  }

  function stopSpectrum() {
    if (spectrumFrame) cancelAnimationFrame(spectrumFrame);
    spectrumFrame = 0;
    if (spectrumCtx && spectrumCanvas) {
      spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
    }
  }

  function startSpectrum() {
    if (!spectrumCtx || spectrumFrame) return;
    setupSpectrum();
    if (!analyser) return;
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    spectrumFrame = requestAnimationFrame(drawSpectrum);
  }

  let playlist = [];
  let currentIndex = 0;
  let loopPlaylist = true;
  let objectUrl = null;

  const setControls = (enabled) => {
    [playBtn, prevBtn, nextBtn, loopBtn].forEach(b => b.disabled = !enabled);
  };

  const revokeCurrentUrl = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };

  const displayName = file => file.name.replace(/\.[^.]+\$/, "");

  function loadTrack(index) {
    if (!playlist.length) return;
    currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    revokeCurrentUrl();
    const track = playlist[currentIndex];
    objectUrl = URL.createObjectURL(track.file);
    audioEl.src = objectUrl;
    titleEl.textContent = track.title;
    countEl.textContent = `${currentIndex + 1} / ${playlist.length}`;
  }

  function updatePlayButton() {
    playBtn.textContent = audioEl.paused ? "▶" : "⏸";
  }

  function acceptFiles(fileList) {
    const files = [...fileList].filter(f => f.type.startsWith("audio/") || /\.(mp3|m4a|ogg|wav|flac)\$/i.test(f.name));
    if (!files.length) {
      messageEl.textContent = "No audio files found.";
      return;
    }
    audioEl.pause();
    playlist = files.map(file => ({ file, title: displayName(file) }));
    playlist.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));
    loadTrack(0);
    setControls(true);
    messageEl.textContent = `${playlist.length} track${playlist.length === 1 ? "" : "s"} loaded locally. Nothing was uploaded.`;
    if (filesEl) filesEl.value = "";
  }

  // --- LÓGICA DE PROCESAMIENTO RECURSIVO PARA CARPETAS (DRAG & DROP) ---
  async function processDataTransfer(items) {
    const fileQueue = [];
    
    async function traverseDirectory(entry) {
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        fileQueue.push(file);
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise((resolve) => {
          dirReader.readEntries(resolve);
        });
        for (const childEntry of entries) {
          await traverseDirectory(childEntry);
        }
      }
    }

    const promises = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        promises.push(traverseDirectory(entry));
      } else {
        const file = item.getAsFile();
        if (file) fileQueue.push(file);
      }
    }

    await Promise.all(promises);
    acceptFiles(fileQueue);
  }

  // --- ASIGNACIÓN DE EVENTOS ---

  // Evento nativo del input: ideal para navegadores viejos como el del Kindle Fire
  if (filesEl) {
    filesEl.addEventListener("change", e => acceptFiles(e.target.files));
  }

  // Eventos de arrastrar y soltar (Drag and Drop) para navegadores de escritorio/modernos
  if (dropZone) {
    ["dragover", "dragenter"].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add("highlight");
      }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove("highlight");
      }, false);
    });

    dropZone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.items) {
        processDataTransfer(dt.items);
      } else if (dt && dt.files) {
        acceptFiles(dt.files);
      }
    }, false);
  }

  playBtn.addEventListener("click", () => {
    if (!playlist.length) return;
    if (audioEl.paused) audioEl.play().catch(() => {}); else audioEl.pause();
  });

  prevBtn.addEventListener("click", () => { loadTrack(currentIndex - 1); audioEl.play().catch(() => {}); });
  nextBtn.addEventListener("click", () => { loadTrack(currentIndex + 1); audioEl.play().catch(() => {}); });

  audioEl.addEventListener("play", () => {
    updatePlayButton();
    startSpectrum();
  });
  audioEl.addEventListener("pause", () => {
    updatePlayButton();
    stopSpectrum();
  });
  audioEl.addEventListener("ended", stopSpectrum);
  audioEl.addEventListener("ended", () => {
    if (currentIndex === playlist.length - 1 && !loopPlaylist) return;
    loadTrack(currentIndex + 1);
    audioEl.play().catch(() => {});
  });

  loopBtn.addEventListener("click", () => {
    loopPlaylist = !loopPlaylist;
    loopBtn.classList.toggle("active", loopPlaylist);
  });

  volumeEl.addEventListener("input", () => { audioEl.volume = Number(volumeEl.value); });
  audioEl.volume = Number(volumeEl.value);
  setControls(false);

  if ("mediaSession" in navigator) {
    audioEl.addEventListener("loadedmetadata", () => {
      navigator.mediaSession.metadata = new MediaMetadata({ title: titleEl.textContent, artist: "Iris Outpost", album: "Lo-Fi Radio" });
    });
    navigator.mediaSession.setActionHandler?.("play", () => audioEl.play());
    navigator.mediaSession.setActionHandler?.("pause", () => audioEl.pause());
    navigator.mediaSession.setActionHandler?.("previoustrack", () => { loadTrack(currentIndex - 1); audioEl.play(); });
    navigator.mediaSession.setActionHandler?.("nexttrack", () => { loadTrack(currentIndex + 1); audioEl.play(); });
  }
})();
