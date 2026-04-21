(function initWikibandStorage(window) {
  const HISTORY_KEY = "wikiband_history";
  const ALBUM_FAVORITES_KEY = "wikiband_favorites";
  const BAND_FAVORITES_KEY = "wikiband_band_favorites";

  function readList(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (erro) {
      console.warn(`Não foi possível ler ${key}:`, erro);
      return [];
    }
  }

  function saveList(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  function getHistory() {
    return readList(HISTORY_KEY);
  }

  function addHistoryTerm(term, type) {
    const key = `${type}:${term}`;
    let history = getHistory().filter((item) => {
      const itemKey = typeof item === "string" ? `album:${item}` : `${item.type}:${item.term}`;
      return itemKey.toLowerCase() !== key.toLowerCase();
    });

    history.unshift({ term, type });
    history = history.slice(0, 8);
    saveList(HISTORY_KEY, history);
    return history;
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  function getAlbumFavorites() {
    return readList(ALBUM_FAVORITES_KEY);
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

    saveList(ALBUM_FAVORITES_KEY, favorites);
    return favorites;
  }

  function clearAlbumFavorites() {
    localStorage.removeItem(ALBUM_FAVORITES_KEY);
  }

  function getBandFavorites() {
    return readList(BAND_FAVORITES_KEY);
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

    saveList(BAND_FAVORITES_KEY, favorites);
    return favorites;
  }

  function clearBandFavorites() {
    localStorage.removeItem(BAND_FAVORITES_KEY);
  }

  window.WikibandStorage = {
    addHistoryTerm,
    clearAlbumFavorites,
    clearBandFavorites,
    clearHistory,
    getAlbumFavorites,
    getBandFavorites,
    getHistory,
    isAlbumFavorite,
    isBandFavorite,
    toggleAlbumFavorite,
    toggleBandFavorite
  };
})(window);
