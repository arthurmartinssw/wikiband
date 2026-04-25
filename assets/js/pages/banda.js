const detalheContainer = document.getElementById("detalheContainer");

const Storage = window.WikibandStorage;
const Results = window.WikibandResults;
const Links = window.WikibandLinks;

function montarTextoCompartilhar(banda) {
  const foco = banda.musica
    ? `"${banda.musica}", de ${banda.nome}`
    : `o album "${banda.album}", de ${banda.nome}`;

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
  const textoOriginal = botao.textContent;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Wikiband",
        text: texto,
        url: window.location.href
      });
    } else {
      await copiarTexto(texto);
      botao.textContent = "Copiado";
      setTimeout(() => {
        botao.textContent = textoOriginal;
      }, 1400);
    }
  } catch (erro) {
    console.warn("Compartilhamento cancelado ou indisponivel:", erro);
  }
}

function adicionarEmColecao(item, onDone) {
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

    previewArea.innerHTML = `<p class="preview-status"><strong>Prévia:</strong> ${preview.nome}</p>`;
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
    <div class="member-avatar">${iniciais}</div>
    <div class="member-info">
      <h3>${participante.name}</h3>
      <p><strong>${participante.role}</strong></p>
      <p>${participante.bio}</p>
      <a href="${participante.spotifyUrl}" target="_blank" rel="noopener noreferrer">Spotify</a>
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

async function fetchItunes(url) {
  const resposta = await fetch(url);

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
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(query.trackId)}`
      );
      const faixa = (dados.results || []).find((item) => item.wrapperType === "track") || dados.results?.[0];
      if (faixa) return mapRawItem(faixa, "song");
    }

    if (query.albumId) {
      const dados = await fetchItunes(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(query.albumId)}&entity=song`
      );
      const album = (dados.results || []).find((item) => item.wrapperType === "collection") || dados.results?.[0];
      if (album) return mapRawItem(album, "album");
    }

    if (query.artistId && query.type === "artist") {
      const dados = await fetchItunes(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(query.artistId)}`
      );
      const artist = (dados.results || []).find((item) => item.wrapperType === "artist") || dados.results?.[0];
      if (artist) return mapRawItem(artist, "artist");
    }

    if (query.artist && query.song) {
      const dados = await fetchItunes(
        `https://itunes.apple.com/search?term=${encodeURIComponent(`${query.artist} ${query.song}`)}&media=music&entity=song&limit=1`
      );
      if (dados.results?.[0]) return mapRawItem(dados.results[0], "song");
    }

    if (query.artist && query.album) {
      const dados = await fetchItunes(
        `https://itunes.apple.com/search?term=${encodeURIComponent(`${query.artist} ${query.album}`)}&media=music&entity=album&limit=1`
      );
      if (dados.results?.[0]) return mapRawItem(dados.results[0], "album");
    }

    if (query.artist) {
      const dados = await fetchItunes(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query.artist)}&media=music&entity=musicArtist&limit=1`
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
    <div class="detalhe-content">
      <h1>Nenhuma banda selecionada</h1>
      <p>Volte para a busca e escolha um resultado para ver os detalhes.</p>
      <a href="/index.html" class="voltar">Voltar para a busca</a>
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

function renderDetalhes(bandaSelecionada) {
  const previewDisponivel = Boolean(bandaSelecionada.previewUrl || bandaSelecionada.albumId);

  detalheContainer.innerHTML = `
    <img src="${bandaSelecionada.imagem}" class="detalhe-imagem" alt="${bandaSelecionada.nome}">
    <div class="detalhe-content">
      <h1>${bandaSelecionada.nome}</h1>
      <p><strong>Gênero:</strong> ${bandaSelecionada.genero}</p>
      <p><strong>País:</strong> ${bandaSelecionada.pais}</p>
      <p><strong>Álbum:</strong> ${bandaSelecionada.album}</p>
      <p><strong>Lançamento:</strong> ${bandaSelecionada.lancamento}</p>

      <div class="links-externos">
        <button class="link-externo" id="detailPreviewButton" type="button" ${previewDisponivel ? "" : "disabled"}>
          ${previewDisponivel ? "Tocar prévia" : "Prévia indisponível"}
        </button>
        <button class="link-externo" id="addDetailToCollectionButton" type="button">
          Adicionar à coleção
        </button>
        <button class="link-externo" id="shareDetailButton" type="button">
          Compartilhar
        </button>
        <a class="link-externo" href="${bandaSelecionada.spotifyLink}" target="_blank" rel="noopener noreferrer">
          Spotify
        </a>
        <a class="link-externo" href="${bandaSelecionada.youtubeLink}" target="_blank" rel="noopener noreferrer">
          YouTube
        </a>
      </div>

      <div class="preview-area" id="detailPreviewArea" aria-live="polite"></div>

      <section class="tracks-section">
        <div class="tracks-header">
          <h2>Faixas do álbum</h2>
          <span id="trackCount"></span>
        </div>
        <div class="tracks-list" id="trackList"></div>
      </section>

      <section class="participants-section" id="participantsSection" hidden>
        <div class="tracks-header">
          <div>
            <h2 id="participantsTitle">Participantes</h2>
            <p id="participantsNote"></p>
          </div>
        </div>
        <div class="participants-list" id="participantsList"></div>
      </section>

      <a href="/index.html" class="voltar">Voltar para a busca</a>
    </div>
  `;

  const previewBtn = document.getElementById("detailPreviewButton");
  const previewArea = document.getElementById("detailPreviewArea");
  const shareBtn = document.getElementById("shareDetailButton");
  const addCollectionBtn = document.getElementById("addDetailToCollectionButton");

  previewBtn.dataset.previewIdleText = "Tocar prévia";
  previewBtn.dataset.previewPlayingText = "Pausar prévia";

  if (previewDisponivel) {
    previewBtn.addEventListener("click", () => {
      tocarPrimeiraPreview(bandaSelecionada, previewBtn, previewArea);
    });
  }

  addCollectionBtn.addEventListener("click", () => {
    adicionarEmColecao(bandaSelecionada, (mensagem) => {
      previewArea.innerHTML = `<p class="preview-status">${mensagem}</p>`;
    });
  });

  shareBtn.addEventListener("click", () => {
    compartilharDetalhe(bandaSelecionada, shareBtn);
  });

  carregarFaixasAlbum(bandaSelecionada);
  renderParticipantes(bandaSelecionada);
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
