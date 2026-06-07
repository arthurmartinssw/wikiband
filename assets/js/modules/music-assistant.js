(function initWikibandMusicAssistant(window, document) {
  "use strict";

  if (window.WikibandMusicAssistant) return;

  const BASE_STORAGE_KEY = "wikiband_music_assistant_messages";
  const MAX_MESSAGES = 36;
  const SEARCH_TYPES = new Set(["album", "song", "artist"]);
  const MODE_LABELS = {
    album: "albuns",
    song: "musicas",
    artist: "artistas"
  };
  const ITUNES_ENTITIES = {
    album: "album",
    song: "song",
    artist: "musicArtist"
  };
  const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
  const ITUNES_TIMEOUT_MS = 8000;
  const MUSICAI_API_URL = "/api/musicai";
  const MUSICAI_TIMEOUT_MS = 14000;
  const RELATIONSHIP_QUESTION_RE = /\b(integrantes?|membros?|formacao|vocalistas?|cantores?|cantoras?|guitarristas?|baixistas?|bateristas?|tecladistas?|fundadores?)\b/;
  const PAGE_LABELS = {
    home: "busca",
    detail: "detalhes",
    favorites: "favoritos",
    profile: "perfil",
    about: "sobre",
    auth: "conta",
    unknown: "Wikiband"
  };
  const GENRE_GUIDES = [
    {
      keys: ["rock", "alternative", "alternativo", "classic rock", "hard rock"],
      title: "rock",
      text:
        "Para explorar rock, compare albuns de estudio, registros ao vivo e fases por decada. Uma boa pergunta e: quais discos mostram melhor a mudanca de som desse artista?"
    },
    {
      keys: ["metal", "heavy metal", "death metal", "thrash", "black metal"],
      title: "metal",
      text:
        "No metal, vale olhar subgenero, peso da producao, fase da banda e formacao. Tente buscar tambem por discos mais antigos e ordenar por ano para ver a evolucao."
    },
    {
      keys: ["pop", "dance pop"],
      title: "pop",
      text:
        "No pop, observe singles, produtores, colabs e mudancas de era visual/sonora. Para descobrir mais, pesquise o artista e depois abra albuns de anos diferentes."
    },
    {
      keys: ["jazz", "bebop", "fusion"],
      title: "jazz",
      text:
        "No jazz, formacao, improviso e periodo importam muito. Explore por artista e compare albuns com musicos convidados ou gravacoes de epocas diferentes."
    },
    {
      keys: ["mpb", "bossa", "samba"],
      title: "MPB/samba",
      text:
        "Na musica brasileira, letras, arranjos e contexto cultural costumam pesar bastante. Busque pelo artista, salve favoritos e monte uma colecao por fase ou movimento."
    },
    {
      keys: ["hip hop", "rap"],
      title: "hip-hop/rap",
      text:
        "No hip-hop, repare em producao, samples, participacoes e fase lirica. Uma boa rota e procurar albuns principais e depois faixas com artistas relacionados."
    },
    {
      keys: ["electronic", "eletronica", "electronica", "house", "techno"],
      title: "eletronica",
      text:
        "Na eletronica, o caminho muda por cena e subgenero. Experimente salvar faixas com preview e criar colecoes por clima: pista, ambiente, experimental ou classicos."
    },
    {
      keys: ["indie"],
      title: "indie",
      text:
        "No indie, vale acompanhar cenas, selos e mudancas de textura. Pesquise artistas parecidos pelo genero e compare lancamentos recentes com discos de estreia."
    },
    {
      keys: ["blues", "soul", "r&b", "rnb"],
      title: "blues/soul/R&B",
      text:
        "Nesse territorio, voz, groove e composicao fazem muita diferenca. Use previews para sentir a interpretacao e salve os albuns que combinam com seu momento."
    }
  ];

  let root = null;
  let toggleButton = null;
  let panel = null;
  let messagesList = null;
  let quickPrompts = null;
  let form = null;
  let input = null;
  let sendButton = null;
  let typingRow = null;
  let isResponding = false;
  let musicAiBackendRetryAt = 0;
  let messages = [];

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s"'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cleanMessageText(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(compactText)
      .join("\n")
      .trim();
  }

  function truncateText(value, maxLength = 160) {
    const text = compactText(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}...`;
  }

  function uniqueList(items, limit = 5) {
    const seen = new Set();
    const result = [];

    items.forEach((item) => {
      const text = compactText(item);
      const key = normalizeText(text);

      if (!text || seen.has(key)) return;

      seen.add(key);
      result.push(text);
    });

    return result.slice(0, limit);
  }

  function getStorage() {
    return window.WikibandStorage || null;
  }

  function safeCall(callback, fallback) {
    try {
      return callback();
    } catch (error) {
      return fallback;
    }
  }

  function getStorageKey() {
    const session = safeCall(() => getStorage()?.getCurrentSession?.(), null);
    const userKey = session?.email ? encodeURIComponent(session.email) : "guest";
    return `${BASE_STORAGE_KEY}__${userKey}`;
  }

  function loadMessages() {
    return safeCall(() => {
      const parsed = JSON.parse(localStorage.getItem(getStorageKey()) || "[]");
      return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
    }, []);
  }

  function saveMessages() {
    safeCall(() => {
      localStorage.setItem(getStorageKey(), JSON.stringify(messages.slice(-MAX_MESSAGES)));
    });
  }

  function createNode(tagName, className, text) {
    const node = document.createElement(tagName);

    if (className) {
      node.className = className;
    }

    if (typeof text === "string") {
      node.textContent = text;
    }

    return node;
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function buildApiUrl(path) {
    const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;
    const storage = getStorage();

    if (typeof storage?.buildApiUrl === "function") {
      return storage.buildApiUrl(normalizedPath);
    }

    return normalizedPath.startsWith("/itunes/")
      ? `${ITUNES_SEARCH_URL}${normalizedPath.replace(/^\/itunes\/search/, "")}`
      : normalizedPath;
  }

  function buildItunesSearchUrl({ term, entity, limit = 6 }) {
    const params = new URLSearchParams({
      term: compactText(term).slice(0, 120),
      media: "music",
      entity,
      limit: String(Math.max(1, Math.min(20, Number(limit) || 6)))
    });

    if (typeof getStorage()?.buildApiUrl === "function") {
      return buildApiUrl(`/itunes/search?${params.toString()}`);
    }

    return `${ITUNES_SEARCH_URL}?${params.toString()}`;
  }

  async function fetchJsonWithTimeout(url, timeoutMs = ITUNES_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("ITUNES_UNAVAILABLE");
      }

      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function searchItunes(term, type, limit = 6) {
    const entity = ITUNES_ENTITIES[type] || ITUNES_ENTITIES.album;
    const url = buildItunesSearchUrl({ term, entity, limit });
    const data = await fetchJsonWithTimeout(url);
    return Array.isArray(data?.results) ? data.results : [];
  }

  async function searchItunesBundle(term) {
    const searches = await Promise.allSettled([
      searchItunes(term, "artist", 4),
      searchItunes(term, "album", 10),
      searchItunes(term, "song", 10)
    ]);

    return {
      artists: searches[0].status === "fulfilled" ? searches[0].value : [],
      albums: searches[1].status === "fulfilled" ? searches[1].value : [],
      songs: searches[2].status === "fulfilled" ? searches[2].value : []
    };
  }

  function getReleaseYear(value) {
    const date = value ? new Date(value) : null;
    const year = date ? date.getFullYear() : NaN;
    return Number.isFinite(year) ? year : null;
  }

  function uniqueBy(items, keyGetter, limit = 6) {
    const seen = new Set();
    const result = [];

    items.forEach((item) => {
      const key = normalizeText(keyGetter(item));
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push(item);
    });

    return result.slice(0, limit);
  }

  function formatAlbumResult(item) {
    const name = item?.collectionName || "Album sem titulo";
    const year = getReleaseYear(item?.releaseDate);
    return year ? `${name} (${year})` : name;
  }

  function formatSongResult(item) {
    const name = item?.trackName || "Musica sem titulo";
    const album = item?.collectionName ? `, de ${item.collectionName}` : "";
    return `${name}${album}`;
  }

  function getBundleGenres(bundle) {
    return uniqueList(
      [
        ...bundle.artists.map((item) => item.primaryGenreName),
        ...bundle.albums.map((item) => item.primaryGenreName),
        ...bundle.songs.map((item) => item.primaryGenreName)
      ],
      5
    );
  }

  function getMainArtist(bundle, fallbackTerm) {
    const artist = bundle.artists.find((item) => item.artistName) || null;

    if (artist) {
      return {
        name: artist.artistName,
        genre: artist.primaryGenreName || ""
      };
    }

    const source = bundle.albums.find((item) => item.artistName) || bundle.songs.find((item) => item.artistName);

    return {
      name: source?.artistName || fallbackTerm,
      genre: source?.primaryGenreName || ""
    };
  }

  function getPageKind() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" || path === "/index" || path === "/index.html") return "home";
    if (path === "/banda" || path === "/banda.html") return "detail";
    if (path === "/favoritos" || path === "/favoritos.html") return "favorites";
    if (path === "/perfil" || path === "/perfil.html") return "profile";
    if (path === "/sobre" || path === "/sobre.html") return "about";
    if (path === "/login" || path === "/login.html" || path === "/cadastro" || path === "/cadastro.html") {
      return "auth";
    }

    return "unknown";
  }

  function readSelectedItem() {
    if (getPageKind() !== "detail") return null;

    const stored = safeCall(() => JSON.parse(sessionStorage.getItem("bandaSelecionada") || "null"), null);
    if (stored && typeof stored === "object") return stored;

    const detailState = safeCall(() => window.WikibandLinks?.readDetailStateFromUrl?.(), null);
    if (!detailState?.artist) return null;

    return {
      tipo: detailState.type || "artist",
      nome: detailState.artist,
      album: detailState.album || "",
      musica: detailState.song || ""
    };
  }

  function getActiveSearchType() {
    const activeButton = document.querySelector(".mode-btn.active");
    const type = activeButton?.dataset?.searchType;

    if (SEARCH_TYPES.has(type)) return type;

    const params = new URLSearchParams(window.location.search);
    const queryType = params.get("type");
    return SEARCH_TYPES.has(queryType) ? queryType : "album";
  }

  function getSearchTerm() {
    const inputElement = document.getElementById("searchInput");
    const directValue = compactText(inputElement?.value || "");

    if (directValue) return directValue;

    const params = new URLSearchParams(window.location.search);
    return compactText(params.get("q") || "");
  }

  function getCardText(card) {
    const title = card.querySelector("h3")?.textContent || "";
    const tag = card.querySelector(".tag")?.textContent || "";
    const paragraphs = [...card.querySelectorAll("p")]
      .map((paragraph) => paragraph.textContent)
      .filter(Boolean)
      .slice(0, 3)
      .join(" | ");

    return compactText([title, tag, paragraphs].filter(Boolean).join(" - "));
  }

  function readVisibleResults() {
    const cards = [...document.querySelectorAll(".band-card, .favorite-card, .collection-item")];
    return uniqueList(cards.map(getCardText), 6);
  }

  function getFavoritesData() {
    const storage = getStorage();

    return {
      albumFavorites: safeCall(() => storage?.getAlbumFavorites?.() || [], []),
      bandFavorites: safeCall(() => storage?.getBandFavorites?.() || [], []),
      collections: safeCall(() => storage?.getCollections?.() || [], []),
      dashboard: safeCall(() => storage?.getDashboardData?.() || null, null),
      history: safeCall(() => storage?.getHistory?.() || [], [])
    };
  }

  function getCurrentContext() {
    const favorites = getFavoritesData();

    return {
      page: getPageKind(),
      selectedItem: readSelectedItem(),
      searchType: getActiveSearchType(),
      searchTerm: getSearchTerm(),
      statusText: compactText(document.getElementById("status")?.textContent || ""),
      visibleResults: readVisibleResults(),
      ...favorites
    };
  }

  function itemTitle(item) {
    if (!item) return "";
    if (item.musica) return `"${item.musica}", de ${item.nome || "artista desconhecido"}`;
    if (item.album && item.album !== "Discografia") return `"${item.album}", de ${item.nome || "artista desconhecido"}`;
    return item.nome || item.album || item.musica || "";
  }

  function itemDetails(item) {
    if (!item) return [];

    return [
      item.genero && !/nao informado/i.test(item.genero) ? `genero: ${item.genero}` : "",
      item.pais && !/nao informado/i.test(item.pais) ? `pais: ${item.pais}` : "",
      item.lancamento && !/nao informado/i.test(String(item.lancamento)) ? `lancamento: ${item.lancamento}` : "",
      item.album && item.musica ? `album: ${item.album}` : ""
    ].filter(Boolean);
  }

  function findGenreGuide(genre) {
    const normalizedGenre = normalizeText(genre);
    if (!normalizedGenre) return null;

    return GENRE_GUIDES.find((guide) => guide.keys.some((key) => normalizedGenre.includes(normalizeText(key))));
  }

  function getTopLabels(entries, limit = 4) {
    return (entries || [])
      .map((entry) => entry?.label)
      .filter(Boolean)
      .slice(0, limit);
  }

  function summarizeFavoriteItem(item) {
    if (typeof item === "string") return truncateText(item, 100);

    return truncateText(
      [item?.nome, item?.album, item?.musica, item?.genero]
        .filter(Boolean)
        .join(" - "),
      120
    );
  }

  function buildMusicAiContext(context) {
    const totals = context.dashboard?.totals || {};

    return {
      page: context.page,
      searchType: context.searchType,
      searchTerm: context.searchTerm,
      statusText: context.statusText,
      selectedItem: context.selectedItem
        ? {
            tipo: context.selectedItem.tipo,
            nome: context.selectedItem.nome,
            album: context.selectedItem.album,
            musica: context.selectedItem.musica,
            genero: context.selectedItem.genero,
            pais: context.selectedItem.pais,
            lancamento: context.selectedItem.lancamento
          }
        : null,
      visibleResults: context.visibleResults.slice(0, 8),
      albumFavorites: context.albumFavorites.map(summarizeFavoriteItem).filter(Boolean).slice(0, 5),
      bandFavorites: context.bandFavorites.map(summarizeFavoriteItem).filter(Boolean).slice(0, 5),
      collections: context.collections
        .map((collection) => truncateText(collection?.name || collection?.nome || collection?.titulo || "", 80))
        .filter(Boolean)
        .slice(0, 4),
      dashboard: {
        totals: {
          albumFavorites: Number(totals.albumFavorites || 0),
          bandFavorites: Number(totals.bandFavorites || 0),
          collections: Number(totals.collections || 0),
          plays: Number(totals.plays || 0)
        },
        topGenres: getTopLabels(context.dashboard?.topGenres, 5),
        topArtists: getTopLabels(context.dashboard?.topArtists, 5),
        topDecades: getTopLabels(context.dashboard?.topDecades, 4)
      }
    };
  }

  function buildMusicAiHistory(currentMessage = "") {
    const recentMessages = messages.slice(-9);
    const currentText = compactText(currentMessage);

    return recentMessages
      .filter((message, index) => {
        const isLastMessage = index === recentMessages.length - 1;
        return !(isLastMessage && message.role === "user" && compactText(message.text) === currentText);
      })
      .slice(-8)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: truncateText(message.text, 900)
      }))
      .filter((message) => message.content);
  }

  async function askMusicAiBackend(message, context) {
    if (Date.now() < musicAiBackendRetryAt) return "";

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), MUSICAI_TIMEOUT_MS);

    try {
      const response = await fetch(MUSICAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          message: truncateText(message, 1600),
          context: buildMusicAiContext(context),
          history: buildMusicAiHistory(message)
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        musicAiBackendRetryAt = Date.now() + (response.status === 429 ? 30000 : 60000);
        return "";
      }

      const data = await response.json();
      const reply = cleanMessageText(data?.reply || "");

      musicAiBackendRetryAt = 0;
      return data?.ok && reply ? reply : "";
    } catch (error) {
      musicAiBackendRetryAt = Date.now() + 15000;
      console.info("MusicAI backend indisponivel; usando fallback local.", error);
      return "";
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function getContextGenres(context) {
    const genreCandidates = [
      context.selectedItem?.genero,
      ...getTopLabels(context.dashboard?.topGenres, 4),
      ...context.albumFavorites.map((item) => item.genero),
      ...context.bandFavorites.map((item) => item.genero)
    ];

    return uniqueList(genreCandidates, 5);
  }

  function getContextArtists(context) {
    const artistCandidates = [
      context.selectedItem?.nome,
      ...getTopLabels(context.dashboard?.topArtists, 4),
      ...context.albumFavorites.map((item) => item.nome),
      ...context.bandFavorites.map((item) => item.nome)
    ];

    return uniqueList(artistCandidates, 5);
  }

  function buildWelcomeText(context) {
    if (context.page === "detail" && context.selectedItem) {
      return `Oi, eu sou a MusicAI. Posso te ajudar a explorar ${itemTitle(context.selectedItem)}, sugerir proximos caminhos e explicar o que vale observar nesse som.`;
    }

    if (context.page === "favorites") {
      return "Oi, eu sou a MusicAI. Posso olhar seus favoritos e colecoes para sugerir proximas descobertas.";
    }

    if (context.page === "home") {
      return "Oi, eu sou a MusicAI. Posso te ajudar a descobrir artistas, albuns e musicas sem te deixar perdido nos resultados.";
    }

    return "Oi, eu sou a MusicAI. Me diga um artista, album, musica ou estilo e eu te ajudo a achar um bom caminho.";
  }

  function getQuickPrompts(context) {
    if (context.page === "detail" && context.selectedItem) {
      const title = context.selectedItem.nome || itemTitle(context.selectedItem);
      return [`Me fale sobre ${title}`, "Quais faixas ouvir?", "Me recomenda algo parecido"];
    }

    if (context.page === "favorites" || context.page === "profile") {
      return ["Analisa meus favoritos", "Me recomenda algo", "O que eu salvo agora?"];
    }

    if (context.page === "home") {
      if (context.searchTerm) {
        return [
          `Me fale sobre ${context.searchTerm}`,
          `Quais albuns de ${context.searchTerm}?`,
          `Musicas de ${context.searchTerm} com preview`
        ];
      }

      return ["Me recomenda uma busca", "Como usar a busca?", "Pesquisar rock classico"];
    }

    return ["O que voce faz?", "Me recomenda algo", "Como descubro musicas?"];
  }

  function buildCapabilities(context) {
    const pageLabel = PAGE_LABELS[context.page] || PAGE_LABELS.unknown;

    return [
      `Estou acompanhando o contexto desta pagina (${pageLabel}).`,
      "Posso pesquisar artistas, sugerir albuns, apontar faixas para ouvir, explicar generos e usar seus favoritos como pista.",
      "Me pergunte de forma natural, tipo: me fala sobre Pink Floyd, quais albuns ouvir primeiro, ou me recomenda algo parecido."
    ].join("\n");
  }

  function buildCostReply() {
    return [
      "A MusicAI foi pensada para rodar com um plano gratuito de IA e sem expor chave no navegador.",
      "Se o backend gratuito ficar indisponivel ou bater limite, eu continuo funcionando com o modo local do Wikiband para nao quebrar a experiencia."
    ].join("\n");
  }

  function buildSummaryReply(context) {
    const item = context.selectedItem;

    if (item) {
      const details = itemDetails(item);
      const guide = findGenreGuide(item.genero);
      const base = details.length
        ? `${itemTitle(item)} aparece aqui com ${details.join(", ")}.`
        : `${itemTitle(item)} parece ser o melhor ponto de partida agora.`;
      const next = guide
        ? `\n\nPelo genero ${guide.title}, eu olharia assim: ${guide.text}`
        : "\n\nEu exploraria abrindo faixas, ouvindo previews e comparando outros albuns do mesmo artista.";

      return `${base}${next}`;
    }

    if (context.searchTerm) {
      return `Voce esta pesquisando por "${context.searchTerm}" em ${MODE_LABELS[context.searchType] || "musica"}. Eu posso ajudar a filtrar por genero, sugerir termos relacionados ou montar uma rota de descoberta a partir dos resultados.`;
    }

    if (context.visibleResults.length) {
      return `Estou vendo alguns resultados na pagina: ${context.visibleResults.slice(0, 3).join("; ")}. Escolha um card para abrir detalhes, ou me peca recomendacoes a partir dessa lista.`;
    }

    return "Ainda nao tenho um item especifico na tela. Pesquise uma banda, artista, album ou musica, e eu consigo te ajudar com contexto e proximos passos.";
  }

  function buildGenreReply(context, message) {
    const genres = getContextGenres(context);
    const mentionedGuide = GENRE_GUIDES.find((guide) =>
      guide.keys.some((key) => normalizeText(message).includes(normalizeText(key)))
    );
    const contextGuide = mentionedGuide || genres.map(findGenreGuide).find(Boolean);

    if (contextGuide) {
      return `${contextGuide.title}: ${contextGuide.text}`;
    }

    if (genres.length) {
      return `Os generos mais fortes no seu contexto agora sao: ${genres.join(", ")}. Posso recomendar uma busca para qualquer um deles.`;
    }

    return "Me diga um genero, tipo rock, metal, jazz, pop, rap ou MPB, que eu te ajudo a explorar sem sair do Wikiband.";
  }

  function buildFavoritesReply(context) {
    const totals = context.dashboard?.totals || {};
    const genres = getTopLabels(context.dashboard?.topGenres, 5);
    const artists = getTopLabels(context.dashboard?.topArtists, 5);
    const decades = getTopLabels(context.dashboard?.topDecades, 4);
    const lines = [
      `Seu painel local tem ${totals.albumFavorites || 0} album(ns) favorito(s), ${totals.bandFavorites || 0} banda(s) favorita(s), ${totals.collections || 0} colecao(oes) e ${totals.plays || 0} reproducao(oes).`
    ];

    if (genres.length) lines.push(`Generos que mais aparecem: ${genres.join(", ")}.`);
    if (artists.length) lines.push(`Artistas em destaque: ${artists.join(", ")}.`);
    if (decades.length) lines.push(`Decadas recorrentes: ${decades.join(", ")}.`);

    if (!genres.length && !artists.length) {
      lines.push("Ainda ha pouco dado para analisar. Salve alguns albuns ou bandas e eu consigo sugerir caminhos melhores.");
    } else {
      lines.push("Meu conselho: crie uma colecao por clima ou por genero, depois pesquise um artista fora do seu padrao para ampliar a descoberta.");
    }

    return lines.join("\n");
  }

  function buildRecommendationReply(context) {
    const item = context.selectedItem;
    const genres = getContextGenres(context);
    const artists = getContextArtists(context);
    const suggestions = [];

    if (item?.genero && !/nao informado/i.test(item.genero)) {
      suggestions.push(`pesquisar mais ${MODE_LABELS[context.searchType] || "resultados"} de ${item.genero}`);
    }

    if (item?.nome) {
      suggestions.push(`abrir albuns de ${item.nome}`);
    }

    if (genres[0]) {
      suggestions.push(`buscar por "${genres[0]}" e filtrar por decada`);
    }

    if (artists[1]) {
      suggestions.push(`comparar ${artists[0]} com ${artists[1]}`);
    }

    if (context.visibleResults.length) {
      suggestions.push("abrir um dos primeiros cards e ouvir previews antes de favoritar");
    }

    if (!suggestions.length) {
      return "Eu comecaria por uma busca ampla, como rock, pop, jazz, metal, MPB ou indie. Depois filtre por genero e salve os resultados que chamarem atencao.";
    }

    return `Eu iria por este caminho:\n${suggestions
      .slice(0, 4)
      .map((suggestion, index) => `${index + 1}. ${suggestion}`)
      .join("\n")}`;
  }

  function buildPlaybackReply(context) {
    if (context.page === "detail") {
      return "Para ouvir agora, comece pelo botao de previa. Se for um album, vale descer para a lista de faixas e testar uma ou duas antes de salvar.";
    }

    if (context.page === "home") {
      return "Na busca, os cards de album e musica podem ter previa. Voce tambem pode usar 'Radio dos resultados' para tocar uma sequencia quando houver previews disponiveis.";
    }

    if (context.page === "favorites") {
      return "Nos favoritos, a radio usa seus albuns salvos e toca o que tiver previa disponivel. Se uma previa nao existir, o Wikiband simplesmente pula essa possibilidade.";
    }

    return "Quando houver previa disponivel, o app mostra o botao de tocar no card ou na pagina de detalhes. Eu usaria isso para sentir o som antes de favoritar.";
  }

  function inferSearchType(message, context) {
    const normalized = normalizeText(message);

    if (/\b(musica|musicas|faixa|faixas|song|songs)\b/.test(normalized)) return "song";
    if (/\b(artista|artistas|banda|bandas|cantor|cantora)\b/.test(normalized)) return "artist";
    if (/\b(album|albuns|disco|discos)\b/.test(normalized)) return "album";

    return SEARCH_TYPES.has(context.searchType) ? context.searchType : "album";
  }

  function cleanTopicCandidate(value) {
    return compactText(value)
      .replace(/[?!.,;:]+$/g, "")
      .replace(/^["']|["']$/g, "")
      .replace(/^(a|o|as|os|um|uma|uns|umas)\s+/i, "")
      .replace(/\s+(por favor|pfv|pra mim)$/i, "")
      .trim();
  }

  function isRelationshipQuestion(message) {
    return RELATIONSHIP_QUESTION_RE.test(normalizeText(message));
  }

  function getContextTopic(context) {
    if (context.selectedItem?.nome) return context.selectedItem.nome;
    if (context.searchTerm) return context.searchTerm;
    if (context.selectedItem?.album && context.selectedItem.album !== "Discografia") return context.selectedItem.album;
    if (context.selectedItem?.musica) return context.selectedItem.musica;
    return "";
  }

  function isGenericRelationshipTerm(term) {
    const normalized = normalizeText(term);
    return RELATIONSHIP_QUESTION_RE.test(normalized) && normalized.split(/\s+/).length <= 3;
  }

  function extractKnowledgeTerm(message, context) {
    const raw = compactText(message);
    const contextTopic = getContextTopic(context);
    const explicitRelationshipMatch = raw.match(
      /\b(?:integrantes?|membros?|forma[cç][aã]o|vocalistas?|cantores?|cantoras?|guitarristas?|baixistas?|bateristas?|tecladistas?|fundadores?)\s+(?:de|do|da|dos|das)\s+(.+)$/i
    );
    const explicitRelationshipTerm = cleanTopicCandidate(explicitRelationshipMatch?.[1] || "");

    if (explicitRelationshipTerm) {
      return explicitRelationshipTerm;
    }

    if (contextTopic && isRelationshipQuestion(raw)) {
      return contextTopic;
    }

    const patterns = [
      /\b(?:me\s+fala|me\s+fale|fala|fale|conte|me\s+conte)\s+(?:sobre|de|do|da|dos|das)\s+(.+)$/i,
      /\b(?:quem\s+(?:e|eh)|o\s+que\s+voce\s+sabe\s+sobre|o\s+que\s+sabe\s+sobre)\s+(.+)$/i,
      /\b(?:resuma|resume|resumo|explique|explica|contexto\s+de|historia\s+de|historia\s+sobre)\s+(.+)$/i,
      /\bsobre\s+(.+)$/i
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      const term = cleanTopicCandidate(match?.[1] || "");

      if (isGenericRelationshipTerm(term)) {
        return contextTopic || "";
      }

      if (term && !/^(isso|esse|essa|este|esta|item|resultado|busca)$/i.test(term)) {
        return term;
      }
    }

    if (
      context.searchTerm &&
      /\b(sobre|quem|resum|explica|explique|contexto|historia|recomenda|parecido|similar|albuns?|musicas?|faixas?|genero|estilo)\b/.test(
        normalizeText(raw)
      )
    ) {
      return context.searchTerm;
    }

    if (context.selectedItem?.nome) {
      return context.selectedItem.nome;
    }

    if (
      /\b(como usar|o que voce faz|me recomenda uma busca|me recomenda algo|algo parecido|descobrir musicas|usar a busca)\b/.test(
        normalizeText(raw)
      )
    ) {
      return "";
    }

    if (/^[\wÀ-ÿ' -]{2,60}$/.test(raw) && raw.split(/\s+/).length <= 5) {
      return cleanTopicCandidate(raw);
    }

    return "";
  }

  function extractSearchTerm(message) {
    const raw = compactText(message);
    const patterns = [
      /^(?:busca|buscar|pesquisa|pesquisar|procura|procurar)\s+(?:por\s+)?(.+)$/i,
      /\b(?:busca|buscar|pesquisa|pesquisar|procura|procurar)\s+(?:por\s+)?(.+)$/i
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);

      if (match?.[1]) {
        return compactText(
          match[1]
            .replace(/^(musicas?|faixas?|albuns?|discos?|artistas?|bandas?)\s+(?:de|do|da)?\s*/i, "")
            .replace(/^["']|["']$/g, "")
        );
      }
    }

    return "";
  }

  function describeItunesAvailability(bundle) {
    const total = bundle.artists.length + bundle.albums.length + bundle.songs.length;

    if (total > 0) return "";

    return "Nao encontrei um resultado musical claro para esse termo. Tente escrever o nome do artista, album ou musica de outro jeito.";
  }

  function buildItunesAlbumReply(term, bundle) {
    const albums = uniqueBy(bundle.albums, (item) => `${item.artistName}-${item.collectionName}`, 8);
    const artist = getMainArtist(bundle, term);

    if (!albums.length) {
      return `Nao achei albuns suficientes para montar uma rota boa de ${term}. Tente usar o nome exato do artista ou me peca uma busca mais especifica.`;
    }

    const sortedAlbums = [...albums].sort((a, b) => {
      const yearA = getReleaseYear(a.releaseDate) || 9999;
      const yearB = getReleaseYear(b.releaseDate) || 9999;
      return yearA - yearB;
    });
    const oldest = sortedAlbums[0];
    const newest = [...albums].sort((a, b) => (getReleaseYear(b.releaseDate) || 0) - (getReleaseYear(a.releaseDate) || 0))[0];

    return [
      `Para entrar em ${artist.name || term}, eu iria pelos albuns primeiro.`,
      `Uma rota boa: ${albums.slice(0, 5).map(formatAlbumResult).join("; ")}.`,
      oldest ? `Se quiser entender a fase mais antiga que apareceu aqui, comece por ${formatAlbumResult(oldest)}.` : "",
      newest && newest !== oldest ? `Depois compare com ${formatAlbumResult(newest)} para sentir a mudanca de fase.` : "",
      "Meu conselho: escolha um album, ouca duas previas e so depois avance para outro. Esse tipo de artista costuma ficar melhor quando voce percebe a atmosfera de cada disco."
    ]
      .filter(Boolean)
      .join("\n");
  }

  function buildItunesSongReply(term, bundle) {
    const songs = uniqueBy(bundle.songs, (item) => `${item.artistName}-${item.trackName}`, 8);
    const previewSongs = songs.filter((item) => item.previewUrl);
    const artist = getMainArtist(bundle, term);

    if (!songs.length) {
      return `Nao achei faixas suficientes para ${term}. Se for uma musica, tente mandar o nome dela junto com o artista.`;
    }

    return [
      `Para sentir ${artist.name || term}, eu comecaria por estas faixas: ${songs.slice(0, 6).map(formatSongResult).join("; ")}.`,
      previewSongs.length
        ? `Se quiser ouvir agora, procure por ${previewSongs.slice(0, 4).map((item) => item.trackName).join(", ")}: essas sao boas candidatas para previa.`
        : "Nao vi previas claras para essas faixas, entao eu tentaria procurar o artista na aba Musicas e testar outras versoes.",
      "A melhor abordagem e ouvir uma faixa mais conhecida, depois uma mais longa ou atmosferica, para entender melhor o contraste."
    ].join("\n");
  }

  function buildItunesGenreReply(term, bundle) {
    const genres = getBundleGenres(bundle);
    const guide = genres.map(findGenreGuide).find(Boolean);
    const artist = getMainArtist(bundle, term);

    if (!genres.length) {
      return `Nao consegui cravar um genero principal para ${term}. Eu tentaria olhar albuns e faixas para entender melhor a sonoridade.`;
    }

    return [
      `${artist.name || term} cai principalmente em ${genres.join(", ")}.`,
      guide ? guide.text : "Use esses generos como pista, mas confirme ouvindo os albuns: muitos artistas mudam bastante de uma fase para outra.",
      "Uma boa rota e comparar albuns por decada e depois ouvir previews das faixas mais salvas."
    ].join("\n");
  }

  function buildItunesSummaryReply(term, bundle, context) {
    const unavailable = describeItunesAvailability(bundle);
    if (unavailable) return unavailable;

    const artist = getMainArtist(bundle, term);
    const albums = uniqueBy(bundle.albums, (item) => `${item.artistName}-${item.collectionName}`, 6);
    const songs = uniqueBy(bundle.songs, (item) => `${item.artistName}-${item.trackName}`, 6);
    const genres = getBundleGenres(bundle);
    const guide = genres.map(findGenreGuide).find(Boolean);
    const lines = [];

    if (artist.name) {
      lines.push(
        artist.genre
          ? `${artist.name} entra bem no territorio ${artist.genre}.`
          : `${artist.name} e um bom ponto de partida para essa busca.`
      );
    }

    if (albums.length) {
      lines.push(`Eu comecaria pelos albuns ${albums.slice(0, 4).map(formatAlbumResult).join("; ")}.`);
    }

    if (songs.length) {
      lines.push(`Para sentir o som sem se comprometer com um album inteiro, teste ${songs.slice(0, 4).map(formatSongResult).join("; ")}.`);
    }

    if (genres.length) {
      lines.push(`A leitura geral aponta para ${genres.join(", ")}.`);
    }

    if (guide) {
      lines.push(`Como eu exploraria: ${guide.text}`);
    } else if (context.page === "home") {
      lines.push("Como eu exploraria: abriria um album dos primeiros resultados, ouviria previews e salvaria o que chamasse atencao para comparar depois.");
    } else {
      lines.push("Como eu exploraria: alternaria entre Albuns e Musicas para separar discografia de faixas soltas.");
    }

    return lines.join("\n");
  }

  function buildItunesFocusedReply(term, bundle, message, context) {
    const normalized = normalizeText(message);

    if (isRelationshipQuestion(normalized)) {
      const artist = getMainArtist(bundle, term);

      return [
        `Sobre integrantes ou formacao de ${artist.name || term}, eu prefiro nao chutar nomes neste modo.`,
        "Posso te ajudar agora com albuns, fases, faixas e generos. Com a MusicAI conectada ao modo inteligente, essa pergunta fica bem mais completa."
      ].join("\n");
    }

    if (/\b(albuns?|discos?|discografia|mais antigo|primeiro|estreia|mais recente|ultimo|novo)\b/.test(normalized)) {
      return buildItunesAlbumReply(term, bundle);
    }

    if (/\b(musicas?|faixas?|tracks?|preview|previa|tocar|ouvir)\b/.test(normalized)) {
      return buildItunesSongReply(term, bundle);
    }

    if (/\b(genero|generos|estilo|sonoridade|tipo de som)\b/.test(normalized)) {
      return buildItunesGenreReply(term, bundle);
    }

    return buildItunesSummaryReply(term, bundle, context);
  }

  async function buildItunesReply(term, message, context) {
    try {
      const bundle = await searchItunesBundle(term);
      return buildItunesFocusedReply(term, bundle, message, context);
    } catch (error) {
      console.warn("Nao foi possivel buscar referencias pelo assistente:", error);
      return [
        `Tive dificuldade para buscar referencias sobre "${term}" agora.`,
        "Ainda consigo te orientar pelo que esta na tela: filtros, favoritos, colecoes e previews."
      ].join("\n");
    }
  }

  function isHomePage() {
    return getPageKind() === "home";
  }

  function performSearch(term, type) {
    const normalizedType = SEARCH_TYPES.has(type) ? type : "album";

    if (isHomePage()) {
      const searchInput = document.getElementById("searchInput");
      const searchButton = document.getElementById("searchButton");
      const modeButton = document.querySelector(`.mode-btn[data-search-type="${normalizedType}"]`);

      if (searchInput) {
        searchInput.value = term;
      }

      if (modeButton && !modeButton.classList.contains("active")) {
        modeButton.click();
      }

      window.setTimeout(() => {
        searchButton?.click();
      }, 80);

      return `Fechado. Vou pesquisar "${term}" em ${MODE_LABELS[normalizedType]}.`;
    }

    window.setTimeout(() => {
      window.location.href = `/index.html?q=${encodeURIComponent(term)}&type=${encodeURIComponent(normalizedType)}`;
    }, 350);

    return `Vou abrir a busca por "${term}" em ${MODE_LABELS[normalizedType]}.`;
  }

  function buildDefaultReply(context) {
    if (context.selectedItem) {
      return `Posso ajudar com ${itemTitle(context.selectedItem)}. Tente perguntar: "resume esse item", "me recomenda algo parecido" ou "como explorar esse artista?".`;
    }

    if (context.searchTerm) {
      return `Estou acompanhando sua busca por "${context.searchTerm}". Posso sugerir filtros, recomendar proximas buscas ou explicar generos que aparecem nos resultados.`;
    }

    if (context.visibleResults.length) {
      return `Tenho alguns resultados visiveis para usar como contexto. Se quiser, pergunte "me recomenda algo" ou "como eu escolho por onde comecar?".`;
    }

    return "Me diga um artista, album, musica ou genero. Se quiser que eu acione a busca, escreva algo como: pesquisar albuns de Radiohead.";
  }

  async function generateReply(message) {
    const context = getCurrentContext();
    const normalized = normalizeText(message);
    const searchTerm = extractSearchTerm(message);
    const knowledgeTerm = extractKnowledgeTerm(message, context);

    if (!normalized) {
      return "Manda uma pergunta ou um artista para eu te ajudar.";
    }

    if (/\b(oi|ola|e ai|salve|bom dia|boa tarde|boa noite)\b/.test(normalized)) {
      return buildWelcomeText(context);
    }

    if (/\b(custo|gratis|gratuito|pago|paga|openai|api key|chave)\b/.test(normalized)) {
      return buildCostReply();
    }

    if (/\b(ajuda|pode fazer|voce faz|como funciona|como usar|usar a busca|comandos)\b/.test(normalized)) {
      return buildCapabilities(context);
    }

    if (searchTerm) {
      const inferredType = inferSearchType(message, context);
      const searchResponse = performSearch(searchTerm, inferredType);
      const backendResponse = await askMusicAiBackend(message, {
        ...context,
        searchTerm,
        searchType: inferredType
      });

      if (backendResponse) {
        return `${searchResponse}\n\n${backendResponse}`;
      }

      const itunesResponse = await buildItunesReply(searchTerm, message, context);
      return `${searchResponse}\n\n${itunesResponse}`;
    }

    const backendReply = await askMusicAiBackend(message, context);
    if (backendReply) return backendReply;

    if (/\b(favorito|favoritos|colecao|colecoes|perfil|meu gosto|meus dados|painel)\b/.test(normalized)) {
      return buildFavoritesReply(context);
    }

    if (/\b(recomenda|recomendacao|indica|parecido|similar|ouvir|descobrir|proximo|proxima)\b/.test(normalized)) {
      if (knowledgeTerm) {
        const itunesResponse = await buildItunesReply(knowledgeTerm, message, context);
        return `${itunesResponse}\n\nMinha sugestao: comece por 1 album forte, ouca 2 previews e salve o que combinar com seu gosto. Depois eu consigo comparar com seus favoritos.`;
      }

      return buildRecommendationReply(context);
    }

    if (/\b(genero|estilo|tipo de som|sonoridade)\b/.test(normalized)) {
      if (knowledgeTerm) {
        return buildItunesReply(knowledgeTerm, message, context);
      }

      return buildGenreReply(context, message);
    }

    if (/\b(previa|preview|tocar|radio|faixa|faixas|musica|musicas)\b/.test(normalized)) {
      if (knowledgeTerm) {
        return buildItunesReply(knowledgeTerm, message, context);
      }

      return buildPlaybackReply(context);
    }

    if (/\b(resumo|resume|resuma|sobre|quem e|contexto|historia|explica|explique|album|artista|banda)\b/.test(normalized)) {
      if (knowledgeTerm) {
        return buildItunesReply(knowledgeTerm, message, context);
      }

      return buildSummaryReply(context);
    }

    if (knowledgeTerm) {
      return buildItunesReply(knowledgeTerm, message, context);
    }

    return buildDefaultReply(context);
  }

  function appendFormattedInline(parent, value) {
    const text = String(value || "");
    let cursor = 0;

    while (cursor < text.length) {
      const markerIndex = text.indexOf("*", cursor);

      if (markerIndex === -1) {
        parent.appendChild(document.createTextNode(text.slice(cursor)));
        return;
      }

      if (markerIndex > cursor) {
        parent.appendChild(document.createTextNode(text.slice(cursor, markerIndex)));
      }

      if (text.startsWith("***", markerIndex)) {
        const endIndex = text.indexOf("***", markerIndex + 3);

        if (endIndex !== -1) {
          const strong = createNode("strong");
          strong.appendChild(createNode("em", "", text.slice(markerIndex + 3, endIndex)));
          parent.appendChild(strong);
          cursor = endIndex + 3;
          continue;
        }
      }

      if (text.startsWith("**", markerIndex)) {
        const endIndex = text.indexOf("**", markerIndex + 2);

        if (endIndex !== -1) {
          parent.appendChild(createNode("strong", "", text.slice(markerIndex + 2, endIndex)));
          cursor = endIndex + 2;
          continue;
        }
      }

      const endIndex = text.indexOf("*", markerIndex + 1);

      if (endIndex !== -1) {
        parent.appendChild(createNode("em", "", text.slice(markerIndex + 1, endIndex)));
        cursor = endIndex + 1;
        continue;
      }

      cursor = markerIndex + 1;
    }
  }

  function renderMessageText(node, value) {
    const lines = String(value || "").split("\n");
    node.replaceChildren();

    lines.forEach((line, index) => {
      if (index > 0) {
        node.appendChild(document.createElement("br"));
      }

      appendFormattedInline(node, line);
    });
  }

  function renderMessage(message) {
    const row = createNode("div", `music-assistant-message ${message.role === "user" ? "is-user" : "is-assistant"}`);
    const bubble = createNode("div", "music-assistant-bubble");
    const text = createNode("p");
    const time = createNode("span", "music-assistant-time", formatTime(message.at));

    renderMessageText(text, message.text);
    bubble.append(text, time);
    row.appendChild(bubble);
    return row;
  }

  function formatTime(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();

    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderMessages() {
    messagesList.replaceChildren(...messages.map(renderMessage));
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  function appendMessage(message, { animate = true } = {}) {
    const row = renderMessage(message);

    if (animate) {
      row.classList.add("is-new");
    }

    messagesList.appendChild(row);
    messagesList.scrollTop = messagesList.scrollHeight;
    return row;
  }

  function addMessage(role, text) {
    const message = {
      role,
      text: cleanMessageText(text),
      at: Date.now()
    };

    messages.push(message);
    messages = messages.slice(-MAX_MESSAGES);
    saveMessages();

    if (messagesList) {
      appendMessage(message);
      return message;
    }

    renderMessages();
    return message;
  }

  async function addAssistantMessageAnimated(text) {
    const finalText = cleanMessageText(text);
    const chunks = finalText.match(/\S+\s*/g) || [finalText];
    const chunkSize = chunks.length > 90 ? 4 : chunks.length > 45 ? 2 : 1;
    const message = {
      role: "assistant",
      text: "",
      at: Date.now()
    };

    messages.push(message);
    messages = messages.slice(-MAX_MESSAGES);

    const row = appendMessage(message);
    const textNode = row.querySelector("p");
    row.classList.add("is-writing");

    for (let index = 0; index < chunks.length; index += chunkSize) {
      message.text += chunks.slice(index, index + chunkSize).join("");
      renderMessageText(textNode, message.text);
      messagesList.scrollTop = messagesList.scrollHeight;
      await delay(chunks.length > 90 ? 12 : 20);
    }

    message.text = finalText;
    renderMessageText(textNode, finalText);
    row.classList.remove("is-writing");
    saveMessages();
  }

  function setTyping(isTyping, label = "Pensando") {
    if (!isTyping) {
      typingRow?.remove();
      typingRow = null;
      return;
    }

    typingRow = createNode("div", "music-assistant-message is-assistant is-typing");
    const bubble = createNode("div", "music-assistant-bubble");
    const typingLabel = createNode("span", "typing-label", label);
    const dots = createNode("span", "typing-dots");

    dots.append(createNode("span", "typing-dot"), createNode("span", "typing-dot"), createNode("span", "typing-dot"));
    bubble.append(typingLabel, dots);
    typingRow.appendChild(bubble);
    messagesList.appendChild(typingRow);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  function setResponding(nextValue) {
    isResponding = nextValue;
    root.classList.toggle("is-responding", nextValue);

    if (input) {
      input.readOnly = nextValue;
    }

    if (sendButton) {
      sendButton.disabled = nextValue;
      sendButton.textContent = nextValue ? "..." : "Enviar";
      sendButton.setAttribute("aria-busy", nextValue ? "true" : "false");
    }
  }

  function renderQuickPrompts() {
    const context = getCurrentContext();
    const buttons = getQuickPrompts(context).map((prompt) => {
      const button = createNode("button", "music-assistant-chip", prompt);
      button.type = "button";
      button.addEventListener("click", () => submitPrompt(prompt));
      return button;
    });

    quickPrompts.replaceChildren(...buttons);
  }

  function submitPrompt(prompt) {
    input.value = prompt;
    form.requestSubmit();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isResponding) return;

    const message = compactText(input.value);
    if (!message) return;

    input.value = "";
    addMessage("user", message);
    setResponding(true);
    setTyping(true, "Pensando");

    try {
      const reply = await generateReply(message);
      setTyping(false);
      await addAssistantMessageAnimated(reply);
      renderQuickPrompts();
    } catch (error) {
      console.warn("Falha na MusicAI:", error);
      setTyping(false);
      await addAssistantMessageAnimated("Nao consegui responder agora. Tente reformular com nome de artista, album ou musica.");
    } finally {
      setResponding(false);
    }
  }

  function openAssistant() {
    root.classList.add("is-open");
    toggleButton.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-hidden", "false");
    renderQuickPrompts();

    if (!messages.length) {
      addMessage("assistant", buildWelcomeText(getCurrentContext()));
    }

    window.setTimeout(() => input.focus(), 120);
  }

  function closeAssistant() {
    root.classList.remove("is-open");
    toggleButton.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");
    toggleButton.focus();
  }

  function toggleAssistant() {
    if (root.classList.contains("is-open")) {
      closeAssistant();
      return;
    }

    openAssistant();
  }

  function clearConversation() {
    messages = [];
    saveMessages();
    renderMessages();
    addMessage("assistant", buildWelcomeText(getCurrentContext()));
  }

  function buildUi() {
    root = createNode("section", "music-assistant");
    root.setAttribute("aria-label", "MusicAI");

    toggleButton = createNode("button", "music-assistant-toggle");
    toggleButton.type = "button";
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.setAttribute("aria-controls", "musicAssistantPanel");
    toggleButton.setAttribute("aria-label", "Abrir MusicAI");

    const toggleIcon = createNode("span", "music-assistant-toggle-icon", "IA");
    const toggleText = createNode("span", "music-assistant-toggle-text", "MusicAI");
    toggleButton.append(toggleIcon, toggleText);

    panel = createNode("aside", "music-assistant-panel");
    panel.id = "musicAssistantPanel";
    panel.setAttribute("aria-hidden", "true");

    const header = createNode("div", "music-assistant-header");
    const titleWrap = createNode("div");
    const title = createNode("h2", "", "MusicAI");
    const status = createNode("p", "", "Descoberta musical em tempo real");
    const headerActions = createNode("div", "music-assistant-header-actions");
    const clearButton = createNode("button", "music-assistant-icon-btn", "Limpar");
    const closeButton = createNode("button", "music-assistant-icon-btn", "Fechar");

    clearButton.type = "button";
    closeButton.type = "button";
    clearButton.addEventListener("click", clearConversation);
    closeButton.addEventListener("click", closeAssistant);
    titleWrap.append(title, status);
    headerActions.append(clearButton, closeButton);
    header.append(titleWrap, headerActions);

    messagesList = createNode("div", "music-assistant-messages");
    messagesList.setAttribute("aria-live", "polite");

    quickPrompts = createNode("div", "music-assistant-prompts");

    form = createNode("form", "music-assistant-form");
    input = createNode("textarea", "music-assistant-input");
    sendButton = createNode("button", "music-assistant-send", "Enviar");

    input.rows = 1;
    input.placeholder = "Pergunte sobre artistas, albuns ou favoritos...";
    input.setAttribute("aria-label", "Mensagem para a MusicAI");
    sendButton.type = "submit";
    form.append(input, sendButton);

    form.addEventListener("submit", handleSubmit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    panel.append(header, messagesList, quickPrompts, form);
    root.append(toggleButton, panel);
    document.body.appendChild(root);

    toggleButton.addEventListener("click", toggleAssistant);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && root.classList.contains("is-open")) {
        closeAssistant();
      }
    });
  }

  function init() {
    messages = loadMessages();
    buildUi();
    renderMessages();
    renderQuickPrompts();
  }

  window.WikibandMusicAssistant = {
    open: openAssistant,
    close: closeAssistant,
    ask: submitPrompt
  };

  onReady(init);
})(window, document);
