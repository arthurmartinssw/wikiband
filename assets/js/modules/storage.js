(function initWikibandStorage(window) {
  const HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  };
  const HISTORY_KEY = "wikiband_history";
  const ALBUM_FAVORITES_KEY = "wikiband_favorites";
  const BAND_FAVORITES_KEY = "wikiband_band_favorites";
  const PLAY_HISTORY_KEY = "wikiband_play_history";
  const COLLECTIONS_KEY = "wikiband_collections";
  const SESSION_KEY = "wikiband_session";
  const WELCOME_KEY = "wikiband_welcome_pending";
  const AVATAR_KEY = "wikiband_avatar";
  const API_BASE_STORAGE_KEY = "wikiband_api_base_url";
  const SCOPED_SEPARATOR = "__";
  const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
  const NAME_MAX_LENGTH = 80;
  const EMAIL_MAX_LENGTH = 254;
  const PASSWORD_MAX_LENGTH = 128;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
  }

  function sanitizeUrl(value, { allowedProtocols = ["https:"], fallback = "" } = {}) {
    const rawValue = String(value || "").trim();

    if (!rawValue) {
      return fallback;
    }

    try {
      const url = new URL(rawValue, window.location.origin);

      if (!allowedProtocols.includes(url.protocol)) {
        return fallback;
      }

      return url.href;
    } catch (error) {
      return fallback;
    }
  }

  function safeImageUrl(value, fallback = "https://via.placeholder.com/600x400?text=Sem+Imagem") {
    const rawValue = String(value || "").trim();

    if (rawValue.startsWith("data:") && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(rawValue)) {
      return fallback;
    }

    return sanitizeUrl(value, {
      allowedProtocols: ["https:", "data:"],
      fallback
    });
  }

  function safeExternalUrl(value, fallback = "#") {
    return sanitizeUrl(value, {
      allowedProtocols: ["https:"],
      fallback
    });
  }

  window.WikibandSafe = {
    escapeHtml,
    safeExternalUrl,
    safeImageUrl
  };

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

  function normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return email.length <= EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(password) {
    if (password.length < 8) return "Senha deve ter pelo menos 8 caracteres.";
    if (password.length > PASSWORD_MAX_LENGTH) return `Senha deve ter no maximo ${PASSWORD_MAX_LENGTH} caracteres.`;
    if (!/[A-Z]/.test(password)) return "Senha deve ter pelo menos uma letra maiuscula.";
    if (!/\d/.test(password)) return "Senha deve ter pelo menos um numero.";
    return "";
  }

  function validateUsername(username) {
    if (!USERNAME_REGEX.test(username)) {
      return "Use 3 a 24 caracteres: letras minusculas, numeros e underline.";
    }

    return "";
  }

  function normalizeBaseUrl(url) {
    return String(url || "")
      .trim()
      .replace(/\/+$/, "");
  }

  function isLocalRuntime() {
    const hostname = String(window.location?.hostname || "");
    return window.location?.protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1";
  }

  function getApiBaseUrl() {
    const configuredBaseUrl = normalizeBaseUrl(localStorage.getItem(API_BASE_STORAGE_KEY));
    if (configuredBaseUrl && isLocalRuntime()) return configuredBaseUrl;

    if (window.location?.protocol === "file:") {
      return "http://localhost:3000/api";
    }

    return "/api";
  }

  function buildApiUrl(path) {
    const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
  }

  async function requestJson(path, { method = "GET", payload, token } = {}) {
    const headers = {
      "Accept": "application/json"
    };

    if (typeof payload !== "undefined") {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(buildApiUrl(path), {
      method,
      headers,
      body: typeof payload === "undefined" ? undefined : JSON.stringify(payload || {})
    });

    let body = null;
    try {
      body = await response.json();
    } catch (erro) {
      body = null;
    }

    return {
      response,
      body
    };
  }

  async function postJson(path, payload, options = {}) {
    return requestJson(path, {
      method: "POST",
      payload,
      token: options.token
    });
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

  function getScopedAvatarKey() {
    const scopeId = getStorageScopeId();
    if (!scopeId) return null;
    return `${AVATAR_KEY}${SCOPED_SEPARATOR}${scopeId}`;
  }

  function isSafeAvatarDataUrl(value) {
    return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(String(value || ""));
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

  function saveCurrentSession(session) {
    const normalizedSession = {
      nome: String(session?.nome || "").trim(),
      username: normalizeUsername(session?.username),
      email: normalizeEmail(session?.email),
      token: String(session?.token || ""),
      loggedAt: Number(session?.loggedAt) || Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(normalizedSession));
    return normalizedSession;
  }

  function updateCurrentSession(updates = {}) {
    const currentSession = getCurrentSession();
    if (!currentSession) return null;

    return saveCurrentSession({
      ...currentSession,
      ...updates,
      loggedAt: currentSession.loggedAt || Date.now()
    });
  }

  function getCurrentSession() {
    const session = readObject(SESSION_KEY);
    const loggedAt = Number(session?.loggedAt);

    if (!session || !session.email || !session.nome || !Number.isFinite(loggedAt)) {
      return null;
    }

    return {
      nome: String(session.nome),
      username: normalizeUsername(session.username),
      email: normalizeEmail(session.email),
      token: String(session.token || ""),
      loggedAt
    };
  }

  function clearCurrentSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function setWelcomePending() {
    localStorage.setItem(WELCOME_KEY, "1");
  }

  function consumeWelcomePending() {
    const isPending = localStorage.getItem(WELCOME_KEY) === "1";
    if (isPending) {
      localStorage.removeItem(WELCOME_KEY);
    }
    return isPending;
  }

  function getCurrentAvatar() {
    const key = getScopedAvatarKey();
    if (!key) return "";
    const avatar = String(localStorage.getItem(key) || "");
    return isSafeAvatarDataUrl(avatar) ? avatar : "";
  }

  function saveCurrentAvatar(dataUrl) {
    const key = getScopedAvatarKey();
    if (!key) return "";

    const normalizedDataUrl = String(dataUrl || "");

    if (!normalizedDataUrl) {
      localStorage.removeItem(key);
      return "";
    }

    if (!isSafeAvatarDataUrl(normalizedDataUrl)) {
      localStorage.removeItem(key);
      return "";
    }

    localStorage.setItem(key, normalizedDataUrl);
    return normalizedDataUrl;
  }

  function getUserInitials(user = getCurrentSession()) {
    const name = String(user?.nome || "").trim();
    const username = String(user?.username || "").trim();
    const source = name || username || String(user?.email || "");
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase() || "WB";
  }

  async function registerUser({ nome, username, email, senha } = {}) {
    const normalizedName = String(nome || "").trim();
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(senha || "");

    if (!normalizedName || !normalizedUsername || !normalizedEmail || !normalizedPassword) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Preencha nome, nome de usuario, e-mail e senha."
      };
    }

    if (normalizedName.length > NAME_MAX_LENGTH) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `Nome deve ter no maximo ${NAME_MAX_LENGTH} caracteres.`
      };
    }

    const usernameError = validateUsername(normalizedUsername);

    if (usernameError) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: usernameError
      };
    }

    if (!isValidEmail(normalizedEmail)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Informe um e-mail valido."
      };
    }

    const passwordError = validatePassword(normalizedPassword);

    if (passwordError) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: passwordError
      };
    }

    try {
      const { response, body } = await postJson("/auth/register", {
        nome: normalizedName,
        username: normalizedUsername,
        email: normalizedEmail,
        senha: normalizedPassword
      });

      if (!response.ok || !body?.ok) {
        return {
          ok: false,
          code: body?.code || "REQUEST_ERROR",
          message: body?.message || "Nao foi possivel criar a conta."
        };
      }

      return {
        ok: true,
        code: body.code || "REGISTERED",
        message: body.message || "Conta criada com sucesso.",
        user: {
          nome: String(body.user?.nome || normalizedName),
          username: normalizeUsername(body.user?.username || normalizedUsername),
          email: normalizeEmail(body.user?.email || normalizedEmail)
        }
      };
    } catch (erro) {
      console.warn("Falha ao cadastrar usuario:", erro);
      return {
        ok: false,
        code: "NETWORK_ERROR",
        message: "Nao foi possivel conectar ao servidor de autenticacao."
      };
    }
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

    try {
      const { response, body } = await postJson("/auth/login", {
        email: normalizedEmail,
        senha: normalizedPassword
      });

      if (!response.ok || !body?.ok) {
        clearCurrentSession();
        return {
          ok: false,
          code: body?.code || "INVALID_CREDENTIALS",
          message: body?.message || "E-mail ou senha invalidos."
        };
      }

      const session = saveCurrentSession({
        nome: String(body.user?.nome || ""),
        username: normalizeUsername(body.user?.username),
        email: normalizeEmail(body.user?.email || normalizedEmail),
        token: String(body.token || ""),
        loggedAt: Date.now()
      });

      setWelcomePending();

      return {
        ok: true,
        code: body.code || "AUTHENTICATED",
        message: body.message || "Login realizado com sucesso.",
        user: session
      };
    } catch (erro) {
      console.warn("Falha ao autenticar usuario:", erro);
      clearCurrentSession();
      return {
        ok: false,
        code: "NETWORK_ERROR",
        message: "Nao foi possivel conectar ao servidor de autenticacao."
      };
    }
  }

  async function updateUserProfile({ nome, username } = {}) {
    const session = getCurrentSession();
    const normalizedName = String(nome || "").trim();
    const normalizedUsername = normalizeUsername(username);

    if (!session?.token) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Entre novamente para atualizar o perfil."
      };
    }

    if (!normalizedName || !normalizedUsername) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Preencha nome e nome de usuario."
      };
    }

    if (normalizedName.length > NAME_MAX_LENGTH) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `Nome deve ter no maximo ${NAME_MAX_LENGTH} caracteres.`
      };
    }

    const usernameError = validateUsername(normalizedUsername);

    if (usernameError) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: usernameError
      };
    }

    try {
      const { response, body } = await postJson(
        "/auth/profile",
        {
          nome: normalizedName,
          username: normalizedUsername
        },
        { token: session.token }
      );

      if (!response.ok || !body?.ok) {
        return {
          ok: false,
          code: body?.code || "REQUEST_ERROR",
          message: body?.message || "Nao foi possivel atualizar o perfil."
        };
      }

      const updatedSession = saveCurrentSession({
        nome: String(body.user?.nome || normalizedName),
        username: normalizeUsername(body.user?.username || normalizedUsername),
        email: normalizeEmail(body.user?.email || session.email),
        token: String(body.token || session.token),
        loggedAt: session.loggedAt || Date.now()
      });

      return {
        ok: true,
        code: body.code || "PROFILE_UPDATED",
        message: body.message || "Perfil atualizado com sucesso.",
        user: updatedSession
      };
    } catch (erro) {
      console.warn("Falha ao atualizar perfil:", erro);
      return {
        ok: false,
        code: "NETWORK_ERROR",
        message: "Nao foi possivel conectar ao servidor de autenticacao."
      };
    }
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
    buildApiUrl,
    buildItemKey,
    clearCurrentSession,
    consumeWelcomePending,
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
    getCurrentAvatar,
    getCurrentSession,
    getDashboardData,
    getHistory,
    getPlayHistory,
    getUserInitials,
    isAlbumFavorite,
    isBandFavorite,
    registerUser,
    removeItemFromCollection,
    renameCollection,
    saveCurrentAvatar,
    toggleAlbumFavorite,
    toggleBandFavorite,
    updateCurrentSession,
    updateUserProfile,
    validatePassword,
    validateUsername
  };
})(window);
