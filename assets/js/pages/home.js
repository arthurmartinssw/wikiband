const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const genreFilter = document.getElementById("genreFilter");
const countryFilter = document.getElementById("countryFilter");
const decadeFilter = document.getElementById("decadeFilter");
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
const startRadioResultsButton = document.getElementById("startRadioResultsButton");
const stopRadioButton = document.getElementById("stopRadioButton");
const refreshDiscoveryButton = document.getElementById("refreshDiscoveryButton");
const discoverGenres = document.getElementById("discoverGenres");
const discoverCountries = document.getElementById("discoverCountries");
const discoverDecades = document.getElementById("discoverDecades");

const Storage = window.WikibandStorage;
const Results = window.WikibandResults;
const Cards = window.WikibandCards;
const Sidebar = window.WikibandSidebar;
const Share = window.WikibandShare;
const Links = window.WikibandLinks;
const Safe = window.WikibandSafe;
const escapeHtml = Safe?.escapeHtml || ((value) => String(value ?? ""));

let ultimoResultadoBruto = [];
let debounceTimer = null;
let searchType = "album";
const detalhePrecarregado = new Set();
const DETAIL_PAGE_URL = "/banda.html";
const BIBLIOTECA_INICIAL_TERMOS = {
  album: ["rock", "pop", "mpb", "indie"],
  song: ["top hits", "rock classics", "samba", "love songs"],
  artist: ["rock", "pop", "jazz", "metal"]
};
const BIBLIOTECA_LIMITE_POR_TERMO = 18;
const BIBLIOTECA_MAX_ITENS = 60;
const bibliotecaInicialCache = new Map();
let contextoResultados = "library";
let requestCounter = 0;

function buildApiUrl(path) {
  if (Storage && typeof Storage.buildApiUrl === "function") {
    return Storage.buildApiUrl(path);
  }

  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;
  return `/api${normalizedPath}`;
}

function criarChaveUnicaResultado(item, type) {
  if (type === "song") {
    return String(
      item.trackId ||
        `${item.artistId || item.artistName}-${item.trackName || ""}-${item.collectionId || item.collectionName || ""}`
    );
  }

  if (type === "artist") {
    return String(item.artistId || item.artistName || item.artistLinkUrl || "");
  }

  return String(
    item.collectionId || `${item.artistId || item.artistName}-${item.collectionName || ""}-${item.releaseDate || ""}`
  );
}

function combinarResultadosSemDuplicidade(listas, type, maxItens = BIBLIOTECA_MAX_ITENS) {
  const vistos = new Set();
  const combinados = [];

  listas.forEach((lista) => {
    lista.forEach((item) => {
      const chave = criarChaveUnicaResultado(item, type);

      if (!chave || vistos.has(chave)) {
        return;
      }

      vistos.add(chave);
      combinados.push(item);
    });
  });

  return combinados.slice(0, maxItens);
}

async function buscarResultadosItunes({ termo, type, limit = 50 }) {
  const params = new URLSearchParams({
    term: String(termo || "").trim(),
    media: "music",
    entity: Results.ENTIDADES_BUSCA[type],
    limit: String(limit)
  });

  const resposta = await fetch(buildApiUrl(`/itunes/search?${params.toString()}`));

  if (!resposta.ok) {
    throw new Error("Falha na API do iTunes.");
  }

  const dados = await resposta.json();
  return dados.results || [];
}

function preCarregarDetalhe(url = DETAIL_PAGE_URL) {
  const destino = String(url || DETAIL_PAGE_URL);

  if (detalhePrecarregado.has(destino)) {
    return;
  }

  detalhePrecarregado.add(destino);

  const prefetch = document.createElement("link");
  prefetch.rel = "prefetch";
  prefetch.as = "document";
  prefetch.href = destino;
  document.head.appendChild(prefetch);

  fetch(destino, { credentials: "same-origin" }).catch(() => {
    detalhePrecarregado.delete(destino);
  });
}

