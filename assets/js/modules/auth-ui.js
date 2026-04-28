(function initWikibandAuthUI(window, document) {
  const Storage = window.WikibandStorage;
  const AUTH_EVENT_KEY = "wikiband_auth_event";

  if (!Storage || typeof Storage.getCurrentSession !== "function") {
    return;
  }

  function createAuthEvent(action, email) {
    localStorage.setItem(
      AUTH_EVENT_KEY,
      JSON.stringify({
        action,
        email: String(email || "").toLowerCase(),
        ts: Date.now()
      })
    );
  }

  function createAvatar(session) {
    const avatar = document.createElement("span");
    avatar.className = "profile-avatar";

    const avatarData = session ? Storage.getCurrentAvatar?.() : "";

    if (avatarData) {
      const image = document.createElement("img");
      image.src = avatarData;
      image.alt = "";
      avatar.appendChild(image);
      return avatar;
    }

    avatar.textContent = Storage.getUserInitials?.(session) || "WB";
    return avatar;
  }

  function createMenuLink(label, href) {
    const link = document.createElement("a");
    link.href = href;
    link.className = "profile-menu-item";
    link.textContent = label;
    return link;
  }

  function createMenuButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-menu-item";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function createProfileDropdown(session) {
    const dropdown = document.createElement("div");
    dropdown.className = "profile-dropdown";

    if (session) {
      const header = document.createElement("div");
      header.className = "profile-dropdown-header";
      const name = document.createElement("strong");
      const handle = document.createElement("span");

      name.textContent = session.nome;
      handle.textContent = session.username ? `@${session.username}` : session.email;
      header.append(name, handle);
      dropdown.appendChild(header);
      dropdown.appendChild(createMenuLink("Perfil", "/perfil.html"));
      dropdown.appendChild(createMenuLink("Favoritos", "/favoritos.html"));
      dropdown.appendChild(createMenuLink("Colecoes", "/favoritos.html#colecoes"));
      dropdown.appendChild(
        createMenuButton("Sair", () => {
          const currentSession = Storage.getCurrentSession();
          Storage.clearCurrentSession();
          createAuthEvent("logout", currentSession?.email || "");
          window.location.href = "/index.html";
        })
      );
      return dropdown;
    }

    dropdown.appendChild(createMenuLink("Entrar", "/login.html"));
    dropdown.appendChild(createMenuLink("Criar conta", "/cadastro.html"));
    dropdown.appendChild(createMenuLink("Sobre a Wikiband", "/sobre.html"));
    return dropdown;
  }

  function createProfileMenu(session) {
    const wrapper = document.createElement("div");
    wrapper.className = "profile-menu";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "profile-trigger";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", session ? "Abrir menu do perfil" : "Abrir menu de acesso");
    trigger.appendChild(createAvatar(session));

    const dropdown = createProfileDropdown(session);

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = wrapper.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", () => {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    });

    wrapper.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    return wrapper;
  }

  function showWelcome(session) {
    if (!session || typeof Storage.consumeWelcomePending !== "function" || !Storage.consumeWelcomePending()) {
      return;
    }

    const overlay = document.createElement("div");
    const card = document.createElement("div");
    const avatar = document.createElement("span");
    const title = document.createElement("strong");
    const message = document.createElement("p");

    overlay.className = "welcome-screen";
    card.className = "welcome-card";
    avatar.className = "welcome-avatar";
    avatar.textContent = Storage.getUserInitials?.(session) || "WB";
    title.textContent = `Bem-vindo, ${session.nome}`;
    message.textContent = "Aproveite!";
    card.append(avatar, title, message);
    overlay.appendChild(card);

    document.body.appendChild(overlay);

    window.setTimeout(() => {
      overlay.classList.add("is-leaving");
    }, 1300);

    window.setTimeout(() => {
      overlay.remove();
    }, 1700);
  }

  function refreshMenus() {
    const session = Storage.getCurrentSession();
    const menus = document.querySelectorAll(".menu");

    menus.forEach((menu) => {
      menu.classList.add("menu-profile-only");
      menu.replaceChildren(createProfileMenu(session));
    });

    showWelcome(session);
  }

  window.addEventListener("storage", (event) => {
    if (event.key === AUTH_EVENT_KEY || event.key === "wikiband_session") {
      window.location.reload();
    }
  });

  document.addEventListener("wikiband:profile-updated", refreshMenus);

  refreshMenus();
})(window, document);
