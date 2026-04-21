const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const genreFilter = document.getElementById("genreFilter");
const sortSelect = document.getElementById("sortSelect");
const showAlternativesToggle = document.getElementById("showAlternativesToggle");
const bandsGrid = document.getElementById("bandsGrid");
const statusText = document.getElementById("status");
const historyList = document.getElementById("historyList");
const favoritesList = document.getElementById("favoritesList");
const bandFavoritesList = document.getElementById("bandFavoritesList");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const clearFavoritesButton = document.getElementById("clearFavoritesButton");
const clearBandFavoritesButton = document.getElementById("clearBandFavoritesButton");
const modeButtons = document.querySelectorAll(".mode-btn");

const Storage = window.WikibandStorage;
const Results = window.WikibandResults;
const Cards = window.WikibandCards;
const Sidebar = window.WikibandSidebar;
const Share = window.WikibandShare;

let ultimoResultadoBruto = [];
let debounceTimer = null;
let searchType = "album";

function getSearchOptions() {
  return {
    mostrarAlternativas: showAlternativesToggle.checked,
    searchType
  };
}

function abrirDetalhes(item) {
  sessionStorage.setItem("bandaSelecionada", JSON.stringify(item));
  window.open("/banda", "_blank");
}

function explorarAlbunsDoArtista(artista) {
  searchType = "album";
  searchInput.value = artista.nome;
  atualizarModoBusca();
  pesquisarBandas(false);
}

function montarResultado(item) {
  return Results.montarResultado(item, searchType);
}

function converterResultados() {
  return ultimoResultadoBruto.map(montarResultado);
}

function filtrarAlternativas(lista) {
  return Results.filtrarVersoesAlternativas(lista, getSearchOptions());
}

function obterListaFiltrada() {
  const generoSelecionado = genreFilter.value;
  const semAlternativas = filtrarAlternativas(converterResultados());
  const filtrados =
    generoSelecionado === "todos"
      ? semAlternativas
      : semAlternativas.filter((item) => item.genero === generoSelecionado);

  return Results.ordenarResultados(filtrados, sortSelect.value);
}

