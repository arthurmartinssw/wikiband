(function initCommunity(window, document) {
  const Storage = window.WikibandStorage;
  const People = window.WikibandPeople;
  const Links = window.WikibandLinks;
  const Safe = window.WikibandSafe;
  const feedList = document.getElementById("feedList");
  const peopleResults = document.getElementById("peopleResults");
  const searchInput = document.getElementById("peopleSearch");
  const peopleTitle = document.getElementById("peopleTitle");
  let searchTimer = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function timeAgo(timestamp) {
    const minutes = Math.round((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.round(hours / 24);
    return days === 1 ? "ontem" : `há ${days} dias`;
  }

  function miniTile(item) {
    const link = element("a", "feed-tile");
    link.href = Links?.buildDetailUrl(item) || "/banda.html";
    const image = element("img");
    image.src = Safe.safeImageUrl(item.imagem);
    image.alt = "";
    image.loading = "lazy";
    link.append(image, element("span", "", item.album || item.musica || item.nome || ""));
    link.title = `${item.album || item.nome} — ${item.nome}`;
    return link;
  }

  function feedCard(entry) {
    const card = element("article", "feed-card painel");
    const head = People.personCard(entry);
    head.appendChild(element("span", "feed-time", timeAgo(entry.atualizadoEm)));
    card.appendChild(head);

    const items = [...entry.albumFavorites, ...entry.bandFavorites];
    if (items.length) {
      card.appendChild(element("p", "feed-text", "Favoritos recentes"));
      const row = element("div", "feed-tiles");
      row.append(...items.map(miniTile));
      card.appendChild(row);
    } else {
      card.appendChild(element("p", "feed-text", "Ainda não favoritou nada."));
    }

    return card;
  }

  async function loadFeed() {
    if (!Storage.getCurrentSession()) {
      const box = element("div", "painel empty-cta");
      const link = element("a", "primary-btn", "Entrar");
      link.href = "/login.html";
      box.append(element("h3", "", "Veja o que seus amigos estão ouvindo"), element("p", "status", "Entre na sua conta para seguir pessoas e acompanhar os favoritos delas."), link);
      feedList.replaceChildren(box);
      return;
    }

    feedList.replaceChildren(element("p", "loading", "Carregando atividade..."));
    const result = await Storage.fetchFeed();

    if (!result.ok) {
      feedList.replaceChildren(element("p", "vazio", "A atividade não está disponível agora."));
      return;
    }

    if (!result.items.length) {
      feedList.replaceChildren(element("p", "vazio", "Você ainda não segue ninguém. Encontre pessoas na aba Descobrir pessoas."));
      return;
    }

    feedList.replaceChildren(...result.items.map(feedCard));
  }

  async function loadPeople(term = "") {
    peopleTitle.textContent = term ? `Resultados para "${term}"` : "Perfis ativos recentemente";
    peopleResults.replaceChildren(element("p", "loading", "Buscando..."));
    const result = await Storage.searchPeople(term);
    const me = Storage.getCurrentSession()?.username;
    const people = (result.ok ? result.people : []).filter((person) => person.username !== me);
    peopleResults.replaceChildren(
      People.peopleList(people, term ? "Nenhum perfil público encontrado." : "Ainda não há perfis públicos. Que tal deixar o seu público?")
    );
  }

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadPeople(searchInput.value.trim()), 350);
  });

  loadFeed();
  loadPeople();
})(window, document);
