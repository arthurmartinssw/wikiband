const detalheContainer = document.getElementById("detalheContainer");
const bandaSelecionada = JSON.parse(sessionStorage.getItem("bandaSelecionada"));

function montarTextoCompartilhar(banda) {
  const foco = banda.musica
    ? `"${banda.musica}", de ${banda.nome}`
    : `o álbum "${banda.album}", de ${banda.nome}`;

  return `Estou ouvindo ${foco} no Wikiband. ${banda.spotifyLink || banda.youtubeLink}`;
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

async function compartilharDetalhe(banda, botao) {
  const texto = montarTextoCompartilhar(banda);
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

async function tocarPrimeiraPreview(banda, previewBtn, previewArea) {
  previewBtn.disabled = true;
  previewBtn.textContent = "Carregando...";
  previewArea.innerHTML = `<p class="preview-status">Buscando prévia...</p>`;

  try {
    const preview = await WikiPreview.getFirstPreview(banda);

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

if (!bandaSelecionada) {
  detalheContainer.innerHTML = `
    <div class="detalhe-content">
      <h1>Nenhuma banda selecionada</h1>
      <p>Volte para a busca e escolha um resultado para ver os detalhes.</p>
      <a href="index.html" class="voltar">Voltar para a busca</a>
    </div>
  `;
} else {
  detalheContainer.innerHTML = `
    <img src="${bandaSelecionada.imagem}" class="detalhe-imagem" alt="${bandaSelecionada.nome}">
    <div class="detalhe-content">
      <h1>${bandaSelecionada.nome}</h1>
      <p><strong>Gênero:</strong> ${bandaSelecionada.genero}</p>
      <p><strong>País:</strong> ${bandaSelecionada.pais}</p>
      <p><strong>Álbum:</strong> ${bandaSelecionada.album}</p>
      <p><strong>Lançamento:</strong> ${bandaSelecionada.lancamento}</p>

      <div class="links-externos">
        <button class="link-externo" id="detailPreviewButton" type="button">
          Tocar prévia
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

      <a href="index.html" class="voltar">Voltar para a busca</a>
    </div>
  `;

  const previewBtn = document.getElementById("detailPreviewButton");
  const previewArea = document.getElementById("detailPreviewArea");
  const shareBtn = document.getElementById("shareDetailButton");

  previewBtn.dataset.previewIdleText = "Tocar prévia";
  previewBtn.dataset.previewPlayingText = "Pausar prévia";
  previewBtn.addEventListener("click", () => {
    tocarPrimeiraPreview(bandaSelecionada, previewBtn, previewArea);
  });

  shareBtn.addEventListener("click", () => {
    compartilharDetalhe(bandaSelecionada, shareBtn);
  });

  carregarFaixasAlbum(bandaSelecionada);
  renderParticipantes(bandaSelecionada);
}
