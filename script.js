const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const bandsGrid = document.getElementById("bandsGrid");
const statusText = document.getElementById("status");

const PLACEHOLDER_IMAGEM =
  "https://via.placeholder.com/600x400?text=Sem+Imagem";

function criarCard(item) {
  const card = document.createElement("div");
  card.className = "band-card";

  const imagem = item.artworkUrl100
    ? item.artworkUrl100.replace("100x100bb", "600x600bb")
    : PLACEHOLDER_IMAGEM;

  const nome = item.artistName || "Artista desconhecido";
  const genero = item.primaryGenreName || "Gênero não informado";
  const pais = item.country || "País não informado";
  const album = item.collectionName || "Álbum não informado";
  const lancamento = item.releaseDate
    ? new Date(item.releaseDate).getFullYear()
    : "Ano não informado";

  card.innerHTML = `
    <img src="${imagem}" class="band-image" alt="${nome}">
    <div class="band-content">
      <h2>${nome}</h2>
      <span class="tag">${genero}</span>
      <p><strong>País:</strong> ${pais}</p>
      <p><strong>Álbum:</strong> ${album}</p>
      <p><strong>Lançamento:</strong> ${lancamento}</p>
    </div>
  `;

  card.addEventListener("click", () => {
    sessionStorage.setItem("bandaSelecionada", JSON.stringify({
      nome,
      genero,
      pais,
      album,
      lancamento,
      imagem,
      link: `https://open.spotify.com/search/${encodeURIComponent(nome)}`
    }));

    window.open("banda.html", "_blank");
  });

  return card;
}

function renderizarResultados(lista) {
  bandsGrid.innerHTML = "";

  if (!lista.length) {
    statusText.textContent = "Nenhum resultado encontrado.";
    return;
  }

  statusText.textContent = `${lista.length} resultado(s) encontrado(s).`;

  lista.forEach((item) => {
    bandsGrid.appendChild(criarCard(item));
  });
}

async function pesquisarBandas() {
  const termo = searchInput.value.trim();

  if (!termo) {
    statusText.textContent = "Digite algo para pesquisar.";
    bandsGrid.innerHTML = "";
    return;
  }

  statusText.textContent = "Pesquisando...";
  bandsGrid.innerHTML = "";

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      termo
    )}&media=music&entity=album&limit=24`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    renderizarResultados(dados.results || []);
  } catch (erro) {
    console.error("Erro ao buscar bandas:", erro);
    statusText.textContent =
      "Não foi possível carregar os resultados agora.";
  }
}

searchButton.addEventListener("click", pesquisarBandas);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    pesquisarBandas();
  }
});