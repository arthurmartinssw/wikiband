const detalheContainer = document.getElementById("detalheContainer");

const Storage = window.WikibandStorage;
const Results = window.WikibandResults;
const Links = window.WikibandLinks;
const Safe = window.WikibandSafe;
const escapeHtml = Safe?.escapeHtml || ((value) => String(value ?? ""));
const safeExternalUrl = Safe?.safeExternalUrl || ((value) => String(value || "#"));
const safeImageUrl = Safe?.safeImageUrl || ((value) => String(value || ""));

function buildApiUrl(path) {
  if (Storage && typeof Storage.buildApiUrl === "function") {
    return Storage.buildApiUrl(path);
  }

  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;
  return `/api${normalizedPath}`;
}

function montarTextoCompartilhar(banda) {
  if (banda.tipo === "artist") {
    return `Conheça ${banda.nome} no Wikiband. ${window.location.href}`;
  }

  const foco = banda.musica
    ? `"${banda.musica}", de ${banda.nome}`
    : `o álbum "${banda.album}", de ${banda.nome}`;

  return `Estou ouvindo ${foco} no Wikiband. ${window.location.href}`;
}

async function copiarTexto(texto) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch (erro) {
      console.warn("Clipboard API indisponivel, usando fallback:", erro);
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

async function compartilharDetalhe(banda, botao) {
  const texto = montarTextoCompartilhar(banda);

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Wikiband",
        text: texto,
        url: window.location.href
      });
    } else {
      await copiarTexto(texto);
      window.WikibandUI?.toast("Link copiado para compartilhar");
    }
  } catch (erro) {
    console.warn("Compartilhamento cancelado ou indisponivel:", erro);
  }
}

function adicionarEmColecao(item, onDone) {
  if (!Storage.getCurrentSession()) {
    onDone("Entre na sua conta para criar coleções.");
    return;
  }

  const collections = Storage.getCollections();

  if (!collections.length) {
    const nomeNova = window.prompt("Nome da nova coleção:");
    if (!nomeNova) return;

    const collection = Storage.ensureCollectionByName(nomeNova);
    if (!collection) return;

    Storage.addItemToCollection(collection.id, item);
    onDone(`Item salvo em "${collection.name}".`);
    return;
  }

  const menu = collections.map((collection, index) => `${index + 1}. ${collection.name}`).join("\n");
  const entrada = window.prompt(`Digite o número da coleção ou um novo nome:\n\n${menu}`);

  if (!entrada) return;

  const indice = Number(entrada);
  const collection =
    Number.isInteger(indice) && indice >= 1 && indice <= collections.length
      ? collections[indice - 1]
      : Storage.ensureCollectionByName(entrada);

  if (!collection) return;

  Storage.addItemToCollection(collection.id, item);
  onDone(`Item salvo em "${collection.name}".`);
}

async function tocarPrimeiraPreview(banda, previewBtn, previewArea) {
  previewBtn.disabled = true;
  previewBtn.textContent = "Carregando...";
  previewArea.innerHTML = `<p class="preview-status">Buscando prévia...</p>`;

  try {
    const preview = banda.previewUrl
      ? {
          id: banda.trackId || `${banda.nome}-${banda.musica || banda.album}`,
          nome: banda.musica || banda.album,
          artista: banda.nome,
          album: banda.album,
          previewUrl: banda.previewUrl,
          imagem: banda.imagem
        }
      : await WikiPreview.getFirstPreview(banda);

    if (!preview) {
      previewArea.innerHTML = `<p class="preview-status">Prévia indisponível para este álbum.</p>`;
      previewBtn.textContent = "Tocar prévia";
      return;
    }

    previewArea.innerHTML = `<p class="preview-status"><strong>Prévia:</strong> ${escapeHtml(preview.nome)}</p>`;
    previewBtn.disabled = false;
    WikiPreview.playTrack(preview, banda, previewBtn);
  } catch (erro) {
    console.error("Erro ao carregar prévia:", erro);
    previewArea.innerHTML = `<p class="preview-status">Não foi possível carregar a prévia agora.</p>`;
    previewBtn.textContent = "Tocar prévia";
  } finally {
    previewBtn.disabled = false;
  }
}

