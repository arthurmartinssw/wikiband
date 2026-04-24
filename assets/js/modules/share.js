(function initWikibandShare(window) {
  function obterLinkItem(item) {
    if (window.WikibandLinks?.buildDetailUrl) {
      return window.WikibandLinks.buildDetailUrl(item, { absolute: true });
    }

    return window.location.href;
  }

  function montarTextoCompartilhar(item) {
    const link = obterLinkItem(item);

    if (item.tipo === "song") {
      return `Estou ouvindo "${item.musica}" de ${item.nome} no Wikiband. ${link}`;
    }

    if (item.tipo === "artist") {
      return `Estou explorando ${item.nome} no Wikiband. ${link}`;
    }

    if (item.tipo === "album") {
      return `Estou ouvindo o album "${item.album}" de ${item.nome} no Wikiband. ${link}`;
    }

    return `Vem explorar musica no Wikiband: ${link}`;
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

  async function compartilharItem(item, botao) {
    const texto = montarTextoCompartilhar(item);
    const textoOriginal = botao.textContent;
    const url = obterLinkItem(item);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Wikiband",
          text: texto,
          url
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

  window.WikibandShare = {
    compartilharItem
  };
})(window);
