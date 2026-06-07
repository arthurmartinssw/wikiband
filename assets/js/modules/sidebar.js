(function initWikibandSidebar(window) {
  const Safe = window.WikibandSafe;
  const escapeHtml = Safe?.escapeHtml || ((value) => String(value ?? ""));

  function renderHistory({ container, history, getModeLabel, onSearchAgain }) {
    if (!history.length) {
      container.innerHTML = `<p class="vazio">Nenhuma pesquisa ainda.</p>`;
      return;
    }

    container.innerHTML = "";

    history.forEach((item) => {
      const term = typeof item === "string" ? item : item.term;
      const type = typeof item === "string" ? "album" : item.type;
      const historyItem = document.createElement("div");
      historyItem.className = "item-lateral";
      historyItem.innerHTML = `
        <strong>${escapeHtml(term)}</strong>
        <p>${escapeHtml(getModeLabel(type))}</p>
        <button>Pesquisar de novo</button>
      `;

      historyItem.querySelector("button").addEventListener("click", () => {
        onSearchAgain({ term, type });
      });

      container.appendChild(historyItem);
    });
  }

  function renderAlbumFavorites({ container, favorites, onOpenDetails, onRemove }) {
    if (!favorites.length) {
      container.innerHTML = `<p class="vazio">Nenhum álbum favorito.</p>`;
      return;
    }

    container.innerHTML = "";

    favorites.forEach((album) => {
      const item = document.createElement("div");
      item.className = "item-lateral";
      item.innerHTML = `
        <strong>${escapeHtml(album.album || album.nome)}</strong>
        <p>${escapeHtml(album.nome)}</p>
        <p>${escapeHtml(album.genero)}</p>
        <button class="ver-favorito">Ver detalhes</button>
        <button class="remover-favorito danger mini-btn">Remover</button>
      `;

      item.querySelector(".ver-favorito").addEventListener("click", () => {
        onOpenDetails(album);
      });

      item.querySelector(".remover-favorito").addEventListener("click", () => {
        onRemove(album);
      });

      container.appendChild(item);
    });
  }

  function renderBandFavorites({ container, favorites, onOpenDetails, onExploreArtist, onRemove }) {
    if (!favorites.length) {
      container.innerHTML = `<p class="vazio">Nenhuma banda favorita.</p>`;
      return;
    }

    container.innerHTML = "";

    favorites.forEach((banda) => {
      const item = document.createElement("div");
      item.className = "item-lateral";
      item.innerHTML = `
        <strong>${escapeHtml(banda.nome)}</strong>
        <p>${escapeHtml(banda.genero)}</p>
        <button class="ver-favorito">Ver detalhes</button>
        <button class="remover-banda-favorita danger mini-btn">Remover</button>
      `;

      item.querySelector(".ver-favorito").addEventListener("click", () => {
        if (banda.albumId) {
          onOpenDetails(banda);
        } else {
          onExploreArtist(banda);
        }
      });

      item.querySelector(".remover-banda-favorita").addEventListener("click", () => {
        onRemove(banda);
      });

      container.appendChild(item);
    });
  }

  window.WikibandSidebar = {
    renderAlbumFavorites,
    renderBandFavorites,
    renderHistory
  };
})(window);
