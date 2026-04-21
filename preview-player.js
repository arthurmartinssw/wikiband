const WikiPreview = (() => {
  const PLACEHOLDER_IMAGEM = "https://via.placeholder.com/300x300?text=Sem+Imagem";

  const trackCache = new Map();
  let player = null;
  let audio = null;
  let cover = null;
  let title = null;
  let meta = null;
  let toggleButton = null;
  let closeButton = null;
  let activeButton = null;
  let currentTrack = null;

  function normalizarPreviewUrl(url) {
    return url ? url.replace(/^http:/, "https:") : "";
  }

  function melhorarImagem(url, tamanho = "300x300bb") {
    return url ? url.replace("100x100bb", tamanho) : PLACEHOLDER_IMAGEM;
  }

  function formatDuration(ms) {
    if (!ms) return "--:--";

    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `${minutes}:${seconds}`;
  }

  function getIdleText(button) {
    return button?.dataset.previewIdleText || "Tocar";
  }

  function getPlayingText(button) {
    return button?.dataset.previewPlayingText || "Pausar";
  }

  function updateButton(button, isPlaying) {
    if (!button) return;

    button.disabled = false;
    button.textContent = isPlaying ? getPlayingText(button) : getIdleText(button);
    button.classList.toggle("is-playing", isPlaying);
  }

  function clearActiveButton() {
    updateButton(activeButton, false);
    activeButton = null;
  }

  function ensurePlayer() {
    if (player) return;

    player = document.createElement("section");
    player.className = "mini-player";
    player.setAttribute("aria-live", "polite");
    player.innerHTML = `
      <div class="mini-player-inner">
        <img class="mini-player-cover" src="${PLACEHOLDER_IMAGEM}" alt="">
        <div class="mini-player-info">
          <strong class="mini-player-title">Nenhuma prévia tocando</strong>
          <span class="mini-player-meta">Escolha uma faixa para ouvir</span>
        </div>
        <audio class="mini-player-audio" controls></audio>
        <div class="mini-player-actions">
          <button class="mini-player-toggle" type="button">Pausar</button>
          <button class="mini-player-close" type="button" aria-label="Fechar player">×</button>
        </div>
      </div>
    `;

    document.body.appendChild(player);

    audio = player.querySelector("audio");
    cover = player.querySelector(".mini-player-cover");
    title = player.querySelector(".mini-player-title");
    meta = player.querySelector(".mini-player-meta");
    toggleButton = player.querySelector(".mini-player-toggle");
    closeButton = player.querySelector(".mini-player-close");

    audio.addEventListener("play", () => {
      player.classList.add("active");
      document.body.classList.add("has-mini-player");
      toggleButton.textContent = "Pausar";
      updateButton(activeButton, true);
    });

    audio.addEventListener("pause", () => {
      toggleButton.textContent = "Tocar";
      updateButton(activeButton, false);
    });

    audio.addEventListener("ended", () => {
      toggleButton.textContent = "Tocar";
      clearActiveButton();
    });

    toggleButton.addEventListener("click", () => {
      if (!audio.src) return;

      if (audio.paused) {
        audio.play().catch((erro) => {
          console.warn("Não foi possível iniciar a prévia:", erro);
        });
      } else {
        audio.pause();
      }
    });

    closeButton.addEventListener("click", stop);
  }

  function montarFaixa(item, album, index) {
    return {
      id: item.trackId || `${album.albumId}-${index}`,
      nome: item.trackName || `Faixa ${index + 1}`,
      artista: item.artistName || album.nome,
      album: item.collectionName || album.album,
      numero: item.trackNumber || index + 1,
      duracaoMs: item.trackTimeMillis || 0,
      previewUrl: normalizarPreviewUrl(item.previewUrl),
      imagem: melhorarImagem(item.artworkUrl100 || album.imagem)
    };
  }

  async function getAlbumTracks(album) {
    if (!album?.albumId) return [];

    if (trackCache.has(album.albumId)) {
      return trackCache.get(album.albumId);
    }

    const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(
      album.albumId
    )}&entity=song`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
      throw new Error("Não foi possível buscar as faixas do álbum.");
    }

    const dados = await resposta.json();
    const faixas = (dados.results || [])
      .filter((item) => item.wrapperType === "track")
      .map((item, index) => montarFaixa(item, album, index));

    trackCache.set(album.albumId, faixas);
    return faixas;
  }

  async function getFirstPreview(album) {
    const faixas = await getAlbumTracks(album);
    return faixas.find((faixa) => faixa.previewUrl) || null;
  }

  function playTrack(track, album, button) {
    ensurePlayer();

    if (!track?.previewUrl) {
      return Promise.reject(new Error("Prévia indisponível."));
    }

    const isSameTrack = currentTrack?.id === track.id;

    if (isSameTrack && !audio.paused) {
      audio.pause();
      return Promise.resolve();
    }

    if (activeButton && activeButton !== button) {
      updateButton(activeButton, false);
    }

    activeButton = button || null;
    currentTrack = track;

    cover.src = track.imagem || album?.imagem || PLACEHOLDER_IMAGEM;
    cover.alt = track.album || album?.album || "Capa do álbum";
    title.textContent = track.nome;
    meta.textContent = `${track.artista || album?.nome || "Artista"} • ${
      track.album || album?.album || "Álbum"
    }`;
    player.classList.add("active");
    document.body.classList.add("has-mini-player");

    if (!isSameTrack || audio.src !== track.previewUrl) {
      audio.src = track.previewUrl;
    }

    updateButton(activeButton, true);

    const playPromise = audio.play();

    if (playPromise) {
      playPromise.catch((erro) => {
        console.warn("O navegador bloqueou o play automático:", erro);
        updateButton(activeButton, false);
      });
    }

    return playPromise || Promise.resolve();
  }

  function stop() {
    ensurePlayer();

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    player.classList.remove("active");
    document.body.classList.remove("has-mini-player");
    currentTrack = null;
    clearActiveButton();
  }

  return {
    formatDuration,
    getAlbumTracks,
    getFirstPreview,
    playTrack,
    stop
  };
})();

window.WikiPreview = WikiPreview;
