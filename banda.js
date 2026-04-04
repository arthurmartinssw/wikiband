const detalheContainer = document.getElementById("detalheContainer");
const banda = JSON.parse(sessionStorage.getItem("bandaSelecionada"));

if (!banda) {
  detalheContainer.innerHTML = `
    <div class="detalhe-content">
      <h1>Nenhuma banda encontrada</h1>
      <p>Volte para a página inicial e faça uma pesquisa.</p>
      <a href="index.html" class="voltar">Voltar</a>
    </div>
  `;
} else {
  document.title = `${banda.nome} | Wikiband`;

  detalheContainer.innerHTML = `
    <img src="${banda.imagem}" class="detalhe-imagem" alt="${banda.nome}">
    <div class="detalhe-content">
      <h1>${banda.nome}</h1>
      <span class="tag">${banda.genero}</span>
      <p><strong>País:</strong> ${banda.pais}</p>
      <p><strong>Álbum em destaque:</strong> ${banda.album}</p>
      <p><strong>Ano de lançamento:</strong> ${banda.lancamento}</p>
      <p>
        A Wikiband encontrou este artista a partir da sua busca musical.
        Aqui você pode usar os atalhos para continuar explorando em outras plataformas.
      </p>

      <div class="links-externos">
        <a class="link-externo" href="${banda.spotifyLink}" target="_blank">Abrir no Spotify</a>
        <a class="link-externo" href="${banda.youtubeLink}" target="_blank">Ver no YouTube</a>
      </div>

      <a href="index.html" class="voltar">Voltar</a>
    </div>
  `;
}