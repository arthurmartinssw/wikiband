const detalheContainer = document.getElementById("detalheContainer");
const bandaSelecionada = JSON.parse(sessionStorage.getItem("bandaSelecionada"));

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
        <a class="link-externo" href="${bandaSelecionada.spotifyLink}" target="_blank" rel="noopener noreferrer">
          Spotify
        </a>
        <a class="link-externo" href="${bandaSelecionada.youtubeLink}" target="_blank" rel="noopener noreferrer">
          YouTube
        </a>
      </div>

      <a href="index.html" class="voltar">Voltar para a busca</a>
    </div>
  `;
}
