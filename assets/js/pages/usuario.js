(function initPublicProfile(window, document) {
  const Storage = window.WikibandStorage;
  const Links = window.WikibandLinks;
  const Safe = window.WikibandSafe;
  const container = document.getElementById("publicProfile");
  const username = new URLSearchParams(window.location.search).get("u") || "";

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function itemTile(item) {
    const link = element("a", "rail-item");
    link.href = Links?.buildDetailUrl(item) || "/banda.html";

    const art = element("div", "rail-art");
    const image = element("img");
    image.src = Safe.safeImageUrl(item.imagem);
    image.alt = "";
    image.loading = "lazy";
    art.appendChild(image);

    link.append(
      art,
      element("span", "rail-title", item.musica || item.album || item.nome || "Item"),
      element("span", "rail-sub", item.nome || "")
    );
    return link;
  }

  function grid(items, emptyText) {
    if (!items.length) return element("p", "vazio", emptyText);
    const wrapper = element("div", "media-grid");
    wrapper.append(...items.map(itemTile));
    return wrapper;
  }

  function renderNotFound() {
    container.replaceChildren();
    const box = element("div", "detalhe-content painel");
    const link = element("a", "primary-btn", "Ir para a vitrine");
    link.href = "/";
    box.append(
      element("h1", "", "Perfil não encontrado"),
      element("p", "status", "Este perfil não existe ou é privado."),
      link
    );
    container.appendChild(box);
  }

  function render(profile) {
    document.title = `${profile.nome} (@${profile.username}) — Wikiband`;

    const hero = element("section", "public-hero glass");
    const info = element("div");
    const since = profile.membroDesde ? new Date(profile.membroDesde).getFullYear() : "";
    info.append(
      element("span", "eyebrow", "Perfil público"),
      element("h1", "", profile.nome),
      element("p", "", `@${profile.username}${since ? ` · na Wikiband desde ${since}` : ""}`)
    );
    hero.append(element("div", "public-avatar", initials(profile.nome)), info);

    const tabs = element("div", "tabs glass");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Biblioteca pública");

    const sections = [
      ["pubAlbuns", `Álbuns (${profile.albumFavorites.length})`, grid(profile.albumFavorites, "Nenhum álbum favorito ainda.")],
      ["pubArtistas", `Artistas (${profile.bandFavorites.length})`, grid(profile.bandFavorites, "Nenhum artista favorito ainda.")],
      ["pubColecoes", `Coleções (${profile.collections.length})`, collectionsView(profile.collections)]
    ];

    const panels = sections.map(([id, label, content], index) => {
      const tab = element("button", "tab", label);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", id);
      tab.setAttribute("aria-selected", String(index === 0));
      tabs.appendChild(tab);

      const panel = element("section", "section tab-panel");
      panel.id = id;
      panel.setAttribute("role", "tabpanel");
      panel.appendChild(content);
      return panel;
    });

    container.replaceChildren(hero, tabs, ...panels);
    window.WikibandUI?.initTabs(container);
  }

  function collectionsView(collections) {
    if (!collections.length) return element("p", "vazio", "Nenhuma coleção pública.");

    const wrapper = element("div");
    collections.forEach((collection) => {
      const block = element("section", "section");
      const head = element("div", "section-head");
      head.appendChild(element("h2", "", `${collection.name} · ${collection.items.length}`));
      const rail = element("div", "rail");
      rail.append(...collection.items.map(itemTile));
      block.append(head, collection.items.length ? rail : element("p", "vazio", "Coleção vazia."));
      wrapper.appendChild(block);
    });
    return wrapper;
  }

  Storage.fetchPublicProfile(username).then((result) => {
    if (result.ok) render(result.profile);
    else renderNotFound();
  });
})(window, document);
