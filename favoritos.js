const albumFavoritesGrid = document.getElementById("albumFavoritesGrid");
const bandFavoritesGrid = document.getElementById("bandFavoritesGrid");
const clearAlbumFavoritesButton = document.getElementById("clearAlbumFavoritesButton");
const clearBandFavoritesPageButton = document.getElementById("clearBandFavoritesPageButton");

function getAlbumFavorites() {
  return JSON.parse(localStorage.getItem("wikiband_favorites")) || [];
}

function saveAlbumFavorites(favorites) {
  localStorage.setItem("wikiband_favorites", JSON.stringify(favorites));
}

function getBandFavorites() {
  return JSON.parse(localStorage.getItem("wikiband_band_favorites")) || [];
}

function saveBandFavorites(favorites) {
  localStorage.setItem("wikiband_band_favorites", JSON.stringify(favorites));
}

function abrirDetalhes(item) {
  sessionStorage.setItem("bandaSelecionada", JSON.stringify(item));
  window.location.href = "/banda";
}

async function tocarPreviewAlbum(album, button, status) {
  button.disabled = true;
  button.textContent = "Carregando...";
  status.textContent = "Buscando prévia...";

  try {
    const preview = await WikiPreview.getFirstPreview(album);

    if (!preview) {
      status.textContent = "Prévia indisponível para este álbum.";
      button.textContent = "Tocar prévia";
      return;
    }

    status.textContent = `Prévia: ${preview.nome}`;
    button.disabled = false;
    WikiPreview.playTrack(preview, album, button);
  } catch (erro) {
    console.error("Erro ao carregar prévia:", erro);
    status.textContent = "Não foi possível carregar a prévia agora.";
    button.textContent = "Tocar prévia";
  } finally {
    button.disabled = false;
  }
}

function criarAlbumFavorito(album) {
  const card = document.createElement("article");
  card.className = "favorite-card";

  card.innerHTML = `
    <img src="${album.imagem}" alt="${album.album || album.nome}">
    <div class="favorite-card-body">
      <h3>${album.album || album.nome}</h3>
      <p>${album.nome}</p>
      <span class="tag">${album.genero}</span>
      <p><strong>Lançamento:</strong> ${album.lancamento}</p>
      <div class="favorite-card-actions">
        <button class="primary-btn preview-btn" type="button">Tocar prévia</button>
        <button class="secondary-btn details-btn" type="button">Ver detalhes</button>
        <button class="danger mini-btn remove-btn" type="button">Remover</button>
      </div>
      <p class="preview-status"></p>
    </div>
  `;

  const previewBtn = card.querySelector(".preview-btn");
  const detailsBtn = card.querySelector(".details-btn");
  const removeBtn = card.querySelector(".remove-btn");
  const status = card.querySelector(".preview-status");

  previewBtn.dataset.previewIdleText = "Tocar prévia";
  previewBtn.dataset.previewPlayingText = "Pausar prévia";

  previewBtn.addEventListener("click", () => {
    tocarPreviewAlbum(album, previewBtn, status);
  });

  detailsBtn.addEventListener("click", () => {
    abrirDetalhes(album);
  });

  removeBtn.addEventListener("click", () => {
    const favorites = getAlbumFavorites().filter((item) => item.albumId !== album.albumId);
    saveAlbumFavorites(favorites);
    renderAlbumFavorites();
  });

  return card;
}

function criarBandaFavorita(banda) {
  const card = document.createElement("article");
  card.className = "favorite-card";

  card.innerHTML = `
    <img src="${banda.imagem}" alt="${banda.nome}">
    <div class="favorite-card-body">
      <h3>${banda.nome}</h3>
      <span class="tag">${banda.genero}</span>
      <p><strong>País:</strong> ${banda.pais}</p>
      <p><strong>Referência salva:</strong> ${banda.album}</p>
      <div class="favorite-card-actions">
        <button class="secondary-btn details-btn" type="button">Ver detalhes</button>
        <button class="danger mini-btn remove-btn" type="button">Remover</button>
      </div>
    </div>
  `;

  card.querySelector(".details-btn").addEventListener("click", () => {
    abrirDetalhes(banda);
  });

  card.querySelector(".remove-btn").addEventListener("click", () => {
    const favorites = getBandFavorites().filter((item) => item.bandaId !== banda.bandaId);
    saveBandFavorites(favorites);
    renderBandFavorites();
  });

  return card;
}

function renderAlbumFavorites() {
  const favorites = getAlbumFavorites();

  if (!favorites.length) {
    albumFavoritesGrid.innerHTML = `<p class="vazio">Nenhum álbum favorito salvo.</p>`;
    return;
  }

  albumFavoritesGrid.innerHTML = "";
  favorites.forEach((album) => {
    albumFavoritesGrid.appendChild(criarAlbumFavorito(album));
  });
}

function renderBandFavorites() {
  const favorites = getBandFavorites();

  if (!favorites.length) {
    bandFavoritesGrid.innerHTML = `<p class="vazio">Nenhuma banda favorita salva.</p>`;
    return;
  }

  bandFavoritesGrid.innerHTML = "";
  favorites.forEach((banda) => {
    bandFavoritesGrid.appendChild(criarBandaFavorita(banda));
  });
}

clearAlbumFavoritesButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_favorites");
  WikiPreview.stop();
  renderAlbumFavorites();
});

clearBandFavoritesPageButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_band_favorites");
  renderBandFavorites();
});

renderAlbumFavorites();
renderBandFavorites();
