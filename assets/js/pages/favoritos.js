const albumFavoritesGrid = document.getElementById("albumFavoritesGrid");
const bandFavoritesGrid = document.getElementById("bandFavoritesGrid");
const clearAlbumFavoritesButton = document.getElementById("clearAlbumFavoritesButton");
const clearBandFavoritesPageButton = document.getElementById("clearBandFavoritesPageButton");
const startFavoritesRadioButton = document.getElementById("startFavoritesRadioButton");
const stopRadioFavoritesButton = document.getElementById("stopRadioFavoritesButton");
const dashboardGrid = document.getElementById("dashboardGrid");
const topGenresList = document.getElementById("topGenresList");
const topArtistsList = document.getElementById("topArtistsList");
const topDecadesList = document.getElementById("topDecadesList");
const clearPlayHistoryButton = document.getElementById("clearPlayHistoryButton");
const createCollectionButton = document.getElementById("createCollectionButton");
const collectionsList = document.getElementById("collectionsList");

const Storage = window.WikibandStorage;
const Links = window.WikibandLinks;

function abrirDetalhes(item) {
  const detailUrl = Links?.buildDetailUrl(item) || "/banda.html";
  sessionStorage.setItem("bandaSelecionada", JSON.stringify(item));
  window.location.href = detailUrl;
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

function adicionarEmColecao(item, onDone) {
  const collections = Storage.getCollections();

  if (!collections.length) {
    const nomeNova = window.prompt("Nome da nova coleção:");

    if (!nomeNova) return;

    const collection = Storage.ensureCollectionByName(nomeNova);

    if (!collection) return;

    Storage.addItemToCollection(collection.id, item);
    onDone(`Item salvo em "${collection.name}".`);
    renderCollections();
    renderDashboard();
    return;
  }

  const menu = collections.map((collection, index) => `${index + 1}. ${collection.name}`).join("\n");
  const entrada = window.prompt(`Digite o número da coleção ou um novo nome:\n\n${menu}`);

  if (!entrada) return;

  const indice = Number(entrada);
  const collection =
    Number.isInteger(indice) && indice >= 1 && indice <= collections.length
      ? collections[indice - 1]
      : Storage.ensureCollectionByName(entrada);

  if (!collection) return;

  Storage.addItemToCollection(collection.id, item);
  onDone(`Item salvo em "${collection.name}".`);
  renderCollections();
  renderDashboard();
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
        <button class="secondary-btn collection-btn" type="button">Coleção</button>
        <button class="danger mini-btn remove-btn" type="button">Remover</button>
      </div>
      <p class="preview-status"></p>
    </div>
  `;

  const previewBtn = card.querySelector(".preview-btn");
  const detailsBtn = card.querySelector(".details-btn");
  const collectionBtn = card.querySelector(".collection-btn");
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

  collectionBtn.addEventListener("click", () => {
    adicionarEmColecao(album, (mensagem) => {
      status.textContent = mensagem;
    });
  });

  removeBtn.addEventListener("click", () => {
    Storage.toggleAlbumFavorite(album);
    renderAlbumFavorites();
    renderDashboard();
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
        <button class="secondary-btn collection-btn" type="button">Coleção</button>
        <button class="danger mini-btn remove-btn" type="button">Remover</button>
      </div>
      <p class="preview-status"></p>
    </div>
  `;

  const detailsBtn = card.querySelector(".details-btn");
  const collectionBtn = card.querySelector(".collection-btn");
  const removeBtn = card.querySelector(".remove-btn");
  const status = card.querySelector(".preview-status");

  detailsBtn.addEventListener("click", () => {
    abrirDetalhes(banda);
  });

  collectionBtn.addEventListener("click", () => {
    adicionarEmColecao(banda, (mensagem) => {
      status.textContent = mensagem;
    });
  });

  removeBtn.addEventListener("click", () => {
    Storage.toggleBandFavorite(banda);
    renderBandFavorites();
    renderDashboard();
  });

  return card;
}

function renderAlbumFavorites() {
  const favorites = Storage.getAlbumFavorites();

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
  const favorites = Storage.getBandFavorites();

  if (!favorites.length) {
    bandFavoritesGrid.innerHTML = `<p class="vazio">Nenhuma banda favorita salva.</p>`;
    return;
  }

  bandFavoritesGrid.innerHTML = "";
  favorites.forEach((banda) => {
    bandFavoritesGrid.appendChild(criarBandaFavorita(banda));
  });
}

function renderInsightList(container, items, emptyText) {
  if (!items.length) {
    container.innerHTML = `<p class="vazio">${emptyText}</p>`;
    return;
  }

  container.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "insight-row";
    row.innerHTML = `<strong>${item.label}</strong><span>${item.total}</span>`;
    container.appendChild(row);
  });
}

