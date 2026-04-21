const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const genreFilter = document.getElementById("genreFilter");
const bandsGrid = document.getElementById("bandsGrid");
const statusText = document.getElementById("status");
const historyList = document.getElementById("historyList");
const favoritesList = document.getElementById("favoritesList");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const clearFavoritesButton = document.getElementById("clearFavoritesButton");

const PLACEHOLDER_IMAGEM = "https://via.placeholder.com/600x400?text=Sem+Imagem";

let ultimoResultadoBruto = [];
let debounceTimer = null;

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

function isFavorite(albumId) {
  return getFavorites().some((item) => item.albumId === albumId);
}

function toggleFavorite(banda) {
  let favorites = getFavorites();

  if (favorites.some((item) => item.albumId === banda.albumId)) {
    favorites = favorites.filter((item) => item.albumId !== banda.albumId);
  } else {
    favorites.unshift(banda);
  }

  function getBandaFavorites() {
    return JSON.parse(localStorage.getItem("wikiband_band_favorites")) || [];
  }

  function saveBandFavorites(favorites) {
    localStorage.setItem("wikiband_band_favorites", JSON.stringify(favorites));
  }

  function isBandFavorite(bandaId) {
    return getBandaFavorites().some((item) => item.bandaId === bandaId);
  }

  function toggleFavorite(banda) {
    let favorites = getBandaFavorites();

    if (favorites.some((item) => item.bandaId === bandaId)) {
      favorites = favorites.filter((item) => item.bandaId != banda.bandaId);

    } else {
      favorites.unshift(banda);
    }
    saveBandFavorites(favorites);
  }
}



saveFavorites(favorites); {
  renderFavorites();
  aplicarFiltroGenero();
}

function abrirDetalhes(banda) {
  sessionStorage.setItem("bandaSelecionada", JSON.stringify(banda));
  window.open("banda.html", "_blank");
}

function montarBanda(item) {
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

  return {
    nome,
    genero,
    pais,
    album,
    lancamento,
    imagem,
    albumId: item.collectionId,
    bandaId: item.artistId,
    spotifyLink: `https://open.spotify.com/search/${encodeURIComponent(nome)}`,
    youtubeLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(nome)}`
  };
}

function criarCard(banda) {
  const card = document.createElement("div");
  card.className = "band-card";

  card.innerHTML = `
    <img src="${banda.imagem}" class="band-image" alt="${banda.nome}">
    <div class="band-content">
      <h3>${banda.nome}</h3>
      <span class="tag">${banda.genero}</span>
      <p><strong>País:</strong> ${banda.pais}</p>
      <p><strong>Álbum:</strong> ${banda.album}</p>
      <p><strong>Lançamento:</strong> ${banda.lancamento}</p>

      <div class="card-actions">
        <button class="secondary-btn favorite-btn ${isFavorite(banda.albumId) ? "active" : ""}">
          ${isFavorite(banda.albumId) ? "Remover album" : "Favoritar album"}
        </button>

        <button class="secondary-btn favorite-band-btn ${isBandFavorite(banda.bandaId) ? "active" : ""}" >
          ${isBandFavorite(banda.bandaId) ? "Remover banda" : "Favoritar banda"}
        </button>

      </div>
    </div>
  `;

  const favoriteBtn = card.querySelector(".favorite-btn");
  const favoriteBtn = card.querySelector(".favorite-band-btn");

  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    abrirDetalhes(banda);
  });


  favoriteBtn.addEventListener("click", () => {
    toggleFavorite(banda);
  });

  favoriteBandBtn.addEventListener("click", () => {
    toggleBandFavorite(banda);
    aplicarFiltroGenero();
  });

  return card;
}

function preencherFiltroGenero(listaBandas) {
  const generoAtual = genreFilter.value;

  const generos = [...new Set(listaBandas.map((banda) => banda.genero).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  genreFilter.innerHTML = `<option value="todos">Todos os gêneros</option>`;

  generos.forEach((genero) => {
    const option = document.createElement("option");
    option.value = genero;
    option.textContent = genero;
    genreFilter.appendChild(option);
  });

  const generoExiste = generos.includes(generoAtual);
  genreFilter.value = generoExiste ? generoAtual : "todos";
}

function renderizarResultados(lista) {
  bandsGrid.innerHTML = "";

  if (!lista.length) {
    bandsGrid.innerHTML = `<p class="vazio">Nenhum resultado encontrado.</p>`;
    statusText.textContent = "Nenhum resultado encontrado.";
    return;
  }

  statusText.textContent = `${lista.length} resultado(s) encontrado(s).`;

  lista.forEach((banda) => {
    bandsGrid.appendChild(criarCard(banda));
  });
}

function aplicarFiltroGenero() {
  const generoSelecionado = genreFilter.value;

  const bandasConvertidas = ultimoResultadoBruto.map(montarBanda);

  const listaFiltrada =
    generoSelecionado === "todos"
      ? bandasConvertidas
      : bandasConvertidas.filter((banda) => banda.genero === generoSelecionado);

  renderizarResultados(listaFiltrada);
}

async function pesquisarBandas(saveTerm = true) {
  const termo = searchInput.value.trim();

  if (!termo) {
    statusText.textContent = "Digite algo para pesquisar.";
    bandsGrid.innerHTML = "";
    genreFilter.innerHTML = `<option value="todos">Todos os gêneros</option>`;
    ultimoResultadoBruto = [];
    return;
  }

  statusText.textContent = "Pesquisando...";
  bandsGrid.innerHTML = `<div class="loading">Buscando resultados musicais...</div>`;

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      termo
    )}&media=music&entity=album&limit=24`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    ultimoResultadoBruto = dados.results || [];

    const bandasConvertidas = ultimoResultadoBruto.map(montarBanda);
    preencherFiltroGenero(bandasConvertidas);
    aplicarFiltroGenero();

    if (saveTerm && termo.length >= 2 && ultimoResultadoBruto.length > 0) {
      addToHistory(termo);
    }
  } catch (erro) {
    console.error("Erro ao buscar bandas:", erro);
    ultimoResultadoBruto = [];
    bandsGrid.innerHTML = `<p class="vazio">Não foi possível carregar os resultados agora.</p>`;
    statusText.textContent = "Erro ao carregar resultados.";
  }
}

function pesquisarComDebounce() {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    const termo = searchInput.value.trim();

    if (termo.length >= 2) {
      pesquisarBandas(false);
    } else if (termo.length === 0) {
      statusText.textContent = "Pesquise algo para começar.";
      bandsGrid.innerHTML = "";
      genreFilter.innerHTML = `<option value="todos">Todos os gêneros</option>`;
      ultimoResultadoBruto = [];
    }
  }, 700);
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
      <button class="ver-favorito">Ver detalhes</button>
      <button class="remover-favorito danger mini-btn">Remover</button>
    `;

    item.querySelector(".ver-favorito").addEventListener("click", () => {
      abrirDetalhes(banda);
    });

    item.querySelector(".remover-favorito").addEventListener("click", () => {
      toggleFavorite(banda);
    });

    favoritesList.appendChild(item);
  });
}

searchButton.addEventListener("click", () => pesquisarBandas(true));

searchInput.addEventListener("input", pesquisarComDebounce);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    clearTimeout(debounceTimer);
    pesquisarBandas(true);
  }
});

genreFilter.addEventListener("change", aplicarFiltroGenero);

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_history");
  renderHistory();
});

clearFavoritesButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_favorites");
  renderFavorites();
  aplicarFiltroGenero();
});

renderHistory();
renderFavorites();
