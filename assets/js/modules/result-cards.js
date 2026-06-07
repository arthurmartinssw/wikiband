(function initWikibandCards(window) {
  const Safe = window.WikibandSafe;
  const escapeHtml = Safe?.escapeHtml || ((value) => String(value ?? ""));
  const safeImageUrl = Safe?.safeImageUrl || ((value) => String(value || ""));

  function criarAlbumCard(album, context) {
    const card = document.createElement("div");
    card.className = "band-card";

    card.innerHTML = `
      <img src="${safeImageUrl(album.imagem)}" class="band-image" alt="${escapeHtml(album.album)}">
      <div class="band-content">
        <h3>${escapeHtml(album.nome)}</h3>
        <span class="tag">${escapeHtml(album.genero)}</span>
        <p><strong>País:</strong> ${escapeHtml(album.pais)}</p>
        <p><strong>Álbum:</strong> ${escapeHtml(album.album)}</p>
        <p><strong>Lançamento:</strong> ${escapeHtml(album.lancamento)}</p>

        <div class="card-actions">
          <button class="primary-btn preview-btn" type="button">Tocar prévia</button>
          <button class="secondary-btn favorite-btn ${context.isAlbumFavorite(album.albumId) ? "active" : ""}" type="button">
            ${context.isAlbumFavorite(album.albumId) ? "Remover álbum" : "Favoritar álbum"}
          </button>
          <button class="secondary-btn favorite-band-btn ${context.isBandFavorite(album.bandaId) ? "active" : ""}" type="button">
            ${context.isBandFavorite(album.bandaId) ? "Remover banda" : "Favoritar banda"}
          </button>
          <button class="secondary-btn collection-btn" type="button">Coleção</button>
          <button class="secondary-btn share-btn" type="button">Compartilhar</button>
        </div>

        <div class="preview-area" aria-live="polite"></div>
      </div>
    `;

    const previewBtn = card.querySelector(".preview-btn");
    const favoriteBtn = card.querySelector(".favorite-btn");
    const favoriteBandBtn = card.querySelector(".favorite-band-btn");
    const collectionBtn = card.querySelector(".collection-btn");
    const shareBtn = card.querySelector(".share-btn");

    previewBtn.dataset.previewIdleText = "Tocar prévia";
    previewBtn.dataset.previewPlayingText = "Pausar prévia";

    card.addEventListener("click", (event) => {
      if (event.target.closest("button, .preview-area")) return;
      context.openDetails(album);
    });

    previewBtn.addEventListener("click", () => context.playAlbumPreview(album, card, previewBtn));
    favoriteBtn.addEventListener("click", () => context.toggleAlbumFavorite(album));
    favoriteBandBtn.addEventListener("click", () => context.toggleBandFavorite(album));
    collectionBtn.addEventListener("click", () => context.addToCollection(album));
    shareBtn.addEventListener("click", () => context.shareItem(album, shareBtn));

    return card;
  }

  function criarMusicaCard(musica, context) {
    const card = document.createElement("div");
    card.className = "band-card";

    card.innerHTML = `
      <img src="${safeImageUrl(musica.imagem)}" class="band-image" alt="${escapeHtml(musica.musica)}">
      <div class="band-content">
        <h3>${escapeHtml(musica.musica)}</h3>
        <span class="tag">${escapeHtml(musica.genero)}</span>
        <p><strong>Artista:</strong> ${escapeHtml(musica.nome)}</p>
        <p><strong>Álbum:</strong> ${escapeHtml(musica.album)}</p>
        <p><strong>Lançamento:</strong> ${escapeHtml(musica.lancamento)}</p>

        <div class="card-actions">
          <button class="primary-btn preview-btn" type="button" ${musica.previewUrl ? "" : "disabled"}>
            ${musica.previewUrl ? "Tocar prévia" : "Sem prévia"}
          </button>
          <button class="secondary-btn details-btn" type="button">Ver álbum</button>
          <button class="secondary-btn collection-btn" type="button">Coleção</button>
          <button class="secondary-btn share-btn" type="button">Compartilhar</button>
        </div>
      </div>
    `;

    const previewBtn = card.querySelector(".preview-btn");
    const detailsBtn = card.querySelector(".details-btn");
    const collectionBtn = card.querySelector(".collection-btn");
    const shareBtn = card.querySelector(".share-btn");

    previewBtn.dataset.previewIdleText = "Tocar prévia";
    previewBtn.dataset.previewPlayingText = "Pausar prévia";

    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      context.openDetails(musica);
    });

    previewBtn.addEventListener("click", () => context.playSongPreview(musica, previewBtn));
    detailsBtn.addEventListener("click", () => context.openDetails(musica));
    collectionBtn.addEventListener("click", () => context.addToCollection(musica));
    shareBtn.addEventListener("click", () => context.shareItem(musica, shareBtn));

    return card;
  }

  function criarArtistaCard(artista, context) {
    const card = document.createElement("div");
    card.className = "band-card artist-card";

    card.innerHTML = `
      <div class="artist-placeholder">${escapeHtml(artista.nome.charAt(0).toUpperCase())}</div>
      <div class="band-content">
        <h3>${escapeHtml(artista.nome)}</h3>
        <span class="tag">${escapeHtml(artista.genero)}</span>
        <p><strong>Resultado:</strong> Artista</p>

        <div class="card-actions">
          <button class="primary-btn explore-btn" type="button">Ver álbuns</button>
          <button class="secondary-btn favorite-band-btn ${context.isBandFavorite(artista.bandaId) ? "active" : ""}" type="button">
            ${context.isBandFavorite(artista.bandaId) ? "Remover banda" : "Favoritar banda"}
          </button>
          <button class="secondary-btn collection-btn" type="button">Coleção</button>
          <button class="secondary-btn share-btn" type="button">Compartilhar</button>
        </div>
      </div>
    `;

    const exploreBtn = card.querySelector(".explore-btn");
    const favoriteBandBtn = card.querySelector(".favorite-band-btn");
    const collectionBtn = card.querySelector(".collection-btn");
    const shareBtn = card.querySelector(".share-btn");

    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      context.exploreArtistAlbums(artista);
    });

    exploreBtn.addEventListener("click", () => context.exploreArtistAlbums(artista));
    favoriteBandBtn.addEventListener("click", () => context.toggleBandFavorite(artista));
    collectionBtn.addEventListener("click", () => context.addToCollection(artista));
    shareBtn.addEventListener("click", () => context.shareItem(artista, shareBtn));

    return card;
  }

  function criarResultadoCard(item, context) {
    if (item.tipo === "song") return criarMusicaCard(item, context);
    if (item.tipo === "artist") return criarArtistaCard(item, context);
    return criarAlbumCard(item, context);
  }

  window.WikibandCards = {
    criarResultadoCard
  };
})(window);