function criarLinhaFaixa(faixa, banda) {
  const row = document.createElement("div");
  row.className = "track-row";

  const number = document.createElement("span");
  number.className = "track-number";
  number.textContent = String(faixa.numero).padStart(2, "0");

  const info = document.createElement("div");
  info.className = "track-info";

  const title = document.createElement("strong");
  title.textContent = faixa.nome;

  const meta = document.createElement("span");
  meta.textContent = `${faixa.artista} • ${WikiPreview.formatDuration(faixa.duracaoMs)}`;

  info.append(title, meta);

  const button = document.createElement("button");
  button.className = "track-preview-btn";
  button.type = "button";
  button.dataset.previewIdleText = "Tocar";
  button.dataset.previewPlayingText = "Pausar";

  if (faixa.previewUrl) {
    button.textContent = "Tocar";
    button.addEventListener("click", () => {
      WikiPreview.playTrack(faixa, banda, button);
    });
  } else {
    button.textContent = "Sem prévia";
    button.disabled = true;
  }

  row.append(number, info, button);
  return row;
}

function criarParticipanteCard(participante) {
  const card = document.createElement("article");
  card.className = "member-card";

  const iniciais = participante.name
    .split(" ")
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  card.innerHTML = `
    <div class="member-avatar">${escapeHtml(iniciais)}</div>
    <div class="member-info">
      <h3>${escapeHtml(participante.name)}</h3>
      <p><strong>${escapeHtml(participante.role)}</strong></p>
      <p>${escapeHtml(participante.bio)}</p>
      <a href="${safeExternalUrl(participante.spotifyUrl)}" target="_blank" rel="noopener noreferrer">Spotify</a>
    </div>
  `;

  return card;
}

function renderParticipantes(banda) {
  const section = document.getElementById("participantsSection");
  const title = document.getElementById("participantsTitle");
  const note = document.getElementById("participantsNote");
  const list = document.getElementById("participantsList");
  const participants = WikiArtistProfiles.getParticipants(banda);

  if (!participants) {
    section.hidden = true;
    return;
  }

  title.textContent = participants.title;
  note.textContent = participants.note;
  list.innerHTML = "";

  participants.members.forEach((participante) => {
    list.appendChild(criarParticipanteCard(participante));
  });

  section.hidden = false;
}

async function carregarFaixasAlbum(banda) {
  const trackList = document.getElementById("trackList");
  const trackCount = document.getElementById("trackCount");

  if (!banda.albumId) {
    trackList.innerHTML = `<p class="vazio">Selecione um álbum para ver faixas detalhadas.</p>`;
    trackCount.textContent = "";
    return;
  }

  trackList.innerHTML = `<p class="loading">Carregando faixas...</p>`;
  trackCount.textContent = "";

  try {
    const faixas = await WikiPreview.getAlbumTracks(banda);

    if (!faixas.length) {
      trackList.innerHTML = `<p class="vazio">Nenhuma faixa encontrada para este álbum.</p>`;
      return;
    }

    trackCount.textContent = `${faixas.length} faixa(s)`;
    trackList.innerHTML = "";

    faixas.forEach((faixa) => {
      trackList.appendChild(criarLinhaFaixa(faixa, banda));
    });
  } catch (erro) {
    console.error("Erro ao carregar faixas:", erro);
    trackList.innerHTML = `<p class="vazio">Não foi possível carregar as faixas agora.</p>`;
  }
}

async function fetchItunes(path) {
  const resposta = await fetch(buildApiUrl(path));

  if (!resposta.ok) {
    throw new Error("Falha ao buscar dados no iTunes.");
  }

  return resposta.json();
}

function mapRawItem(rawItem, type) {
  return Results.montarResultado(rawItem, type);
}

