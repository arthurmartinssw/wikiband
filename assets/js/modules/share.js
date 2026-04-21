(function initWikibandShare(window) {
  function montarTextoCompartilhar(item) {
    if (item.tipo === "song") {
      return `Estou ouvindo "${item.musica}" de ${item.nome} no Wikiband. ${item.youtubeLink}`;
    }

    if (item.tipo === "artist") {
      return `Estou explorando ${item.nome} no Wikiband. ${item.spotifyLink}`;
    }

    if (item.tipo === "album") {

      return `Estou ouvindo o álbum "${item.album}" de ${item.nome} no Wikiband. ${item.spotifyLink}`;
    }
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

  async function compartilharItem(item, botao) {
    const texto = montarTextoCompartilhar(item);
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

  window.WikibandShare = {
    compartilharItem
  };
})(window);
