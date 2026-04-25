(function initWikibandStorage(window) {
  const HISTORY_KEY = "wikiband_history";
  const ALBUM_FAVORITES_KEY = "wikiband_favorites";
  const BAND_FAVORITES_KEY = "wikiband_band_favorites";
  const PLAY_HISTORY_KEY = "wikiband_play_history";
  const COLLECTIONS_KEY = "wikiband_collections";
  const USER_KEY_PREFIX = "wikiband_user_";
  const SESSION_KEY = "wikiband_session";
  const SCOPED_SEPARATOR = "__";

  function readList(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (erro) {
      console.warn(`Nao foi possivel ler ${key}:`, erro);
      return [];
    }
  }

  function saveList(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  function readObject(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (erro) {
      console.warn(`Nao foi possivel ler ${key}:`, erro);
      return null;
    }
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function getUserStorageKey(email) {
    const normalizedEmail = normalizeEmail(email);
    return `${USER_KEY_PREFIX}${encodeURIComponent(normalizedEmail)}`;
  }

  function getStorageScopeId() {
    const session = getCurrentSession();
    if (!session?.email) return null;
    return encodeURIComponent(session.email);
  }

  function getScopedKey(baseKey) {
    const scopeId = getStorageScopeId();
    if (!scopeId) return null;
    return `${baseKey}${SCOPED_SEPARATOR}${scopeId}`;
  }

  function readScopedList(baseKey) {
    const key = getScopedKey(baseKey);
    if (!key) return [];
    return readList(key);
  }

  function saveScopedList(baseKey, items) {
    const key = getScopedKey(baseKey);
    if (!key) return items;
    saveList(key, items);
    return items;
  }

  function clearScopedList(baseKey) {
    const key = getScopedKey(baseKey);
    if (!key) return;
    localStorage.removeItem(key);
  }

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function hashPassword(password) {
    const normalizedPassword = String(password || "");
    if (!normalizedPassword) return null;

    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder === "undefined") {
      return null;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedPassword);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }

  function saveCurrentSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getCurrentSession() {
    const session = readObject(SESSION_KEY);
    const loggedAt = Number(session?.loggedAt);

    if (!session || !session.email || !session.nome || !Number.isFinite(loggedAt)) {
      return null;
    }

    return {
      nome: String(session.nome),
      email: normalizeEmail(session.email),
      loggedAt
    };
  }

  function clearCurrentSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function registerUser({ nome, email, senha } = {}) {
    const normalizedName = String(nome || "").trim();
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(senha || "");

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Preencha nome, e-mail e senha."
      };
    }

    if (!isValidEmail(normalizedEmail)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Informe um e-mail valido."
      };
    }

    const userKey = getUserStorageKey(normalizedEmail);
    if (localStorage.getItem(userKey)) {
      return {
        ok: false,
        code: "EMAIL_EXISTS",
        message: "Este e-mail ja esta cadastrado."
      };
    }

    const passwordHash = await hashPassword(normalizedPassword);
    if (!passwordHash) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Nao foi possivel proteger a senha neste navegador."
      };
    }

    const userRecord = {
      nome: normalizedName,
      email: normalizedEmail,
      passwordHash,
      createdAt: Date.now()
    };

    localStorage.setItem(userKey, JSON.stringify(userRecord));

    return {
      ok: true,
      code: "REGISTERED",
      message: "Conta criada com sucesso.",
      user: {
        nome: userRecord.nome,
        email: userRecord.email
      }
    };
  }

  async function authenticateUser({ email, senha } = {}) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(senha || "");

    if (!normalizedEmail || !normalizedPassword) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Informe e-mail e senha."
      };
    }

    if (!isValidEmail(normalizedEmail)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Informe um e-mail valido."
      };
    }

    const userKey = getUserStorageKey(normalizedEmail);
    const savedUser = readObject(userKey);

    if (!savedUser || !savedUser.passwordHash) {
      clearCurrentSession();
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "E-mail ou senha invalidos."
      };
    }

    const passwordHash = await hashPassword(normalizedPassword);
    if (!passwordHash) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Nao foi possivel validar a senha neste navegador."
      };
    }

    if (passwordHash !== savedUser.passwordHash) {
      clearCurrentSession();
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "E-mail ou senha invalidos."
      };
    }

    const session = {
      nome: String(savedUser.nome || ""),
      email: normalizedEmail,
      loggedAt: Date.now()
    };

    saveCurrentSession(session);

    return {
      ok: true,
      code: "AUTHENTICATED",
      message: "Login realizado com sucesso.",
      user: session
    };
  }

  function parseYear(valor) {
    const numero = Number(valor);
    if (Number.isFinite(numero) && numero > 0) {
      return numero;
    }

    const texto = String(valor || "");
    const match = texto.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  }

  function getDecadeLabel(valor) {
    const ano = parseYear(valor);
    if (!ano) return "Nao informado";

    const decada = Math.floor(ano / 10) * 10;
    return `${decada}s`;
  }

  function buildItemKey(item) {
    if (!item) return "unknown:0";

    const tipo = item.tipo || (item.trackId ? "song" : item.albumId ? "album" : "artist");

    if (tipo === "song") {
      return `song:${item.trackId || `${item.nome || "artista"}-${item.musica || item.album || "musica"}`}`;
    }

    if (tipo === "artist") {
      return `artist:${item.bandaId || item.artistId || item.nome || "desconhecido"}`;
    }

    return `album:${item.albumId || `${item.nome || "artista"}-${item.album || "album"}-${item.lancamento || "ano"}`}`;
  }

  function topEntries(counter, limit = 5) {
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, total]) => ({ label, total }));
  }

  function increaseCounter(counter, key, amount = 1) {
    const label = String(key || "Nao informado").trim() || "Nao informado";
    counter.set(label, (counter.get(label) || 0) + amount);
  }

  function getHistory() {
    return readScopedList(HISTORY_KEY);
  }

  function addHistoryTerm(term, type) {
    const key = `${type}:${term}`;
    let history = getHistory().filter((item) => {
      const itemKey = typeof item === "string" ? `album:${item}` : `${item.type}:${item.term}`;
      return itemKey.toLowerCase() !== key.toLowerCase();
    });

    history.unshift({ term, type });
    history = history.slice(0, 12);
    saveScopedList(HISTORY_KEY, history);
    return history;
  }

  function clearHistory() {
    clearScopedList(HISTORY_KEY);
  }

  function getAlbumFavorites() {
    return readScopedList(ALBUM_FAVORITES_KEY);
  }

  function isAlbumFavorite(albumId) {
    return getAlbumFavorites().some((item) => item.albumId === albumId);
  }

  function toggleAlbumFavorite(album) {
    let favorites = getAlbumFavorites();

    if (favorites.some((item) => item.albumId === album.albumId)) {
      favorites = favorites.filter((item) => item.albumId !== album.albumId);
    } else {
      favorites.unshift(album);
    }

    saveScopedList(ALBUM_FAVORITES_KEY, favorites);
    return favorites;
  }

  function clearAlbumFavorites() {
    clearScopedList(ALBUM_FAVORITES_KEY);
  }

  function getBandFavorites() {
    return readScopedList(BAND_FAVORITES_KEY);
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

    saveScopedList(BAND_FAVORITES_KEY, favorites);
    return favorites;
  }

  function clearBandFavorites() {
    clearScopedList(BAND_FAVORITES_KEY);
  }

  function getPlayHistory() {
    return readScopedList(PLAY_HISTORY_KEY);
  }

  function addPlayEvent(item) {
    if (!item) return getPlayHistory();

    const event = {
      ts: Date.now(),
      key: buildItemKey(item),
      tipo: item.tipo || (item.trackId ? "song" : item.albumId ? "album" : "artist"),
      nome: item.nome || item.artista || "Artista desconhecido",
      musica: item.musica || item.nome || "",
      album: item.album || "",
      genero: item.genero || "Nao informado",
      pais: item.pais || "Nao informado",
      lancamento: item.lancamento || ""
    };

    const plays = getPlayHistory();
    plays.unshift(event);
    saveScopedList(PLAY_HISTORY_KEY, plays.slice(0, 240));
    return plays;
  }

  function clearPlayHistory() {
    clearScopedList(PLAY_HISTORY_KEY);
  }

  function getCollections() {
    return readScopedList(COLLECTIONS_KEY).map((collection) => ({
      ...collection,
      items: Array.isArray(collection.items) ? collection.items : []
    }));
  }

  function saveCollections(collections) {
    saveScopedList(COLLECTIONS_KEY, collections);
    return collections;
  }

  function createCollection(name) {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) return null;

    const collections = getCollections();
    const existing = collections.find(
      (collection) => collection.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    const collection = {
      id: `collection_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      createdAt: Date.now(),
      items: []
    };

    collections.unshift(collection);
    saveCollections(collections);
    return collection;
  }

  function renameCollection(collectionId, nextName) {
    const trimmedName = String(nextName || "").trim();
    if (!trimmedName) return getCollections();

    const collections = getCollections().map((collection) => {
      if (collection.id !== collectionId) return collection;
      return {
        ...collection,
        name: trimmedName
      };
    });

    return saveCollections(collections);
  }

  function deleteCollection(collectionId) {
    const collections = getCollections().filter((collection) => collection.id !== collectionId);
    return saveCollections(collections);
  }

  function addItemToCollection(collectionId, item) {
    const itemKey = buildItemKey(item);

    const collections = getCollections().map((collection) => {
      if (collection.id !== collectionId) return collection;

      if (collection.items.some((saved) => saved.key === itemKey)) {
        return collection;
      }

      return {
        ...collection,
        items: [{ key: itemKey, addedAt: Date.now(), item }, ...collection.items]
      };
    });

    return saveCollections(collections);
  }

  function removeItemFromCollection(collectionId, itemKey) {
    const collections = getCollections().map((collection) => {
      if (collection.id !== collectionId) return collection;

      return {
        ...collection,
        items: collection.items.filter((saved) => saved.key !== itemKey)
      };
    });

    return saveCollections(collections);
  }

  function ensureCollectionByName(name) {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) return null;

    const existing = getCollections().find(
      (collection) => collection.name.toLowerCase() === trimmedName.toLowerCase()
    );

    return existing || createCollection(trimmedName);
  }

  function getDashboardData() {
    const history = getHistory();
    const albumFavorites = getAlbumFavorites();
    const bandFavorites = getBandFavorites();
    const playHistory = getPlayHistory();
    const collections = getCollections();

    const genreCounter = new Map();
    const artistCounter = new Map();
    const decadeCounter = new Map();

    albumFavorites.forEach((item) => {
      increaseCounter(genreCounter, item.genero, 2);
      increaseCounter(artistCounter, item.nome, 2);
      increaseCounter(decadeCounter, getDecadeLabel(item.lancamento), 2);
    });

    bandFavorites.forEach((item) => {
      increaseCounter(genreCounter, item.genero, 2);
      increaseCounter(artistCounter, item.nome, 2);
      increaseCounter(decadeCounter, getDecadeLabel(item.lancamento), 1);
    });

    playHistory.forEach((event) => {
      increaseCounter(genreCounter, event.genero, 1);
      increaseCounter(artistCounter, event.nome, 1);
      increaseCounter(decadeCounter, getDecadeLabel(event.lancamento), 1);
    });

    return {
      totals: {
        searches: history.length,
        albumFavorites: albumFavorites.length,
        bandFavorites: bandFavorites.length,
        plays: playHistory.length,
        collections: collections.length
      },
      topGenres: topEntries(genreCounter),
      topArtists: topEntries(artistCounter),
      topDecades: topEntries(decadeCounter)
    };
  }

  window.WikibandStorage = {
    authenticateUser,
    addHistoryTerm,
    addItemToCollection,
    addPlayEvent,
    buildItemKey,
    clearCurrentSession,
    clearAlbumFavorites,
    clearBandFavorites,
    clearHistory,
    clearPlayHistory,
    createCollection,
    deleteCollection,
    ensureCollectionByName,
    getAlbumFavorites,
    getBandFavorites,
    getCollections,
    getCurrentSession,
    getDashboardData,
    getHistory,
    getPlayHistory,
    isAlbumFavorite,
    isBandFavorite,
    registerUser,
    removeItemFromCollection,
    renameCollection,
    toggleAlbumFavorite,
    toggleBandFavorite
  };
})(window);