function renderDashboard() {
  const dashboard = Storage.getDashboardData();

  dashboardGrid.innerHTML = `
    <article class="stat-card">
      <p>Pesquisas salvas</p>
      <strong>${dashboard.totals.searches}</strong>
    </article>
    <article class="stat-card">
      <p>Álbuns favoritos</p>
      <strong>${dashboard.totals.albumFavorites}</strong>
    </article>
    <article class="stat-card">
      <p>Bandas favoritas</p>
      <strong>${dashboard.totals.bandFavorites}</strong>
    </article>
    <article class="stat-card">
      <p>Reproduções</p>
      <strong>${dashboard.totals.plays}</strong>
    </article>
    <article class="stat-card">
      <p>Coleções</p>
      <strong>${dashboard.totals.collections}</strong>
    </article>
  `;

  renderInsightList(topGenresList, dashboard.topGenres, "Sem gêneros suficientes ainda.");
  renderInsightList(topArtistsList, dashboard.topArtists, "Sem artistas suficientes ainda.");
  renderInsightList(topDecadesList, dashboard.topDecades, "Sem décadas suficientes ainda.");
}

function createCollectionCard(collection) {
  const card = document.createElement("article");
  card.className = "collection-card";

  const itemsHtml = collection.items.length
    ? collection.items
        .map(
          (saved) => `
      <div class="collection-item" data-key="${saved.key}">
        <div>
          <strong>${saved.item.musica || saved.item.album || saved.item.nome}</strong>
          <p>${saved.item.nome || "Artista"}</p>
        </div>
        <div class="collection-item-actions">
          <button class="mini-btn open-item" type="button">Abrir</button>
          <button class="mini-btn danger remove-item" type="button">Remover</button>
        </div>
      </div>
    `
        )
        .join("")
    : `<p class="vazio">Esta coleção ainda está vazia.</p>`;

  card.innerHTML = `
    <div class="collection-header">
      <h3>${collection.name}</h3>
      <div class="painel-header-actions">
        <button class="mini-btn rename-collection" type="button">Renomear</button>
        <button class="mini-btn danger delete-collection" type="button">Excluir</button>
      </div>
    </div>
    <div class="collection-items">${itemsHtml}</div>
  `;

  card.querySelector(".rename-collection").addEventListener("click", () => {
    const novoNome = window.prompt("Novo nome da coleção:", collection.name);

    if (!novoNome) return;

    Storage.renameCollection(collection.id, novoNome);
    renderCollections();
    renderDashboard();
  });

  card.querySelector(".delete-collection").addEventListener("click", () => {
    Storage.deleteCollection(collection.id);
    renderCollections();
    renderDashboard();
  });

  card.querySelectorAll(".collection-item").forEach((itemEl) => {
    const itemKey = itemEl.dataset.key;
    const saved = collection.items.find((entry) => entry.key === itemKey);

    if (!saved) return;

    itemEl.querySelector(".open-item")?.addEventListener("click", () => {
      abrirDetalhes(saved.item);
    });

    itemEl.querySelector(".remove-item")?.addEventListener("click", () => {
      Storage.removeItemFromCollection(collection.id, itemKey);
      renderCollections();
      renderDashboard();
    });
  });

  return card;
}

function renderCollections() {
  const collections = Storage.getCollections();

  if (!collections.length) {
    collectionsList.innerHTML = `<p class="vazio">Nenhuma coleção criada ainda.</p>`;
    return;
  }

  collectionsList.innerHTML = "";

  collections.forEach((collection) => {
    collectionsList.appendChild(createCollectionCard(collection));
  });
}

clearAlbumFavoritesButton.addEventListener("click", () => {
  Storage.clearAlbumFavorites();
  WikiPreview.stop();
  renderAlbumFavorites();
  renderDashboard();
});

clearBandFavoritesPageButton.addEventListener("click", () => {
  Storage.clearBandFavorites();
  renderBandFavorites();
  renderDashboard();
});

startFavoritesRadioButton.addEventListener("click", async () => {
  const favorites = Storage.getAlbumFavorites();

  if (!favorites.length) {
    return;
  }

  try {
    await WikiPreview.startRadio(favorites, { label: "Rádio dos favoritos" });
  } catch (erro) {
    console.warn("Não foi possível iniciar rádio dos favoritos:", erro);
  }
});

stopRadioFavoritesButton.addEventListener("click", () => {
  WikiPreview.stop();
});

clearPlayHistoryButton.addEventListener("click", () => {
  Storage.clearPlayHistory();
  renderDashboard();
});

createCollectionButton.addEventListener("click", () => {
  const nome = window.prompt("Nome da coleção:");

  if (!nome) return;

  Storage.ensureCollectionByName(nome);
  renderCollections();
  renderDashboard();
});

renderAlbumFavorites();
renderBandFavorites();
renderDashboard();
renderCollections();