function agendarPreCarregamentoDetalhe() {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => preCarregarDetalhe(DETAIL_PAGE_URL), { timeout: 1200 });
    return;
  }

  setTimeout(() => preCarregarDetalhe(DETAIL_PAGE_URL), 500);
}

function getSearchOptions() {
  return {
    mostrarAlternativas: showAlternativesToggle.checked,
    searchType
  };
}

function obterAnoNumerico(valor) {
  const numero = Number(valor);
  if (Number.isFinite(numero) && numero > 0) {
    return numero;
  }

  const texto = String(valor || "");
  const match = texto.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function obterDecada(valor) {
  const ano = obterAnoNumerico(valor);
  if (!ano) return "Nao informada";

  return `${Math.floor(ano / 10) * 10}s`;
}

function abrirDetalhes(item) {
  const detailUrl = Links?.buildDetailUrl(item) || DETAIL_PAGE_URL;
  sessionStorage.setItem("bandaSelecionada", JSON.stringify(item));
  preCarregarDetalhe(detailUrl);
  window.location.href = detailUrl;
}

function explorarAlbunsDoArtista(artista) {
  searchType = "album";
  searchInput.value = artista.nome;
  atualizarModoBusca();
  pesquisarBandas({ saveTerm: false, syncUrl: true, pushUrl: false });
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

function obterBaseFiltrada() {
  return filtrarAlternativas(converterResultados());
}

function obterListaFiltrada() {
  const generoSelecionado = genreFilter.value;
  const paisSelecionado = countryFilter.value;
  const decadaSelecionada = decadeFilter.value;

  let filtrados = obterBaseFiltrada();

  if (generoSelecionado !== "todos") {
    filtrados = filtrados.filter((item) => item.genero === generoSelecionado);
  }

  if (paisSelecionado !== "todos") {
    filtrados = filtrados.filter((item) => item.pais === paisSelecionado);
  }

  if (decadaSelecionada !== "todos") {
    filtrados = filtrados.filter((item) => obterDecada(item.lancamento) === decadaSelecionada);
  }

  return Results.ordenarResultados(filtrados, sortSelect.value);
}

function preencherFiltroOpcional({
  container,
  allLabel,
  currentValue,
  values,
  compareFn = (a, b) => a.localeCompare(b, "pt-BR")
}) {
  const ordenados = [...new Set(values.filter(Boolean))].sort(compareFn);

  container.innerHTML = "";

  const optionAll = document.createElement("option");
  optionAll.value = "todos";
  optionAll.textContent = allLabel;
  container.appendChild(optionAll);

  ordenados.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    container.appendChild(option);
  });

  container.value = ordenados.includes(currentValue) ? currentValue : "todos";
}

function preencherFiltros(lista) {
  const generoAtual = genreFilter.value;
  const paisAtual = countryFilter.value;
  const decadaAtual = decadeFilter.value;

  preencherFiltroOpcional({
    container: genreFilter,
    allLabel: "Todos os gêneros",
    currentValue: generoAtual,
    values: lista.map((item) => item.genero)
  });

  preencherFiltroOpcional({
    container: countryFilter,
    allLabel: "Todos os países",
    currentValue: paisAtual,
    values: lista.map((item) => item.pais)
  });

  preencherFiltroOpcional({
    container: decadeFilter,
    allLabel: "Todas as décadas",
    currentValue: decadaAtual,
    values: lista.map((item) => obterDecada(item.lancamento)).filter((item) => item !== "Nao informada"),
    compareFn: (a, b) => parseInt(b, 10) - parseInt(a, 10)
  });
}

function renderEmptyChipList(container, text) {
  container.innerHTML = `<p class="vazio">${escapeHtml(text)}</p>`;
}

