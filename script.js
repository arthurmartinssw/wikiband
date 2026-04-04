const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const bandsGrid = document.getElementById("bandsGrid");
const statusText = document.getElementById("status");
const historyList = document.getElementById("historyList");
const favoritesList = document.getElementById("favoritesList");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const clearFavoritesButton = document.getElementById("clearFavoritesButton");

const PLACEHOLDER_IMAGEM = "https://via.placeholder.com/600x400?text=Sem+Imagem";

function getHistory() {
  return JSON.parse(localStorage.getItem("wikiband_history")) || [];
}

function saveHistory(history) {
  localStorage.setItem("wikiband_history", JSON.stringify(history));
}

function addToHistory(term) {
  let history = getHistory().filter((item) => item.toLowerCase() !== term.toLowerCase());
  history.unshift(term);
  history = history.slice(0, 8);
  saveHistory(history);
  renderHistory();
}

function getFavorites() {
  return JSON.parse(localStorage.getItem("wikiband_favorites")) || [];
}

function saveFavorites(favorites) {
  localStorage.setItem("wikiband_favorites", JSON.stringify(favorites));
}

function isFavorite(nome) {
  return getFavorites().some((item) => item.nome === nome);
}

function toggleFavorite(banda) {
  let favorites = getFavorites();

  if (favorites.some((item) => item.nome === banda.nome)) {
    favorites = favorites.filter((item) => item.nome !== banda.nome);
  } else {
    favorites.unshift(banda);
  }

  saveFavorites(favorites);
  renderFavorites();
  pesquisarBandas(false);
}

function abrirDetalhes(banda) {
  sessionStorage.setItem("bandaSelecionada", JSON.stringify(banda));
  window.open("banda.html", "_blank");
}

function criarCard(item) {
  const card = document.createElement("div");
  card.className = "band-card";

  const imagem = item.artworkUrl100
    ? item.artworkUrl100.replace("100x100bb", "600x600bb")
    : PLACEHOLDER_IMAGEM;

  const nome = item.artistName || "Artista desconhecido";
  const genero = item.primaryGenreName || "Gênero não informado";
  const pais = item.country || "País não informado";
  const album = item.collectionName || "Álbum não informado";
  const lancamento = item.releaseDate
    ? new Date(item.releaseDate).getFullYear()
    : "Ano não informado";

  const banda = {
    nome,
    genero,
    pais,
    album,
    lancamento,
    imagem,
    spotifyLink: `https://open.spotify.com/search/${encodeURIComponent(nome)}`,
    youtubeLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(nome)}`
  };

  card.innerHTML = `
    <img src="${imagem}" class="band-image" alt="${nome}">
    <div class="band-content">
      <h3>${nome}</h3>
      <span class="tag">${genero}</span>
      <p><strong>País:</strong> ${pais}</p>
      <p><strong>Álbum:</strong> ${album}</p>
      <p><strong>Lançamento:</strong> ${lancamento}</p>

      <div class="card-actions">
        <button class="primary-btn detalhes-btn">Detalhes</button>
        <button class="secondary-btn favorite-btn ${isFavorite(nome) ? "active" : ""}">
          ${isFavorite(nome) ? "Remover favorito" : "Favoritar"}
        </button>
      </div>
    </div>
  `;

  const detalhesBtn = card.querySelector(".detalhes-btn");
  const favoriteBtn = card.querySelector(".favorite-btn");

  detalhesBtn.addEventListener("click", () => abrirDetalhes(banda));

  favoriteBtn.addEventListener("click", () => {
    toggleFavorite(banda);
  });

  return card;
}

function renderizarResultados(lista) {
  bandsGrid.innerHTML = "";

  if (!lista.length) {
    bandsGrid.innerHTML = `<p class="vazio">Nenhum resultado encontrado.</p>`;
    statusText.textContent = "Nenhum resultado encontrado.";
    return;
  }

  statusText.textContent = `${lista.length} resultado(s) encontrado(s).`;

  lista.forEach((item) => {
    bandsGrid.appendChild(criarCard(item));
  });
}

async function pesquisarBandas(saveTerm = true) {
  const termo = searchInput.value.trim();

  if (!termo) {
    statusText.textContent = "Digite algo para pesquisar.";
    bandsGrid.innerHTML = "";
    return;
  }

  if (saveTerm) {
    addToHistory(termo);
  }

  statusText.textContent = "Pesquisando...";
  bandsGrid.innerHTML = `<div class="loading">Buscando resultados musicais...</div>`;

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      termo
    )}&media=music&entity=album&limit=18`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    renderizarResultados(dados.results || []);
  } catch (erro) {
    console.error("Erro ao buscar bandas:", erro);
    bandsGrid.innerHTML = `<p class="vazio">Não foi possível carregar os resultados agora.</p>`;
    statusText.textContent = "Erro ao carregar resultados.";
  }
}

function renderHistory() {
  const history = getHistory();

  if (!history.length) {
    historyList.innerHTML = `<p class="vazio">Nenhuma pesquisa ainda.</p>`;
    return;
  }

  historyList.innerHTML = "";

  history.forEach((term) => {
    const item = document.createElement("div");
    item.className = "item-lateral";
    item.innerHTML = `
      <strong>${term}</strong>
      <button>Pesquisar de novo</button>
    `;

    item.querySelector("button").addEventListener("click", () => {
      searchInput.value = term;
      pesquisarBandas(false);
    });

    historyList.appendChild(item);
  });
}

function renderFavorites() {
  const favorites = getFavorites();

  if (!favorites.length) {
    favoritesList.innerHTML = `<p class="vazio">Nenhum favorito salvo.</p>`;
    return;
  }

  favoritesList.innerHTML = "";

  favorites.forEach((banda) => {
    const item = document.createElement("div");
    item.className = "item-lateral";
    item.innerHTML = `
      <strong>${banda.nome}</strong>
      <p>${banda.genero}</p>
      <button>Ver detalhes</button>
    `;

    item.querySelector("button").addEventListener("click", () => {
      abrirDetalhes(banda);
    });

    favoritesList.appendChild(item);
  });
}

searchButton.addEventListener("click", () => pesquisarBandas(true));

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    pesquisarBandas(true);
  }
});

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_history");
  renderHistory();
});

clearFavoritesButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_favorites");
  renderFavorites();
  if (searchInput.value.trim()) {
    pesquisarBandas(false);
  }
});

renderHistory();
renderFavorites();