function preencherFiltroGenero(lista) {
  const generoAtual = genreFilter.value;
  const generos = [...new Set(lista.map((item) => item.genero).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  genreFilter.innerHTML = `<option value="todos">Todos os gêneros</option>`;

  generos.forEach((genero) => {
    const option = document.createElement("option");
    option.value = genero;
    option.textContent = genero;
    genreFilter.appendChild(option);
  });

  genreFilter.value = generos.includes(generoAtual) ? generoAtual : "todos";
}

async function tocarPreviewAlbum(album, card, previewBtn) {
  const previewArea = card.querySelector(".preview-area");
  previewBtn.disabled = true;
  previewBtn.textContent = "Carregando...";
  previewArea.innerHTML = `<p class="preview-status">Buscando prévia...</p>`;

  try {
    const preview = await WikiPreview.getFirstPreview(album);

    if (!preview) {
      previewArea.innerHTML = `<p class="preview-status">Prévia indisponível para este álbum.</p>`;
      previewBtn.textContent = "Tocar prévia";
      return;
    }

    previewArea.innerHTML = `<p class="preview-status"><strong>Prévia:</strong> ${preview.nome}</p>`;
    previewBtn.disabled = false;
    WikiPreview.playTrack(preview, album, previewBtn);
  } catch (erro) {
    console.error("Erro ao carregar prévia:", erro);
    previewArea.innerHTML = `<p class="preview-status">Não foi possível carregar a prévia agora.</p>`;
    previewBtn.textContent = "Tocar prévia";
  } finally {
    previewBtn.disabled = false;
  }
}

function tocarPreviewMusica(musica, previewBtn) {
  if (!musica.previewUrl) return;

  const faixa = {
    id: musica.trackId,
    nome: musica.musica,
    artista: musica.nome,
    album: musica.album,
    previewUrl: musica.previewUrl,
    imagem: musica.imagem
  };

  WikiPreview.playTrack(faixa, musica, previewBtn);
}

function toggleAlbumFavorite(album) {
  Storage.toggleAlbumFavorite(album);
  renderFavorites();
  aplicarFiltrosERenderizar();
}

function toggleBandFavorite(banda) {
  Storage.toggleBandFavorite(banda);
  renderBandFavorites();
  aplicarFiltrosERenderizar();
}

function getCardContext() {
  return {
    exploreArtistAlbums: explorarAlbunsDoArtista,
    isAlbumFavorite: Storage.isAlbumFavorite,
    isBandFavorite: Storage.isBandFavorite,
    openDetails: abrirDetalhes,
    playAlbumPreview: tocarPreviewAlbum,
    playSongPreview: tocarPreviewMusica,
    shareItem: Share.compartilharItem,
    toggleAlbumFavorite,
    toggleBandFavorite
  };
}

function renderizarResultados(lista) {
  bandsGrid.innerHTML = "";

  if (!lista.length) {
    bandsGrid.innerHTML = `<p class="vazio">Nenhum resultado encontrado.</p>`;
    statusText.textContent = "Nenhum resultado encontrado.";
    return;
  }

  statusText.textContent = `${lista.length} ${Results.obterTipoTexto(searchType)} encontrado(s).`;

  lista.forEach((item) => {
    bandsGrid.appendChild(Cards.criarResultadoCard(item, getCardContext()));
  });
}

function aplicarFiltrosERenderizar() {
  renderizarResultados(obterListaFiltrada());
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
    )}&media=music&entity=${Results.ENTIDADES_BUSCA[searchType]}&limit=50`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    ultimoResultadoBruto = dados.results || [];
    preencherFiltroGenero(filtrarAlternativas(converterResultados()));
    aplicarFiltrosERenderizar();

    if (saveTerm && termo.length >= 2 && ultimoResultadoBruto.length > 0) {
      Storage.addHistoryTerm(termo, searchType);
      renderHistory();
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

function atualizarModoBusca() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.searchType === searchType);
  });

  searchInput.placeholder =
    searchType === "song"
      ? "Digite o nome de uma música..."
      : searchType === "artist"
        ? "Digite o nome de um artista..."
        : "Digite o nome de uma banda ou artista...";

  showAlternativesToggle.disabled = searchType === "artist";
}

function renderHistory() {
  Sidebar.renderHistory({
    container: historyList,
    getModeLabel: Results.obterNomeModo,
    history: Storage.getHistory(),
    onSearchAgain: ({ term, type }) => {
      searchType = type;
      searchInput.value = term;
      atualizarModoBusca();
      pesquisarBandas(false);
    }
  });
}

function renderFavorites() {
  Sidebar.renderAlbumFavorites({
    container: favoritesList,
    favorites: Storage.getAlbumFavorites(),
    onOpenDetails: abrirDetalhes,
    onRemove: toggleAlbumFavorite
  });
}

function renderBandFavorites() {
  Sidebar.renderBandFavorites({
    container: bandFavoritesList,
    favorites: Storage.getBandFavorites(),
    onExploreArtist: explorarAlbunsDoArtista,
    onOpenDetails: abrirDetalhes,
    onRemove: toggleBandFavorite
  });
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    searchType = button.dataset.searchType;
    atualizarModoBusca();
    if (searchInput.value.trim().length >= 2) {
      pesquisarBandas(false);
    }
  });
});

searchButton.addEventListener("click", () => pesquisarBandas(true));
searchInput.addEventListener("input", pesquisarComDebounce);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    clearTimeout(debounceTimer);
    pesquisarBandas(true);
  }
});

genreFilter.addEventListener("change", aplicarFiltrosERenderizar);
sortSelect.addEventListener("change", aplicarFiltrosERenderizar);
showAlternativesToggle.addEventListener("change", () => {
  preencherFiltroGenero(filtrarAlternativas(converterResultados()));
  aplicarFiltrosERenderizar();
});

clearHistoryButton.addEventListener("click", () => {
  Storage.clearHistory();
  renderHistory();
});

clearFavoritesButton.addEventListener("click", () => {
  Storage.clearAlbumFavorites();
  renderFavorites();
  aplicarFiltrosERenderizar();
});

clearBandFavoritesButton.addEventListener("click", () => {
  Storage.clearBandFavorites();
  renderBandFavorites();
  aplicarFiltrosERenderizar();
});

atualizarModoBusca();
renderHistory();
renderFavorites();
renderBandFavorites();