function createChip(label, onClick) {
  const button = document.createElement("button");
  button.className = "chip-btn";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function buildTopItems(lista, selector, limit = 6) {
  const counter = new Map();

  lista.forEach((item) => {
    const key = selector(item);

    if (!key || key === "Nao informada") {
      return;
    }

    counter.set(key, (counter.get(key) || 0) + 1);
  });

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

function renderDiscovery(lista) {
  if (!lista.length) {
    renderEmptyChipList(discoverGenres, "Pesquise para liberar sugestões.");
    renderEmptyChipList(discoverCountries, "Pesquise para liberar sugestões.");
    renderEmptyChipList(discoverDecades, "Pesquise para liberar sugestões.");
    return;
  }

  const generos = buildTopItems(lista, (item) => item.genero);
  const paises = buildTopItems(lista, (item) => item.pais);
  const decadas = buildTopItems(lista, (item) => obterDecada(item.lancamento));

  discoverGenres.innerHTML = "";
  discoverCountries.innerHTML = "";
  discoverDecades.innerHTML = "";

  if (!generos.length) {
    renderEmptyChipList(discoverGenres, "Sem gêneros para sugerir.");
  } else {
    generos.forEach((genero) => {
      discoverGenres.appendChild(
        createChip(genero, () => {
          genreFilter.value = genero;
          aplicarFiltrosERenderizar();
        })
      );
    });
  }

  if (!paises.length) {
    renderEmptyChipList(discoverCountries, "Sem países para sugerir.");
  } else {
    paises.forEach((pais) => {
      discoverCountries.appendChild(
        createChip(pais, () => {
          countryFilter.value = pais;
          aplicarFiltrosERenderizar();
        })
      );
    });
  }

  if (!decadas.length) {
    renderEmptyChipList(discoverDecades, "Sem décadas para sugerir.");
  } else {
    decadas.forEach((decada) => {
      discoverDecades.appendChild(
        createChip(decada, () => {
          decadeFilter.value = decada;
          aplicarFiltrosERenderizar();
        })
      );
    });
  }
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

    previewArea.innerHTML = `<p class="preview-status"><strong>Prévia:</strong> ${escapeHtml(preview.nome)}</p>`;
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

function addToCollection(item) {
  const collections = Storage.getCollections();

  if (!collections.length) {
    const nomeNova = window.prompt("Nome da nova coleção:");

    if (!nomeNova) return;

    const collection = Storage.ensureCollectionByName(nomeNova);

    if (!collection) return;

    Storage.addItemToCollection(collection.id, item);
    statusText.textContent = `Item salvo em "${collection.name}".`;
    return;
  }

  const menu = collections.map((collection, index) => `${index + 1}. ${collection.name}`).join("\n");

  const entrada = window.prompt(
    `Digite o número da coleção ou um novo nome:\n\n${menu}`
  );

  if (!entrada) return;

  const indice = Number(entrada);
  const collection =
    Number.isInteger(indice) && indice >= 1 && indice <= collections.length
      ? collections[indice - 1]
      : Storage.ensureCollectionByName(entrada);

  if (!collection) return;

  Storage.addItemToCollection(collection.id, item);
  statusText.textContent = `Item salvo em "${collection.name}".`;
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
    toggleBandFavorite,
    addToCollection
  };
}

function renderizarResultados(lista) {
  bandsGrid.innerHTML = "";

  if (!lista.length) {
    if (contextoResultados === "library") {
      bandsGrid.innerHTML = `<p class="vazio">A biblioteca inicial está vazia no momento.</p>`;
      statusText.textContent = "Não foi possível montar a biblioteca inicial agora.";
      return;
    }

    bandsGrid.innerHTML = `<p class="vazio">Nenhum resultado encontrado.</p>`;
    statusText.textContent = "Nenhum resultado encontrado.";
    return;
  }

  const prefixo = contextoResultados === "library" ? "Biblioteca inicial: " : "";
  statusText.textContent = `${prefixo}${lista.length} ${Results.obterTipoTexto(searchType)} encontrado(s).`;

  lista.forEach((item) => {
    const card = Cards.criarResultadoCard(item, getCardContext());
    card.addEventListener("mouseenter", () => preCarregarDetalhe(DETAIL_PAGE_URL), { once: true });
    card.addEventListener("touchstart", () => preCarregarDetalhe(DETAIL_PAGE_URL), {
      once: true,
      passive: true
    });
    bandsGrid.appendChild(card);
  });
}

function aplicarFiltrosERenderizar() {
  renderizarResultados(obterListaFiltrada());
}

async function carregarBibliotecaInicial() {
  const requestId = ++requestCounter;
  contextoResultados = "library";

  const itensEmCache = bibliotecaInicialCache.get(searchType);
  if (itensEmCache?.length) {
    ultimoResultadoBruto = itensEmCache;
    const baseFiltrada = obterBaseFiltrada();
    preencherFiltros(baseFiltrada);
    renderDiscovery(baseFiltrada);
    aplicarFiltrosERenderizar();
    return;
  }

  statusText.textContent = `Carregando biblioteca de ${Results.obterNomeModo(searchType).toLowerCase()}...`;
  bandsGrid.innerHTML = `<div class="loading">Montando biblioteca inicial...</div>`;

  try {
    const termos = BIBLIOTECA_INICIAL_TERMOS[searchType] || BIBLIOTECA_INICIAL_TERMOS.album;
    const respostas = await Promise.allSettled(
      termos.map((termo) =>
        buscarResultadosItunes({
          termo,
          type: searchType,
          limit: BIBLIOTECA_LIMITE_POR_TERMO
        })
      )
    );

    if (requestId !== requestCounter) {
      return;
    }

    const listasValidas = respostas
      .filter((resultado) => resultado.status === "fulfilled")
      .map((resultado) => resultado.value);

    if (!listasValidas.length) {
      throw new Error("Falha ao montar biblioteca inicial.");
    }

    ultimoResultadoBruto = combinarResultadosSemDuplicidade(listasValidas, searchType);
    bibliotecaInicialCache.set(searchType, ultimoResultadoBruto);

    const baseFiltrada = obterBaseFiltrada();
    preencherFiltros(baseFiltrada);
    renderDiscovery(baseFiltrada);
    aplicarFiltrosERenderizar();
  } catch (erro) {
    if (requestId !== requestCounter) {
      return;
    }

    console.error("Erro ao carregar biblioteca inicial:", erro);
    ultimoResultadoBruto = [];
    bandsGrid.innerHTML = `<p class="vazio">Não foi possível carregar a biblioteca inicial agora.</p>`;
    statusText.textContent = "Erro ao carregar biblioteca inicial.";
    preencherFiltros([]);
    renderDiscovery([]);
  }
}

async function pesquisarBandas({ saveTerm = true, syncUrl = true, pushUrl = true } = {}) {
  const termo = searchInput.value.trim();

  if (syncUrl && Links) {
    Links.syncSearchStateToUrl({ term: termo, type: searchType }, !pushUrl);
  }

  if (!termo) {
    await carregarBibliotecaInicial();
    return;
  }

  const requestId = ++requestCounter;
  contextoResultados = "search";
  statusText.textContent = "Pesquisando...";
  bandsGrid.innerHTML = `<div class="loading">Buscando resultados musicais...</div>`;

  try {
    ultimoResultadoBruto = await buscarResultadosItunes({
      termo,
      type: searchType,
      limit: 50
    });

    if (requestId !== requestCounter) {
      return;
    }

    const baseFiltrada = obterBaseFiltrada();

    preencherFiltros(baseFiltrada);
    renderDiscovery(baseFiltrada);
    aplicarFiltrosERenderizar();

    if (saveTerm && termo.length >= 2 && ultimoResultadoBruto.length > 0) {
      Storage.addHistoryTerm(termo, searchType);
      renderHistory();
    }
  } catch (erro) {
    if (requestId !== requestCounter) {
      return;
    }

    console.error("Erro ao buscar bandas:", erro);
    ultimoResultadoBruto = [];
    bandsGrid.innerHTML = `<p class="vazio">Não foi possível carregar os resultados agora.</p>`;
    statusText.textContent = "Erro ao carregar resultados.";
    preencherFiltros([]);
    renderDiscovery([]);
  }
}

function pesquisarComDebounce() {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    const termo = searchInput.value.trim();

    if (termo.length >= 2) {
      pesquisarBandas({ saveTerm: false, syncUrl: true, pushUrl: false });
    } else if (termo.length === 0) {
      if (Links) {
        Links.syncSearchStateToUrl({ term: "", type: searchType }, true);
      }
      carregarBibliotecaInicial();
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
      pesquisarBandas({ saveTerm: false, syncUrl: true, pushUrl: true });
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

function getItensParaRadio(lista) {
  return lista.filter((item) => item.previewUrl || item.albumId);
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    searchType = button.dataset.searchType;
    atualizarModoBusca();

    if (searchInput.value.trim().length >= 2) {
      pesquisarBandas({ saveTerm: false, syncUrl: true, pushUrl: false });
    } else {
      if (Links) {
        Links.syncSearchStateToUrl({ term: "", type: searchType }, true);
      }
      carregarBibliotecaInicial();
    }
  });
});

searchButton.addEventListener("click", () =>
  pesquisarBandas({ saveTerm: true, syncUrl: true, pushUrl: true })
);

searchInput.addEventListener("input", pesquisarComDebounce);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    clearTimeout(debounceTimer);
    pesquisarBandas({ saveTerm: true, syncUrl: true, pushUrl: true });
  }
});

