(function initPublicProfile(window, document) {
  const Storage = window.WikibandStorage;
  const People = window.WikibandPeople;
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

  function renderNotFound() {
    const box = element("div", "detalhe-content painel");
    const link = element("a", "primary-btn", "Encontrar pessoas");
    link.href = "/comunidade.html";
    box.append(
      element("h1", "", "Perfil não encontrado"),
      element("p", "status", "Este perfil não existe ou é privado."),
      link
    );
    container.replaceChildren(box);
  }

  function stat(value, label, panelId) {
    const button = element("button", "profile-stat");
    button.type = "button";
    button.append(element("strong", "", String(value)), element("span", "", label));
    button.addEventListener("click", () => {
      document.querySelector(`[aria-controls="${panelId}"]`)?.click();
      document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return button;
  }

  function render(profile) {
    document.title = `${profile.nome} (@${profile.username}) — Wikiband`;

    const hero = element("section", "public-hero glass");
    const info = element("div", "public-info");
    const since = profile.membroDesde ? new Date(profile.membroDesde).getFullYear() : "";
    const stats = element("div", "profile-stat-row");

    const renderStats = (counts) => {
      stats.replaceChildren(
        stat(counts.seguidores, counts.seguidores === 1 ? "seguidor" : "seguidores", "pubSeguidores"),
        stat(counts.seguindo, "seguindo", "pubSeguindo"),
        stat(profile.albumFavorites.length + profile.bandFavorites.length, "favoritos", "pubAlbuns")
      );
    };
    renderStats(profile);

    info.append(
      element("span", "eyebrow", "Perfil público"),
      element("h1", "", profile.nome),
      element("p", "", `@${profile.username}${since ? ` · na Wikiband desde ${since}` : ""}`),
      stats
    );

    const actions = element("div", "public-actions");
    if (profile.ehVoce) {
      const edit = element("a", "secondary-btn", "Editar perfil");
      edit.href = "/perfil.html";
      actions.appendChild(edit);
    } else {
      actions.appendChild(
        People.followButton(profile.username, profile.voceSegue, (result) => {
          renderStats({ seguidores: result.seguidores, seguindo: profile.seguindo });
          loadPeople("followers", followersPanel);
        })
      );
    }

    const share = element("button", "secondary-btn", "Compartilhar");
    share.type = "button";
    share.addEventListener("click", async () => {
      const url = window.location.href;
      try {
        if (navigator.share) await navigator.share({ title: `${profile.nome} na Wikiband`, url });
        else {
          await navigator.clipboard.writeText(url);
          window.WikibandUI?.toast("Link do perfil copiado");
        }
      } catch (error) {
        // share sheet dismissed
      }
    });
    actions.appendChild(share);

    hero.append(element("div", "public-avatar", People.initials(profile.nome)), info, actions);

    const followersPanel = element("div", "", "");
    const followingPanel = element("div", "", "");

    const sections = [
      ["pubAlbuns", "Álbuns", grid(profile.albumFavorites, "Nenhum álbum favorito ainda.")],
      ["pubArtistas", "Artistas", grid(profile.bandFavorites, "Nenhum artista favorito ainda.")],
      ["pubColecoes", "Coleções", collectionsView(profile.collections)],
      ["pubSeguidores", "Seguidores", followersPanel],
      ["pubSeguindo", "Seguindo", followingPanel]
    ];

    const tabs = element("div", "tabs glass");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Perfil público");

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
    loadPeople("followers", followersPanel);
    loadPeople("following", followingPanel);
  }

  async function loadPeople(kind, panel) {
    panel.replaceChildren(element("p", "loading", "Carregando..."));
    const result = await Storage.fetchPeopleList(username, kind);
    const people = result.ok ? result.people : [];
    panel.replaceChildren(
      People.peopleList(
        people,
        kind === "followers" ? "Ninguém com perfil público segue esta pessoa ainda." : "Esta pessoa ainda não segue ninguém com perfil público."
      )
    );
  }

  Storage.fetchPublicProfile(username).then((result) => {
    if (result.ok) render(result.profile);
    else renderNotFound();
  });
})(window, document);
