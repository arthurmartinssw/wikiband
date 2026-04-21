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

const PLACEHOLDER_IMAGEM = "https://via.placeholder.com/600x400?text=Sem+Imagem";
const ENTIDADES_BUSCA = {
  album: "album",
  song: "song",
  artist: "musicArtist"
};

let ultimoResultadoBruto = [];
let debounceTimer = null;
let searchType = "album";

function getHistory() {
  return JSON.parse(localStorage.getItem("wikiband_history")) || [];
}

function saveHistory(history) {
  localStorage.setItem("wikiband_history", JSON.stringify(history));
}

function addToHistory(term) {
  const key = `${searchType}:${term}`;
  let history = getHistory().filter((item) => {
    const itemKey = typeof item === "string" ? `album:${item}` : `${item.type}:${item.term}`;
    return itemKey.toLowerCase() !== key.toLowerCase();
  });

  history.unshift({ term, type: searchType });
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

  saveFavorites(favorites);
  renderFavorites();
  aplicarFiltrosERenderizar();
}

function getBandFavorites() {
  return JSON.parse(localStorage.getItem("wikiband_band_favorites")) || [];
}

function saveBandFavorites(favorites) {
  localStorage.setItem("wikiband_band_favorites", JSON.stringify(favorites));
}

function isBandFavorite(bandaId) {
  return getBandFavorites().some((item) => item.bandaId === bandaId);
}

function toggleBandFavorite(banda) {
  let favorites = getBandFavorites();

  if (favorites.some((item) => item.bandaId === banda.bandaId)) {
    favorites = favorites.filter((item) => item.bandaId !== banda.bandaId);
  } else {
    favorites.unshift(banda);
  }

  saveBandFavorites(favorites);
  renderBandFavorites();
  aplicarFiltrosERenderizar();
}

function abrirDetalhes(banda) {
  sessionStorage.setItem("bandaSelecionada", JSON.stringify(banda));
  window.open("banda.html", "_blank");
}

function explorarAlbunsDoArtista(artista) {
  searchType = "album";
  searchInput.value = artista.nome;
  atualizarModoBusca();
  pesquisarBandas(false);
}

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .replace(/\b(remaster(ed)?|deluxe|expanded|anniversary|edition|version|bonus|explicit|mono|stereo)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function melhorarImagem(url) {
  return url ? url.replace("100x100bb", "600x600bb") : PLACEHOLDER_IMAGEM;
}

function obterAno(item) {
  return item.releaseDate ? new Date(item.releaseDate).getFullYear() : "Ano não informado";
}

function montarAlbum(item) {
  const nome = item.artistName || "Artista desconhecido";
  const album = item.collectionName || "Álbum não informado";
  const lancamento = obterAno(item);

  return {
    tipo: "album",
    nome,
    genero: item.primaryGenreName || "Gênero não informado",
    pais: item.country || "País não informado",
    album,
    lancamento,
    imagem: melhorarImagem(item.artworkUrl100),
    albumId: item.collectionId || `${nome}-${album}-${lancamento}`,
    bandaId: item.artistId || nome,
    spotifyLink: `https://open.spotify.com/search/${encodeURIComponent(`${nome} ${album}`)}`,
    youtubeLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nome} ${album}`)}`
  };
}

function montarMusica(item) {
  const nome = item.artistName || "Artista desconhecido";
  const musica = item.trackName || "Música não informada";
  const album = item.collectionName || "Álbum não informado";
  const lancamento = obterAno(item);

  return {
    tipo: "song",
    nome,
    musica,
    genero: item.primaryGenreName || "Gênero não informado",
    pais: item.country || "País não informado",
    album,
    lancamento,
    imagem: melhorarImagem(item.artworkUrl100),
    albumId: item.collectionId || `${nome}-${album}-${lancamento}`,
    bandaId: item.artistId || nome,
    trackId: item.trackId || `${nome}-${musica}-${album}`,
    previewUrl: item.previewUrl ? item.previewUrl.replace(/^http:/, "https:") : "",
    spotifyLink: `https://open.spotify.com/search/${encodeURIComponent(`${nome} ${musica}`)}`,
    youtubeLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nome} ${musica}`)}`
  };
}

