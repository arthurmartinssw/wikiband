// Short artist biography from Wikipedia (pt first, then en). Results are cached per session.
(function initWikibandArtistInfo(window) {
  // Exact titles are tried first (most artists), then the usual disambiguation suffixes, then a search.
  const SOURCES = [
    { host: "https://pt.wikipedia.org", suffixes: ["", " (banda)", " (cantor)", " (cantora)", " (grupo musical)", " (músico)", " (rapper)"] },
    { host: "https://en.wikipedia.org", suffixes: ["", " (band)", " (singer)", " (musician)", " (rapper)"] }
  ];
  const MUSIC_WORDS = /(banda|cantor|cantora|grupo|m[uú]sic|rapper|compositor|dj|duo|band|singer|musician|songwriter|group|artist|artista)/i;
  const TIMEOUT_MS = 6000;
  const CACHE_PREFIX = "wikiband_artist_info:";

  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function summaryFor(source, title) {
    try {
      const summary = await fetchJson(`${source.host}/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (summary?.type === "disambiguation" || !summary?.extract) return null;
      // Skip pages about something else with the same name (e.g. "Queen" the monarch).
      if (!MUSIC_WORDS.test(`${summary.description || ""} ${summary.extract.slice(0, 300)}`)) return null;

      return {
        title: summary.title,
        extract: summary.extract,
        thumbnail: summary.thumbnail?.source || "",
        image: summary.originalimage?.source || summary.thumbnail?.source || "",
        url: summary.content_urls?.desktop?.page || `${source.host}/wiki/${encodeURIComponent(title)}`,
        lang: source.host.includes("pt.") ? "pt" : "en"
      };
    } catch (error) {
      return null;
    }
  }

  async function lookup(source, name) {
    for (const suffix of source.suffixes) {
      const info = await summaryFor(source, `${name}${suffix}`);
      if (info) return info;
    }

    const params = new URLSearchParams({ action: "query", list: "search", srsearch: name, srlimit: "5", format: "json", origin: "*" });
    const search = await fetchJson(`${source.host}/w/api.php?${params}`);
    const wanted = normalize(name);
    const hit = (search?.query?.search || []).find((result) => normalize(result.title).startsWith(wanted));
    return hit ? summaryFor(source, hit.title) : null;
  }

  async function getArtistInfo(name) {
    const key = CACHE_PREFIX + normalize(name);

    try {
      const cached = sessionStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    } catch (error) {
      // ignore unreadable cache
    }

    let info = null;
    for (const source of SOURCES) {
      try {
        info = await lookup(source, name);
      } catch (error) {
        info = null;
      }
      if (info) break;
    }

    try {
      sessionStorage.setItem(key, JSON.stringify(info));
    } catch (error) {
      // storage full: skip caching
    }

    return info;
  }

  window.WikibandArtistInfo = { getArtistInfo };
})(window);