async function carregarViaQueryParams() {
  if (!Links) return null;

  const query = Links.readDetailStateFromUrl();

  if (
    !query.albumId &&
    !query.trackId &&
    !query.artistId &&
    !query.artist &&
    !query.album &&
    !query.song
  ) {
    return null;
  }

  try {
    if (query.trackId) {
      const dados = await fetchItunes(
        `/itunes/lookup?id=${encodeURIComponent(query.trackId)}`
      );
      const faixa = (dados.results || []).find((item) => item.wrapperType === "track") || dados.results?.[0];
      if (faixa) return mapRawItem(faixa, "song");
    }

    if (query.albumId) {
      const dados = await fetchItunes(
        `/itunes/lookup?id=${encodeURIComponent(query.albumId)}&entity=song`
      );
      const album = (dados.results || []).find((item) => item.wrapperType === "collection") || dados.results?.[0];
      if (album) return mapRawItem(album, "album");
    }

    if (query.artistId && query.type === "artist") {
      const dados = await fetchItunes(
        `/itunes/lookup?id=${encodeURIComponent(query.artistId)}`
      );
      const artist = (dados.results || []).find((item) => item.wrapperType === "artist") || dados.results?.[0];
      if (artist) return mapRawItem(artist, "artist");
    }

    if (query.artist && query.song) {
      const dados = await fetchItunes(
        `/itunes/search?term=${encodeURIComponent(`${query.artist} ${query.song}`)}&media=music&entity=song&limit=1`
      );
      if (dados.results?.[0]) return mapRawItem(dados.results[0], "song");
    }

    if (query.artist && query.album) {
      const dados = await fetchItunes(
        `/itunes/search?term=${encodeURIComponent(`${query.artist} ${query.album}`)}&media=music&entity=album&limit=1`
      );
      if (dados.results?.[0]) return mapRawItem(dados.results[0], "album");
    }

    if (query.artist) {
      const dados = await fetchItunes(
        `/itunes/search?term=${encodeURIComponent(query.artist)}&media=music&entity=musicArtist&limit=1`
      );
      if (dados.results?.[0]) return mapRawItem(dados.results[0], "artist");
    }
  } catch (erro) {
    console.warn("Nao foi possivel carregar detalhes por URL:", erro);
  }

  return null;
}

function carregarViaSessionStorage() {
  try {
    return JSON.parse(sessionStorage.getItem("bandaSelecionada"));
  } catch (erro) {
    console.warn("Nao foi possivel ler bandaSelecionada:", erro);
    return null;
  }
}

async function carregarBandaSelecionada() {
  const viaQuery = await carregarViaQueryParams();

  if (viaQuery) {
    return viaQuery;
  }

  return carregarViaSessionStorage();
}

function renderSemSelecao() {
  detalheContainer.innerHTML = `
    <div class="detalhe-content painel">
      <h1>Nada selecionado</h1>
      <p>Volte para a vitrine e escolha um artista, álbum ou música.</p>
      <a href="/" class="primary-btn">Ir para a vitrine</a>
    </div>
  `;
}

function atualizarUrlCanonica(banda) {
  if (!Links?.buildDetailUrl) return;

  const canonica = Links.buildDetailUrl(banda);
  const atual = `${window.location.pathname}${window.location.search}`;

  if (canonica !== atual) {
    window.history.replaceState({}, "", canonica);
  }
}

function isNumericId(value) {
  return /^\d+$/.test(String(value || ""));
}

function textoTipo(banda) {
  return { artist: "Artista", song: "Música", album: "Álbum" }[banda.tipo] || "Álbum";
}

function tituloPrincipal(banda) {
  if (banda.tipo === "song") return banda.musica;
  if (banda.tipo === "artist") return banda.nome;
  return banda.album;
}

