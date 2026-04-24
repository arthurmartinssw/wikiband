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
  let prevButton = null;
  let nextButton = null;
  let queueStatus = null;
  let activeButton = null;
  let currentTrack = null;

  let radioQueue = [];
  let radioIndex = -1;
  let radioLabel = "";

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

  function updateRadioStatus() {
    if (!player) return;

    const hasRadio = radioQueue.length > 0;

    queueStatus.hidden = !hasRadio;

    if (hasRadio) {
      const position = radioIndex >= 0 ? radioIndex + 1 : 0;
      queueStatus.textContent = `${radioLabel || "Radio"} • ${position}/${radioQueue.length}`;
    }

    const hasNavigation = hasRadio && radioQueue.length > 1;
    prevButton.disabled = !hasNavigation;
    nextButton.disabled = !hasNavigation;
  }

  function clearRadioState() {
    radioQueue = [];
    radioIndex = -1;
    radioLabel = "";
    updateRadioStatus();
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
          <span class="mini-player-queue" hidden></span>
        </div>
        <audio class="mini-player-audio" controls></audio>
        <div class="mini-player-actions">
          <button class="mini-player-prev" type="button">Anterior</button>
          <button class="mini-player-toggle" type="button">Pausar</button>
          <button class="mini-player-next" type="button">Proxima</button>
          <button class="mini-player-close" type="button" aria-label="Fechar player">×</button>
        </div>
      </div>
    `;

    document.body.appendChild(player);

    audio = player.querySelector("audio");
    cover = player.querySelector(".mini-player-cover");
    title = player.querySelector(".mini-player-title");
    meta = player.querySelector(".mini-player-meta");
    queueStatus = player.querySelector(".mini-player-queue");
    toggleButton = player.querySelector(".mini-player-toggle");
    closeButton = player.querySelector(".mini-player-close");
    prevButton = player.querySelector(".mini-player-prev");
    nextButton = player.querySelector(".mini-player-next");

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
      if (radioQueue.length > 0) {
        nextInRadio().catch(() => {
          toggleButton.textContent = "Tocar";
          clearActiveButton();
          clearRadioState();
        });
        return;
      }

      toggleButton.textContent = "Tocar";
      clearActiveButton();
    });

    toggleButton.addEventListener("click", () => {
      if (!audio.src) return;

      if (audio.paused) {
        audio.play().catch((erro) => {
          console.warn("Nao foi possivel iniciar a previa:", erro);
        });
      } else {
        audio.pause();
      }
    });

    prevButton.addEventListener("click", () => {
      prevInRadio().catch((erro) => {
        console.warn("Nao foi possivel tocar a faixa anterior:", erro);
      });
    });

    nextButton.addEventListener("click", () => {
      nextInRadio().catch((erro) => {
        console.warn("Nao foi possivel tocar a proxima faixa:", erro);
      });
    });

    closeButton.addEventListener("click", stop);
    updateRadioStatus();
  }

  function montarFaixa(item, album, index) {
    return {
      id: item.trackId || `${album.albumId}-${index}`,
      nome: item.trackName || `Faixa ${index + 1}`,
      artista: item.artistName || album.nome,
      album: item.collectionName || album.album,
      numero: index + 1,
      duracaoMs: item.trackTimeMillis || 0,
      previewUrl: normalizarPreviewUrl(item.previewUrl),
      imagem: melhorarImagem(item.artworkUrl100 || album.imagem)
    };
  }

  function montarFaixaDeMusica(item) {
    const previewUrl = normalizarPreviewUrl(item?.previewUrl);

    if (!previewUrl) {
      return null;
    }

    return {
      id: item.trackId || `${item.nome || "artista"}-${item.musica || item.album || "musica"}`,
      nome: item.musica || item.trackName || item.nome || "Faixa",
      artista: item.nome || item.artistName || "Artista",
      album: item.album || item.collectionName || "Album",
      numero: item.numero || 1,
      duracaoMs: item.duracaoMs || item.trackTimeMillis || 0,
      previewUrl,
      imagem: item.imagem || melhorarImagem(item.artworkUrl100)
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
      throw new Error("Nao foi possivel buscar as faixas do album.");
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

  function normalizeRadioIndex(index) {
    if (!radioQueue.length) return -1;

    const total = radioQueue.length;
    return ((index % total) + total) % total;
  }

  async function resolveRadioEntry(entry) {
    if (!entry?.item) return null;

    const trackDireta = montarFaixaDeMusica(entry.item);

    if (trackDireta) {
      return {
        track: trackDireta,
        source: entry.item
      };
    }

    const previewAlbum = await getFirstPreview(entry.item);

    if (!previewAlbum) {
      return null;
    }

    return {
      track: previewAlbum,
      source: entry.item
    };
  }

  async function playRadioAt(index, direction = 1, attempts = 0) {
    ensurePlayer();

    if (!radioQueue.length) {
      throw new Error("Radio inativo.");
    }

    if (attempts >= radioQueue.length) {
      throw new Error("Nenhuma previa disponivel na fila.");
    }

    const normalizedIndex = normalizeRadioIndex(index);
    const entry = radioQueue[normalizedIndex];
    const resolved = await resolveRadioEntry(entry);

    if (!resolved?.track?.previewUrl) {
      return playRadioAt(normalizedIndex + direction, direction, attempts + 1);
    }

    radioIndex = normalizedIndex;
    updateRadioStatus();

    await playTrack(resolved.track, resolved.source, null, { fromRadio: true });
    return resolved;
  }

  async function startRadio(items, options = {}) {
    ensurePlayer();

    radioQueue = (Array.isArray(items) ? items : []).filter(Boolean).map((item) => ({ item }));
    radioIndex = -1;
    radioLabel = String(options.label || "Radio");
    updateRadioStatus();

    if (!radioQueue.length) {
      throw new Error("Nao ha itens para tocar.");
    }

    return playRadioAt(0, 1);
  }

  async function nextInRadio() {
    if (!radioQueue.length) {
      throw new Error("Radio inativo.");
    }

    const nextIndex = radioIndex >= 0 ? radioIndex + 1 : 0;
    return playRadioAt(nextIndex, 1);
  }

  async function prevInRadio() {
    if (!radioQueue.length) {
      throw new Error("Radio inativo.");
    }

    const previousIndex = radioIndex >= 0 ? radioIndex - 1 : radioQueue.length - 1;
    return playRadioAt(previousIndex, -1);
  }

  function getRadioState() {
    return {
      active: radioQueue.length > 0,
      index: radioIndex,
      total: radioQueue.length,
      label: radioLabel
    };
  }

  function playTrack(track, album, button, options = {}) {
    ensurePlayer();

    if (!track?.previewUrl) {
      return Promise.reject(new Error("Previa indisponivel."));
    }

    if (!options.fromRadio && radioQueue.length) {
      clearRadioState();
    }

    const isSameTrack = currentTrack?.id === track.id;

    if (isSameTrack && !audio.paused) {
      audio.pause();
      return Promise.resolve();
    }

    if (activeButton && activeButton !== button) {
      updateButton(activeButton, false);
    }

    if (!button) {
      clearActiveButton();
    }

    activeButton = button || null;
    currentTrack = track;

    cover.src = track.imagem || album?.imagem || PLACEHOLDER_IMAGEM;
    cover.alt = track.album || album?.album || "Capa do album";
    title.textContent = track.nome;
    meta.textContent = `${track.artista || album?.nome || "Artista"} • ${
      track.album || album?.album || "Album"
    }`;
    player.classList.add("active");
    document.body.classList.add("has-mini-player");

    if (!isSameTrack || audio.src !== track.previewUrl) {
      audio.src = track.previewUrl;
    }

    updateButton(activeButton, true);

    if (window.WikibandStorage?.addPlayEvent) {
      window.WikibandStorage.addPlayEvent(album || track);
    }

    const playPromise = audio.play();

    if (playPromise) {
      playPromise.catch((erro) => {
        console.warn("O navegador bloqueou o play automatico:", erro);
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
    clearRadioState();
  }

  return {
    formatDuration,
    getAlbumTracks,
    getFirstPreview,
    getRadioState,
    nextInRadio,
    playTrack,
    prevInRadio,
    startRadio,
    stop
  };
})();

window.WikiPreview = WikiPreview;