function montarArtista(item) {
  const nome = item.artistName || "Artista desconhecido";

  return {
    tipo: "artist",
    nome,
    genero: item.primaryGenreName || "Artista",
    pais: item.country || "País não informado",
    album: "Discografia",
    lancamento: "Artista",
    imagem: PLACEHOLDER_IMAGEM,
    bandaId: item.artistId || nome,
    spotifyLink: `https://open.spotify.com/search/${encodeURIComponent(nome)}`,
    appleLink: item.artistLinkUrl || "",
    youtubeLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(nome)}`
  };
}

function montarResultado(item) {
  if (searchType === "song") return montarMusica(item);
  if (searchType === "artist") return montarArtista(item);
  return montarAlbum(item);
}

function obterTituloOrdenacao(item) {
  if (item.tipo === "song") return item.musica;
  if (item.tipo === "artist") return item.nome;
  return item.album;
}

function obterAnoOrdenacao(item) {
  return Number.isFinite(Number(item.lancamento)) ? Number(item.lancamento) : 0;
}

function filtrarVersoesAlternativas(lista) {
  if (showAlternativesToggle.checked || searchType === "artist") {
    return lista;
  }

  const vistos = new Set();

  return lista.filter((item) => {
    const chave =
      item.tipo === "song"
        ? `${normalizarTexto(item.nome)}-${normalizarTexto(item.musica)}`
        : `${normalizarTexto(item.nome)}-${normalizarTexto(item.album)}`;

    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function ordenarResultados(lista) {
  const ordenacao = sortSelect.value;
  const copia = [...lista];

  if (ordenacao === "recent") {
    return copia.sort((a, b) => obterAnoOrdenacao(b) - obterAnoOrdenacao(a));
  }

  if (ordenacao === "oldest") {
    return copia.sort((a, b) => obterAnoOrdenacao(a) - obterAnoOrdenacao(b));
  }

  if (ordenacao === "az") {
    return copia.sort((a, b) => obterTituloOrdenacao(a).localeCompare(obterTituloOrdenacao(b), "pt-BR"));
  }

  if (ordenacao === "za") {
    return copia.sort((a, b) => obterTituloOrdenacao(b).localeCompare(obterTituloOrdenacao(a), "pt-BR"));
  }

  return copia;
}

function montarTextoCompartilhar(item) {
  if (item.tipo === "song") {
    return `Estou ouvindo "${item.musica}" de ${item.nome} no Wikiband. ${item.youtubeLink}`;
  }

  if (item.tipo === "artist") {
    return `Estou explorando ${item.nome} no Wikiband. ${item.spotifyLink}`;
  }

  return `Estou ouvindo o álbum "${item.album}" de ${item.nome} no Wikiband. ${item.spotifyLink}`;
}

async function copiarTexto(texto) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch (erro) {
      console.warn("Clipboard API indisponível, usando fallback:", erro);
    }
  }

  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  document.execCommand("copy");
  campo.remove();
}

async function compartilharItem(item, botao) {
  const texto = montarTextoCompartilhar(item);
  const textoOriginal = botao.textContent;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Wikiband",
        text: texto
      });
    } else {
      await copiarTexto(texto);
      botao.textContent = "Copiado";
      setTimeout(() => {
        botao.textContent = textoOriginal;
      }, 1400);
    }
  } catch (erro) {
    console.warn("Compartilhamento cancelado ou indisponível:", erro);
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

function criarAlbumCard(album) {
  const card = document.createElement("div");
  card.className = "band-card";

  card.innerHTML = `
    <img src="${album.imagem}" class="band-image" alt="${album.album}">
    <div class="band-content">
      <h3>${album.nome}</h3>
      <span class="tag">${album.genero}</span>
      <p><strong>País:</strong> ${album.pais}</p>
      <p><strong>Álbum:</strong> ${album.album}</p>
      <p><strong>Lançamento:</strong> ${album.lancamento}</p>

      <div class="card-actions">
        <button class="primary-btn preview-btn" type="button">Tocar prévia</button>
        <button class="secondary-btn favorite-btn ${isFavorite(album.albumId) ? "active" : ""}" type="button">
          ${isFavorite(album.albumId) ? "Remover álbum" : "Favoritar álbum"}
        </button>
        <button class="secondary-btn favorite-band-btn ${isBandFavorite(album.bandaId) ? "active" : ""}" type="button">
          ${isBandFavorite(album.bandaId) ? "Remover banda" : "Favoritar banda"}
        </button>
        <button class="secondary-btn share-btn" type="button">Compartilhar</button>
      </div>

      <div class="preview-area" aria-live="polite"></div>
    </div>
  `;

  const previewBtn = card.querySelector(".preview-btn");
  const favoriteBtn = card.querySelector(".favorite-btn");
  const favoriteBandBtn = card.querySelector(".favorite-band-btn");
  const shareBtn = card.querySelector(".share-btn");

  previewBtn.dataset.previewIdleText = "Tocar prévia";
  previewBtn.dataset.previewPlayingText = "Pausar prévia";

  card.addEventListener("click", (event) => {
    if (event.target.closest("button, .preview-area")) return;
    abrirDetalhes(album);
  });

  previewBtn.addEventListener("click", () => tocarPreviewAlbum(album, card, previewBtn));
  favoriteBtn.addEventListener("click", () => toggleFavorite(album));
  favoriteBandBtn.addEventListener("click", () => toggleBandFavorite(album));
  shareBtn.addEventListener("click", () => compartilharItem(album, shareBtn));

  return card;
}

function criarMusicaCard(musica) {
  const card = document.createElement("div");
  card.className = "band-card";

  card.innerHTML = `
    <img src="${musica.imagem}" class="band-image" alt="${musica.musica}">
    <div class="band-content">
      <h3>${musica.musica}</h3>
      <span class="tag">${musica.genero}</span>
      <p><strong>Artista:</strong> ${musica.nome}</p>
      <p><strong>Álbum:</strong> ${musica.album}</p>
      <p><strong>Lançamento:</strong> ${musica.lancamento}</p>

      <div class="card-actions">
        <button class="primary-btn preview-btn" type="button" ${musica.previewUrl ? "" : "disabled"}>
          ${musica.previewUrl ? "Tocar prévia" : "Sem prévia"}
        </button>
        <button class="secondary-btn details-btn" type="button">Ver álbum</button>
        <button class="secondary-btn share-btn" type="button">Compartilhar</button>
      </div>
    </div>
  `;

  const previewBtn = card.querySelector(".preview-btn");
  const detailsBtn = card.querySelector(".details-btn");
  const shareBtn = card.querySelector(".share-btn");

  previewBtn.dataset.previewIdleText = "Tocar prévia";
  previewBtn.dataset.previewPlayingText = "Pausar prévia";

  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    abrirDetalhes(musica);
  });

  previewBtn.addEventListener("click", () => tocarPreviewMusica(musica, previewBtn));
  detailsBtn.addEventListener("click", () => abrirDetalhes(musica));
  shareBtn.addEventListener("click", () => compartilharItem(musica, shareBtn));

  return card;
}

function criarArtistaCard(artista) {
  const card = document.createElement("div");
  card.className = "band-card artist-card";

  card.innerHTML = `
    <div class="artist-placeholder">${artista.nome.charAt(0).toUpperCase()}</div>
    <div class="band-content">
      <h3>${artista.nome}</h3>
      <span class="tag">${artista.genero}</span>
      <p><strong>Resultado:</strong> Artista</p>

      <div class="card-actions">
        <button class="primary-btn explore-btn" type="button">Ver álbuns</button>
        <button class="secondary-btn favorite-band-btn ${isBandFavorite(artista.bandaId) ? "active" : ""}" type="button">
          ${isBandFavorite(artista.bandaId) ? "Remover banda" : "Favoritar banda"}
        </button>
        <button class="secondary-btn share-btn" type="button">Compartilhar</button>
      </div>
    </div>
  `;

  const exploreBtn = card.querySelector(".explore-btn");
  const favoriteBandBtn = card.querySelector(".favorite-band-btn");
  const shareBtn = card.querySelector(".share-btn");

  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    explorarAlbunsDoArtista(artista);
  });

  exploreBtn.addEventListener("click", () => explorarAlbunsDoArtista(artista));
  favoriteBandBtn.addEventListener("click", () => toggleBandFavorite(artista));
  shareBtn.addEventListener("click", () => compartilharItem(artista, shareBtn));

  return card;
}

function criarCard(item) {
  if (item.tipo === "song") return criarMusicaCard(item);
  if (item.tipo === "artist") return criarArtistaCard(item);
  return criarAlbumCard(item);
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

function renderizarResultados(lista) {
  bandsGrid.innerHTML = "";

  if (!lista.length) {
    bandsGrid.innerHTML = `<p class="vazio">Nenhum resultado encontrado.</p>`;
    statusText.textContent = "Nenhum resultado encontrado.";
    return;
  }

  const tipoTexto = searchType === "song" ? "música(s)" : searchType === "artist" ? "artista(s)" : "álbum(ns)";
  statusText.textContent = `${lista.length} ${tipoTexto} encontrado(s).`;

  lista.forEach((item) => {
    bandsGrid.appendChild(criarCard(item));
  });
}

function obterListaFiltrada() {
  const generoSelecionado = genreFilter.value;
  const convertidos = ultimoResultadoBruto.map(montarResultado);
  const semAlternativas = filtrarVersoesAlternativas(convertidos);
  const filtrados =
    generoSelecionado === "todos"
      ? semAlternativas
      : semAlternativas.filter((item) => item.genero === generoSelecionado);

  return ordenarResultados(filtrados);
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
    )}&media=music&entity=${ENTIDADES_BUSCA[searchType]}&limit=50`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    ultimoResultadoBruto = dados.results || [];
    const convertidos = filtrarVersoesAlternativas(ultimoResultadoBruto.map(montarResultado));
    preencherFiltroGenero(convertidos);
    aplicarFiltrosERenderizar();

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

function obterNomeModo(type) {
  if (type === "song") return "Músicas";
  if (type === "artist") return "Artistas";
  return "Álbuns";
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
  const history = getHistory();

  if (!history.length) {
    historyList.innerHTML = `<p class="vazio">Nenhuma pesquisa ainda.</p>`;
    return;
  }

  historyList.innerHTML = "";

  history.forEach((item) => {
    const term = typeof item === "string" ? item : item.term;
    const type = typeof item === "string" ? "album" : item.type;
    const historyItem = document.createElement("div");
    historyItem.className = "item-lateral";
    historyItem.innerHTML = `
      <strong>${term}</strong>
      <p>${obterNomeModo(type)}</p>
      <button>Pesquisar de novo</button>
    `;

    historyItem.querySelector("button").addEventListener("click", () => {
      searchType = type;
      searchInput.value = term;
      atualizarModoBusca();
      pesquisarBandas(false);
    });

    historyList.appendChild(historyItem);
  });
}

function renderFavorites() {
  const favorites = getFavorites();

  if (!favorites.length) {
    favoritesList.innerHTML = `<p class="vazio">Nenhum álbum favorito.</p>`;
    return;
  }

  favoritesList.innerHTML = "";

  favorites.forEach((banda) => {
    const item = document.createElement("div");
    item.className = "item-lateral";
    item.innerHTML = `
      <strong>${banda.album || banda.nome}</strong>
      <p>${banda.nome}</p>
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

function renderBandFavorites() {
  const favorites = getBandFavorites();

  if (!favorites.length) {
    bandFavoritesList.innerHTML = `<p class="vazio">Nenhuma banda favorita.</p>`;
    return;
  }

  bandFavoritesList.innerHTML = "";

  favorites.forEach((banda) => {
    const item = document.createElement("div");
    item.className = "item-lateral";
    item.innerHTML = `
      <strong>${banda.nome}</strong>
      <p>${banda.genero}</p>
      <button class="ver-favorito">Ver detalhes</button>
      <button class="remover-banda-favorita danger mini-btn">Remover</button>
    `;

    item.querySelector(".ver-favorito").addEventListener("click", () => {
      if (banda.albumId) {
        abrirDetalhes(banda);
      } else {
        explorarAlbunsDoArtista(banda);
      }
    });

    item.querySelector(".remover-banda-favorita").addEventListener("click", () => {
      toggleBandFavorite(banda);
    });

    bandFavoritesList.appendChild(item);
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
  preencherFiltroGenero(filtrarVersoesAlternativas(ultimoResultadoBruto.map(montarResultado)));
  aplicarFiltrosERenderizar();
});

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_history");
  renderHistory();
});

clearFavoritesButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_favorites");
  renderFavorites();
  aplicarFiltrosERenderizar();
});

clearBandFavoritesButton.addEventListener("click", () => {
  localStorage.removeItem("wikiband_band_favorites");
  renderBandFavorites();
  aplicarFiltrosERenderizar();
});

atualizarModoBusca();
renderHistory();
renderFavorites();
renderBandFavorites();