function criarCardDiscografia(album) {
  const card = document.createElement("article");
  card.className = "rail-item";
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="rail-art"><img src="${safeImageUrl(album.imagem)}" alt="" loading="lazy"></div>
    <span class="rail-title"></span>
    <span class="rail-sub"></span>
  `;
  card.querySelector(".rail-title").textContent = album.album;
  card.querySelector(".rail-sub").textContent = String(album.lancamento || "");

  const abrir = () => {
    sessionStorage.setItem("bandaSelecionada", JSON.stringify(album));
    window.location.href = Links?.buildDetailUrl(album) || "/banda.html";
  };
  card.addEventListener("click", abrir);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter") abrir();
  });
  return card;
}

async function carregarObrasDoArtista(banda) {
  const section = document.getElementById("discographySection");
  const rail = document.getElementById("discographyList");
  const topSection = document.getElementById("topSongsSection");
  const topList = document.getElementById("topSongsList");

  if (!isNumericId(banda.bandaId)) {
    section.hidden = true;
    topSection.hidden = true;
    return { albums: [] };
  }

  try {
    const [albunsResp, musicasResp] = await Promise.all([
      fetchItunes(`/itunes/lookup?id=${encodeURIComponent(banda.bandaId)}&entity=album&limit=60`),
      banda.tipo === "artist"
        ? fetchItunes(`/itunes/lookup?id=${encodeURIComponent(banda.bandaId)}&entity=song&limit=12`)
        : Promise.resolve({ results: [] })
    ]);

    const albums = Results.filtrarVersoesAlternativas(
      (albunsResp.results || [])
        .filter((item) => item.wrapperType === "collection")
        .map((item) => mapRawItem(item, "album"))
        .filter((album) => String(album.albumId) !== String(banda.albumId)),
      { mostrarAlternativas: false, searchType: "album" }
    ).sort((a, b) => (Number(b.lancamento) || 0) - (Number(a.lancamento) || 0));

    if (albums.length) {
      rail.replaceChildren(...albums.map(criarCardDiscografia));
      document.getElementById("discographyTitle").textContent =
        banda.tipo === "artist" ? "Discografia" : `Mais de ${banda.nome}`;
      section.hidden = false;
    } else {
      section.hidden = true;
    }

    const musicas = (musicasResp.results || []).filter((item) => item.wrapperType === "track");

    if (musicas.length) {
      const faixas = musicas.map((item, index) => ({
        id: item.trackId,
        nome: item.trackName,
        artista: item.collectionName || banda.nome,
        album: item.collectionName,
        numero: index + 1,
        duracaoMs: item.trackTimeMillis || 0,
        previewUrl: item.previewUrl || "",
        imagem: String(item.artworkUrl100 || "").replace("100x100bb", "300x300bb")
      }));
      topList.replaceChildren(...faixas.map((faixa) => criarLinhaFaixa(faixa, banda)));
      document.getElementById("playTopSongsButton").onclick = () => {
        WikiPreview.startRadio(musicas, { label: `Essenciais de ${banda.nome}` }).catch(() => {});
      };
      topSection.hidden = false;
    } else {
      topSection.hidden = true;
    }

    return { albums };
  } catch (erro) {
    console.warn("Nao foi possivel carregar a discografia:", erro);
    section.hidden = true;
    topSection.hidden = true;
    return { albums: [] };
  }
}

async function carregarSobreArtista(banda, albums) {
  const card = document.getElementById("aboutCard");
  const info = await window.WikibandArtistInfo?.getArtistInfo(banda.nome);

  if (!info) {
    card.hidden = true;
    // Artists have no artwork on iTunes; fall back to their latest album cover.
    if (banda.tipo === "artist" && albums[0]?.imagem) aplicarImagemHero(albums[0].imagem);
    return;
  }

  card.querySelector(".about-text").textContent = info.extract;
  const link = card.querySelector(".about-source");
  link.href = safeExternalUrl(info.url);
  link.textContent = `Leia mais na Wikipédia (${info.lang})`;

  const thumb = card.querySelector(".about-thumb");
  if (info.thumbnail && banda.tipo !== "artist") {
    thumb.src = safeImageUrl(info.thumbnail);
    thumb.hidden = false;
  }

  if (banda.tipo === "artist") {
    aplicarImagemHero(info.image || albums[0]?.imagem);
  }

  card.hidden = false;
}

function aplicarImagemHero(url) {
  const safeUrl = safeImageUrl(url);
  document.getElementById("detailImage").src = safeUrl;
  document.getElementById("detailHeroBg").style.backgroundImage = `url("${safeUrl.replace(/"/g, "%22")}")`;
}