genreFilter.addEventListener("change", aplicarFiltrosERenderizar);
countryFilter.addEventListener("change", aplicarFiltrosERenderizar);
decadeFilter.addEventListener("change", aplicarFiltrosERenderizar);
sortSelect.addEventListener("change", aplicarFiltrosERenderizar);
showAlternativesToggle.addEventListener("change", () => {
  const baseFiltrada = obterBaseFiltrada();
  preencherFiltros(baseFiltrada);
  renderDiscovery(baseFiltrada);
  aplicarFiltrosERenderizar();
});

refreshDiscoveryButton.addEventListener("click", () => {
  renderDiscovery(obterBaseFiltrada());
});

startRadioResultsButton.addEventListener("click", async () => {
  const itens = getItensParaRadio(obterListaFiltrada());

  if (!itens.length) {
    statusText.textContent = "Nenhum resultado com prévia disponível para o rádio.";
    return;
  }

  try {
    await WikiPreview.startRadio(itens, { label: "Rádio dos resultados" });
    statusText.textContent = "Rádio dos resultados iniciado.";
  } catch (erro) {
    console.warn("Não foi possível iniciar o rádio:", erro);
    statusText.textContent = "Não foi possível iniciar o rádio agora.";
  }
});

stopRadioButton.addEventListener("click", () => {
  WikiPreview.stop();
  statusText.textContent = "Rádio parado.";
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

window.addEventListener("popstate", () => {
  if (!Links) return;

  const { term, type } = Links.readSearchStateFromUrl();
  searchType = type;
  searchInput.value = term;
  atualizarModoBusca();

  if (term.length >= 2) {
    pesquisarBandas({ saveTerm: false, syncUrl: false });
  } else {
    carregarBibliotecaInicial();
  }
});

function inicializarBuscaDaUrl() {
  if (Links) {
    const { term, type } = Links.readSearchStateFromUrl();
    searchType = type;
    searchInput.value = term;
  }

  atualizarModoBusca();

  if (searchInput.value.trim().length >= 2) {
    pesquisarBandas({ saveTerm: false, syncUrl: false });
    return;
  }

  carregarBibliotecaInicial();
}

renderHistory();
renderFavorites();
renderBandFavorites();
preencherFiltros([]);
renderDiscovery([]);
agendarPreCarregamentoDetalhe();
inicializarBuscaDaUrl();
