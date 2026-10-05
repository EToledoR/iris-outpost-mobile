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
  const folderEl = document.getElementById("music-folder");

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

  const displayName = file => file.name.replace(/\.[^.]+$/, "");

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
    const files = [...fileList].filter(f => f.type.startsWith("audio/") || /\.(mp3|m4a|ogg|wav|flac)$/i.test(f.name));
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
    filesEl.value = "";
    folderEl.value = "";
  }

  filesEl.addEventListener("change", e => acceptFiles(e.target.files));
  folderEl.addEventListener("change", e => acceptFiles(e.target.files));

  playBtn.addEventListener("click", () => {
    if (!playlist.length) return;
    if (audioEl.paused) audioEl.play().catch(() => {}); else audioEl.pause();
  });

  prevBtn.addEventListener("click", () => { loadTrack(currentIndex - 1); audioEl.play().catch(() => {}); });
  nextBtn.addEventListener("click", () => { loadTrack(currentIndex + 1); audioEl.play().catch(() => {}); });

  audioEl.addEventListener("play", updatePlayButton);
  audioEl.addEventListener("pause", updatePlayButton);
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
