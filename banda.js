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
  document.title = banda.nome;

  detalheContainer.innerHTML = `
    <img src="${banda.imagem}" class="detalhe-imagem" alt="${banda.nome}">
    <div class="detalhe-content">
      <h1>${banda.nome}</h1>
      <span class="tag">${banda.genero}</span>
      <p><strong>País:</strong> ${banda.pais}</p>
      <p><strong>Álbum em destaque:</strong> ${banda.album}</p>
      <p><strong>Ano de lançamento:</strong> ${banda.lancamento}</p>
      ${
        banda.link
          ? `<p><a class="link-externo" href="${banda.link}" target="_blank">Abrir página oficial no catálogo</a></p>`
          : ""
      }
      <a href="index.html" class="voltar">Voltar</a>
    </div>
  `;
}