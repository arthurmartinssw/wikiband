(function initWikibandLinks(window) {
  const SEARCH_TYPES = new Set(["album", "song", "artist"]);

  function normalizeSearchType(type) {
    if (SEARCH_TYPES.has(type)) return type;
    return "album";
  }

  function readSearchStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const term = (params.get("q") || "").trim();
    const type = normalizeSearchType(params.get("type") || "album");

    return {
      term,
      type
    };
  }

  function syncSearchStateToUrl({ term, type }, replace = true) {
    const params = new URLSearchParams(window.location.search);
    const trimmedTerm = String(term || "").trim();
    const normalizedType = normalizeSearchType(type);

    if (trimmedTerm) {
      params.set("q", trimmedTerm);
      params.set("type", normalizedType);
    } else {
      params.delete("q");
      params.delete("type");
    }

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;

    if (replace) {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
  }

  function inferItemType(item) {
    if (item?.tipo) return item.tipo;
    if (item?.trackId) return "song";
    if (item?.albumId) return "album";
    return "artist";
  }

  function buildDetailUrl(item, options = {}) {
    const params = new URLSearchParams();
    const type = inferItemType(item);

    params.set("type", type);

    if (item?.albumId) params.set("albumId", String(item.albumId));
    if (item?.trackId) params.set("trackId", String(item.trackId));
    if (item?.bandaId) params.set("artistId", String(item.bandaId));

    if (item?.nome) params.set("artist", item.nome);
    if (item?.album) params.set("album", item.album);
    if (item?.musica) params.set("song", item.musica);

    const relative = `/banda?${params.toString()}`;

    if (!options.absolute) {
      return relative;
    }

    return new URL(relative, window.location.origin).toString();
  }

  function readDetailStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
      type: normalizeSearchType(params.get("type") || "album"),
      albumId: params.get("albumId") || "",
      trackId: params.get("trackId") || "",
      artistId: params.get("artistId") || "",
      artist: (params.get("artist") || "").trim(),
      album: (params.get("album") || "").trim(),
      song: (params.get("song") || "").trim()
    };
  }

  window.WikibandLinks = {
    buildDetailUrl,
    readDetailStateFromUrl,
    readSearchStateFromUrl,
    syncSearchStateToUrl
  };
})(window);
