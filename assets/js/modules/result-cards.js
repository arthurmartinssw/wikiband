(function initWikibandCards(window) {
  const Safe = window.WikibandSafe;
  const escapeHtml = Safe?.escapeHtml || ((value) => String(value ?? ""));
  const safeImageUrl = Safe?.safeImageUrl || ((value) => String(value || ""));

  function icon(name) {
    return window.WikibandUI?.icon(name) || "";
  }

  // Stable gradient per artist name, used where there is no artwork.
  function artistGradient(name) {
    let hash = 0;
    for (const char of String(name || "")) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    const hue = 200 + (Math.abs(hash) % 70);
    return `linear-gradient(140deg, hsl(${hue} 85% 62%), hsl(${hue + 15} 70% 22%))`;
  }

  function iconButton(className, iconName, label, active = false) {
    return `<button class="icon-btn ${className}${active ? " active" : ""}" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-pressed="${active}">${icon(iconName)}</button>`;
  }

  function year(value) {
    return /^\d{4}$/.test(String(value)) ? String(value) : "";
  }

  function meta(...parts) {
    return parts.filter(Boolean).map(escapeHtml).join(" · ");
  }

  function bindCommon(card, item, context, { onOpen } = {}) {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      (onOpen || context.openDetails)(item);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target === card) (onOpen || context.openDetails)(item);
    });

    card.querySelector(".collection-btn")?.addEventListener("click", () => context.addToCollection(item));
    card.querySelector(".share-btn")?.addEventListener("click", (event) => context.shareItem(item, event.currentTarget));
  }

  function createCard(className = "") {
    const card = document.createElement("article");
    card.className = `media-card ${className}`.trim();
    card.tabIndex = 0;
    return card;
  }

  function criarAlbumCard(album, context) {
    const card = createCard();
    const albumFav = context.isAlbumFavorite(album.albumId);
    const bandFav = context.isBandFavorite(album.bandaId);

    card.innerHTML = `
      <div class="media-art">
        <img src="${safeImageUrl(album.imagem)}" alt="" loading="lazy">
        <button class="play-fab preview-btn" type="button">Tocar prévia</button>
      </div>
      <div class="media-body">
        <h3 class="media-title">${escapeHtml(album.album)}</h3>
        <p class="media-sub">${escapeHtml(album.nome)}</p>
        <p class="media-meta">${meta(album.genero, year(album.lancamento))}</p>
      </div>
      <div class="media-actions">
        ${iconButton("favorite-btn", "heart", albumFav ? "Remover álbum dos favoritos" : "Favoritar álbum", albumFav)}
        ${iconButton("favorite-band-btn", "star", bandFav ? "Remover artista dos favoritos" : "Favoritar artista", bandFav)}
        ${iconButton("collection-btn", "plus", "Adicionar à coleção")}
        ${iconButton("share-btn", "share", "Compartilhar")}
      </div>
      <div class="preview-area" aria-live="polite"></div>
    `;

    const previewBtn = card.querySelector(".preview-btn");
    previewBtn.dataset.previewIdleText = "Tocar prévia";
    previewBtn.dataset.previewPlayingText = "Pausar prévia";
    previewBtn.addEventListener("click", () => context.playAlbumPreview(album, card, previewBtn));
    card.querySelector(".favorite-btn").addEventListener("click", () => context.toggleAlbumFavorite(album));
    card.querySelector(".favorite-band-btn").addEventListener("click", () => context.toggleBandFavorite(album));
    bindCommon(card, album, context);
    return card;
  }

  function criarMusicaCard(musica, context) {
    const card = createCard();

    card.innerHTML = `
      <div class="media-art">
        <img src="${safeImageUrl(musica.imagem)}" alt="" loading="lazy">
        <button class="play-fab preview-btn${musica.previewUrl ? "" : " no-preview"}" type="button" ${musica.previewUrl ? "" : "disabled"}>
          ${musica.previewUrl ? "Tocar prévia" : "Sem prévia"}
        </button>
      </div>
      <div class="media-body">
        <h3 class="media-title">${escapeHtml(musica.musica)}</h3>
        <p class="media-sub">${escapeHtml(musica.nome)}</p>
        <p class="media-meta">${meta(musica.album, year(musica.lancamento))}</p>
      </div>
      <div class="media-actions">
        ${iconButton("details-btn", "disc", "Ver álbum")}
        ${iconButton("collection-btn", "plus", "Adicionar à coleção")}
        ${iconButton("share-btn", "share", "Compartilhar")}
      </div>
    `;

    const previewBtn = card.querySelector(".preview-btn");
    previewBtn.dataset.previewIdleText = "Tocar prévia";
    previewBtn.dataset.previewPlayingText = "Pausar prévia";
    previewBtn.addEventListener("click", () => context.playSongPreview(musica, previewBtn));
    card.querySelector(".details-btn").addEventListener("click", () => context.openDetails(musica));
    bindCommon(card, musica, context);
    return card;
  }

  function criarArtistaCard(artista, context) {
    const card = createCard("artist-card");
    const bandFav = context.isBandFavorite(artista.bandaId);

    card.innerHTML = `
      <div class="media-art">
        <div class="artist-placeholder">${escapeHtml(artista.nome.charAt(0).toUpperCase())}</div>
      </div>
      <div class="media-body">
        <h3 class="media-title">${escapeHtml(artista.nome)}</h3>
        <p class="media-meta">${meta("Artista", artista.genero)}</p>
      </div>
      <div class="media-actions">
        ${iconButton("favorite-band-btn", "star", bandFav ? "Remover artista dos favoritos" : "Favoritar artista", bandFav)}
        ${iconButton("explore-btn", "search", "Buscar álbuns do artista")}
        ${iconButton("collection-btn", "plus", "Adicionar à coleção")}
        ${iconButton("share-btn", "share", "Compartilhar")}
      </div>
    `;

    // CSP blocks inline style attributes, so the gradient is set through the CSSOM.
    card.querySelector(".artist-placeholder").style.setProperty("--tile", artistGradient(artista.nome));
    card.querySelector(".favorite-band-btn").addEventListener("click", () => context.toggleBandFavorite(artista));
    card.querySelector(".explore-btn").addEventListener("click", () => context.exploreArtistAlbums(artista));
    bindCommon(card, artista, context);
    return card;
  }

  function criarResultadoCard(item, context) {
    if (item.tipo === "song") return criarMusicaCard(item, context);
    if (item.tipo === "artist") return criarArtistaCard(item, context);
    return criarAlbumCard(item, context);
  }

  window.WikibandCards = {
    artistGradient,
    criarResultadoCard
  };
})(window);
