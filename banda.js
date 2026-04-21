const detalheContainer = document.getElementById("detalheContainer");
const bandaSelecionada = JSON.parse(sessionStorage.getItem("bandaSelecionada"));

function normalizarPreviewUrl(url) {
  return url ? url.replace(/^http:/, "https:") : "";
}

async function buscarPreviewAlbum(banda) {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(
    banda.albumId
  )}&entity=song`;
  const resposta = await fetch(url);
  const dados = await resposta.json();
  const faixa = (dados.results || []).find(
    (item) => item.wrapperType === "track" && item.previewUrl
  );

  if (!faixa) {
    return null;
  }

  return {
    nome: faixa.trackName || banda.album,
    url: normalizarPreviewUrl(faixa.previewUrl)
  };
}

async function tocarPreviewDetalhe(banda) {
  const previewBtn = document.getElementById("detailPreviewButton");
  const previewArea = document.getElementById("detailPreviewArea");
  const audioAtual = previewArea.querySelector("audio");

  if (audioAtual && !audioAtual.paused) {
    audioAtual.pause();
    return;
  }

  previewBtn.disabled = true;
  previewBtn.textContent = "Carregando...";
  previewArea.innerHTML = `<p class="preview-status">Buscando prévia...</p>`;

  try {
    const preview = await buscarPreviewAlbum(banda);

    if (!preview) {
      previewArea.innerHTML = `<p class="preview-status">Prévia indisponível para este álbum.</p>`;
      previewBtn.textContent = "Tocar prévia";
      return;
    }

    previewArea.innerHTML = `
      <p class="preview-status"><strong>Prévia:</strong> ${preview.nome}</p>
      <audio class="preview-player" controls src="${preview.url}"></audio>
    `;

    const audio = previewArea.querySelector("audio");

    audio.addEventListener("play", () => {
      previewBtn.textContent = "Pausar prévia";
    });

    audio.addEventListener("pause", () => {
      previewBtn.textContent = "Tocar prévia";
    });

    audio.addEventListener("ended", () => {
      previewBtn.textContent = "Tocar prévia";
    });

    previewBtn.disabled = false;
    const playPromise = audio.play();

    if (playPromise) {
      playPromise.catch((erroPlay) => {
        console.warn("O navegador bloqueou o play automático:", erroPlay);
        previewBtn.textContent = "Tocar prévia";
      });
    }
  } catch (erro) {
    console.error("Erro ao carregar prévia:", erro);
    previewArea.innerHTML = `<p class="preview-status">Não foi possível carregar a prévia agora.</p>`;
    previewBtn.textContent = "Tocar prévia";
  } finally {
    previewBtn.disabled = false;
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
        <a class="link-externo" href="${bandaSelecionada.spotifyLink}" target="_blank" rel="noopener noreferrer">
          Spotify
        </a>
        <a class="link-externo" href="${bandaSelecionada.youtubeLink}" target="_blank" rel="noopener noreferrer">
          YouTube
        </a>
      </div>

      <div class="preview-area" id="detailPreviewArea" aria-live="polite"></div>

      <a href="index.html" class="voltar">Voltar para a busca</a>
    </div>
  `;

  document.getElementById("detailPreviewButton").addEventListener("click", () => {
    tocarPreviewDetalhe(bandaSelecionada);
  });
}
