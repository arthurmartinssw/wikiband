(function initWikibandResults(window) {
  const PLACEHOLDER_IMAGEM = "https://via.placeholder.com/600x400?text=Sem+Imagem";
  const ENTIDADES_BUSCA = {
    album: "album",
    song: "song",
    artist: "musicArtist"
  };

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

  function montarResultado(item, searchType) {
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

  function filtrarVersoesAlternativas(lista, { mostrarAlternativas, searchType }) {
    if (mostrarAlternativas || searchType === "artist") {
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

  function ordenarResultados(lista, ordenacao) {
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

  function obterNomeModo(type) {
    if (type === "song") return "Músicas";
    if (type === "artist") return "Artistas";
    return "Álbuns";
  }

  function obterTipoTexto(type) {
    if (type === "song") return "música(s)";
    if (type === "artist") return "artista(s)";
    return "álbum(ns)";
  }

  window.WikibandResults = {
    ENTIDADES_BUSCA,
    filtrarVersoesAlternativas,
    montarResultado,
    obterNomeModo,
    obterTipoTexto,
    ordenarResultados
  };
})(window);