function renderDetalhes(bandaSelecionada) {
  const isArtist = bandaSelecionada.tipo === "artist";
  const previewDisponivel = Boolean(bandaSelecionada.previewUrl || bandaSelecionada.albumId);
  const albumFav = Storage.isAlbumFavorite(bandaSelecionada.albumId);
  const bandFav = Storage.isBandFavorite(bandaSelecionada.bandaId);
  const artistUrl = isNumericId(bandaSelecionada.bandaId)
    ? Links?.buildDetailUrl({ tipo: "artist", nome: bandaSelecionada.nome, bandaId: bandaSelecionada.bandaId })
    : "";

  document.title = `${tituloPrincipal(bandaSelecionada)} — Wikiband`;

  detalheContainer.innerHTML = `
    <section class="detail-hero${isArtist ? " is-artist" : ""}">
      <div class="detail-hero-bg" id="detailHeroBg"></div>
      <img src="${safeImageUrl(bandaSelecionada.imagem)}" class="detalhe-imagem" id="detailImage" alt="">
      <div>
        <span class="eyebrow">${escapeHtml(textoTipo(bandaSelecionada))}</span>
        <h1>${escapeHtml(tituloPrincipal(bandaSelecionada))}</h1>
        ${isArtist ? "" : `<p class="detail-sub">${artistUrl ? `<a href="${escapeHtml(artistUrl)}">${escapeHtml(bandaSelecionada.nome)}</a>` : escapeHtml(bandaSelecionada.nome)}${bandaSelecionada.tipo === "song" ? ` · ${escapeHtml(bandaSelecionada.album)}` : ""}</p>`}
        <div class="detail-meta">
          <span class="chip">${escapeHtml(bandaSelecionada.genero)}</span>
          ${/^\d{4}$/.test(String(bandaSelecionada.lancamento)) ? `<span class="chip">${escapeHtml(bandaSelecionada.lancamento)}</span>` : ""}
        </div>

        <div class="links-externos">
          ${isArtist ? "" : `<button class="primary-btn" id="detailPreviewButton" type="button" ${previewDisponivel ? "" : "disabled"}>${previewDisponivel ? "Tocar prévia" : "Prévia indisponível"}</button>`}
          ${bandaSelecionada.albumId && !isArtist ? `<button class="secondary-btn${albumFav ? " active" : ""}" id="favoriteAlbumButton" type="button">${albumFav ? "Álbum favoritado" : "Favoritar álbum"}</button>` : ""}
          <button class="secondary-btn${bandFav ? " active" : ""}" id="favoriteArtistButton" type="button">${bandFav ? "Artista favoritado" : "Favoritar artista"}</button>
          <button class="secondary-btn" id="addDetailToCollectionButton" type="button">Adicionar à coleção</button>
          <button class="secondary-btn" id="shareDetailButton" type="button">Compartilhar</button>
          <a class="link-externo" href="${safeExternalUrl(bandaSelecionada.spotifyLink)}" target="_blank" rel="noopener noreferrer">Spotify</a>
          <a class="link-externo" href="${safeExternalUrl(bandaSelecionada.youtubeLink)}" target="_blank" rel="noopener noreferrer">YouTube</a>
        </div>
        <div class="preview-area" id="detailPreviewArea" aria-live="polite"></div>
      </div>
    </section>

    <div class="detail-grid">
      <div class="detail-main">
        <section class="painel tracks-section" id="topSongsSection" hidden>
          <div class="tracks-header">
            <h2>Músicas populares</h2>
            <button class="mini-btn" id="playTopSongsButton" type="button">Tocar todas</button>
          </div>
          <div class="tracks-list" id="topSongsList"></div>
        </section>

        <section class="painel tracks-section" id="albumTracksSection" ${bandaSelecionada.albumId && !isArtist ? "" : "hidden"}>
          <div class="tracks-header">
            <h2>Faixas do álbum</h2>
            <span id="trackCount"></span>
          </div>
          <div class="tracks-list" id="trackList"></div>
        </section>

        <section class="section" id="discographySection" hidden>
          <div class="section-head"><h2 id="discographyTitle">Discografia</h2></div>
          <div class="rail" id="discographyList"></div>
        </section>
      </div>

      <aside class="detail-aside">
        <section class="painel about-card" id="aboutCard" hidden>
          <h2>Sobre ${escapeHtml(bandaSelecionada.nome)}</h2>
          <img class="about-thumb" alt="" hidden>
          <p class="about-text"></p>
          <a class="about-source" target="_blank" rel="noopener noreferrer"></a>
        </section>

        <section class="painel participants-section" id="participantsSection" hidden>
          <div class="tracks-header">
            <div>
              <h2 id="participantsTitle">Integrantes</h2>
              <p id="participantsNote"></p>
            </div>
          </div>
          <div class="participants-list" id="participantsList"></div>
        </section>
      </aside>
    </div>
  `;

  aplicarImagemHero(bandaSelecionada.imagem);

  const previewBtn = document.getElementById("detailPreviewButton");
  const previewArea = document.getElementById("detailPreviewArea");
  const say = (mensagem) => {
    previewArea.innerHTML = `<p class="preview-status">${escapeHtml(mensagem)}</p>`;
  };

  if (previewBtn) {
    previewBtn.dataset.previewIdleText = "Tocar prévia";
    previewBtn.dataset.previewPlayingText = "Pausar prévia";

    if (previewDisponivel) {
      previewBtn.addEventListener("click", () => {
        tocarPrimeiraPreview(bandaSelecionada, previewBtn, previewArea);
      });
    }
  }

  document.getElementById("favoriteAlbumButton")?.addEventListener("click", (event) => {
    Storage.toggleAlbumFavorite(bandaSelecionada);
    const ativo = Storage.isAlbumFavorite(bandaSelecionada.albumId);
    event.currentTarget.classList.toggle("active", ativo);
    event.currentTarget.textContent = ativo ? "Álbum favoritado" : "Favoritar álbum";
    if (!Storage.getCurrentSession()) window.WikibandUI?.toast("Entre na sua conta para salvar favoritos.");
  });

  document.getElementById("favoriteArtistButton").addEventListener("click", (event) => {
    Storage.toggleBandFavorite(bandaSelecionada);
    const ativo = Storage.isBandFavorite(bandaSelecionada.bandaId);
    event.currentTarget.classList.toggle("active", ativo);
    event.currentTarget.textContent = ativo ? "Artista favoritado" : "Favoritar artista";
    if (!Storage.getCurrentSession()) window.WikibandUI?.toast("Entre na sua conta para salvar favoritos.");
  });

  document.getElementById("addDetailToCollectionButton").addEventListener("click", () => {
    adicionarEmColecao(bandaSelecionada, say);
  });

  document.getElementById("shareDetailButton").addEventListener("click", (event) => {
    compartilharDetalhe(bandaSelecionada, event.currentTarget);
  });

  if (bandaSelecionada.albumId && !isArtist) carregarFaixasAlbum(bandaSelecionada);
  renderParticipantes(bandaSelecionada);
  carregarObrasDoArtista(bandaSelecionada).then(({ albums }) => carregarSobreArtista(bandaSelecionada, albums));
}

(async () => {
  const bandaSelecionada = await carregarBandaSelecionada();

  if (!bandaSelecionada) {
    renderSemSelecao();
    return;
  }

  sessionStorage.setItem("bandaSelecionada", JSON.stringify(bandaSelecionada));
  atualizarUrlCanonica(bandaSelecionada);
  renderDetalhes(bandaSelecionada);
})();
