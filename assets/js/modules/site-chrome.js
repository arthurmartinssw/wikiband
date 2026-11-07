// Shared page chrome: header with tabs, mobile tab bar, footer, theme toggle, profile menu,
// in-page tabs, toasts and the cloud library sync kick-off.
(function initWikibandChrome(window, document) {
  const Storage = window.WikibandStorage;
  const AUTH_EVENT_KEY = "wikiband_auth_event";
  const THEME_KEY = "wikiband_theme";

  const ICONS = {
    logo: '<path d="M9 18V5l12-2v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="18" cy="16" r="3" fill="currentColor"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    search: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    library: '<path d="M4 4v16M9 4v16M14 4l6 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    sparkle: '<path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z" fill="currentColor"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" fill="currentColor"/>',
    user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    sun: '<circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    disc: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
    users: '<circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
    globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" fill="none" stroke="currentColor" stroke-width="2"/>',
    radio: '<path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'
  };

  function icon(name, className = "") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" class="${className}">${ICONS[name] || ""}</svg>`;
  }

  // ---------- Theme ----------

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // private mode: theme just won't persist
    }
  }

  // ---------- Toast ----------

  let toastStack = null;

  function toast(message, { duration = 2600 } = {}) {
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.className = "toast-stack";
      toastStack.setAttribute("role", "status");
      toastStack.setAttribute("aria-live", "polite");
      document.body.appendChild(toastStack);
    }

    const item = document.createElement("div");
    item.className = "toast glass";
    item.textContent = message;
    toastStack.appendChild(item);

    window.setTimeout(() => item.classList.add("is-leaving"), duration);
    window.setTimeout(() => item.remove(), duration + 350);
  }

  // ---------- In-page tabs ----------
  // Markup: <div class="tabs" role="tablist" data-tabs="name"><button role="tab" aria-controls="panelId">
  // The selected tab is remembered in the URL hash (#tab-panelId) so links and reloads keep it.

  function selectTab(tablist, tab, { focus = false, updateHash = true } = {}) {
    tablist.querySelectorAll('[role="tab"]').forEach((other) => {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      other.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(other.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });

    if (focus) tab.focus();
    if (updateHash && tablist.dataset.tabsHash !== undefined) {
      window.history.replaceState({}, "", `#${tab.getAttribute("aria-controls")}`);
    }

    tablist.dispatchEvent(new CustomEvent("wikiband:tab-change", { detail: { panelId: tab.getAttribute("aria-controls") } }));
  }

  function initTabs(root = document) {
    root.querySelectorAll('[role="tablist"]').forEach((tablist) => {
      if (tablist.dataset.tabsReady) return;
      tablist.dataset.tabsReady = "1";

      const tabs = [...tablist.querySelectorAll('[role="tab"]')];
      const fromHash = tabs.find((tab) => `#${tab.getAttribute("aria-controls")}` === window.location.hash);
      const initial = fromHash || tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];

      if (initial) selectTab(tablist, initial, { updateHash: false });

      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => selectTab(tablist, tab));
        tab.addEventListener("keydown", (event) => {
          const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
          if (!step) return;
          event.preventDefault();
          selectTab(tablist, tabs[(index + step + tabs.length) % tabs.length], { focus: true });
        });
      });
    });
  }

  // ---------- Header / tab bar / footer ----------

  const NAV_ITEMS = [
    { id: "home", label: "Início", href: "/", icon: "home" },
    { id: "library", label: "Biblioteca", href: "/favoritos.html", icon: "library" },
    { id: "community", label: "Comunidade", href: "/comunidade.html", icon: "users" },
    { id: "about", label: "Sobre", href: "/sobre.html", icon: "info" }
  ];

  function createLink(item, currentPage) {
    const link = document.createElement("a");
    link.className = "nav-tab";
    link.href = item.href;
    link.innerHTML = `${icon(item.icon)}<span></span>`;
    link.querySelector("span").textContent = item.label;
    if (item.id === currentPage) link.setAttribute("aria-current", "page");
    return link;
  }

  function createButtonTab(label, iconName, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-tab";
    button.innerHTML = `${icon(iconName)}<span></span>`;
    button.querySelector("span").textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function openMusicAI() {
    window.WikibandMusicAssistant?.open();
  }

  function focusSearch() {
    const input = document.getElementById("searchInput");

    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
      return;
    }

    window.location.href = "/?focus=search";
  }

  function createAvatar(session) {
    const avatar = document.createElement("span");
    avatar.className = "profile-avatar";
    const avatarData = session ? Storage?.getCurrentAvatar?.() : "";

    if (avatarData) {
      const image = document.createElement("img");
      image.src = avatarData;
      image.alt = "";
      avatar.appendChild(image);
      return avatar;
    }

    if (session) {
      avatar.textContent = Storage?.getUserInitials?.(session) || "WB";
    } else {
      avatar.innerHTML = icon("user");
      avatar.querySelector("svg").style.width = "20px";
    }

    return avatar;
  }

  function createMenuItem(label, hrefOrHandler, iconName = "", danger = false) {
    const item = document.createElement(typeof hrefOrHandler === "string" ? "a" : "button");
    item.className = `profile-menu-item${danger ? " is-danger" : ""}`;
    item.innerHTML = `${iconName ? icon(iconName) : ""}<span></span>`;
    item.querySelector("span").textContent = label;

    if (typeof hrefOrHandler === "string") {
      item.href = hrefOrHandler;
    } else {
      item.type = "button";
      item.addEventListener("click", hrefOrHandler);
    }

    return item;
  }

  function logout() {
    const session = Storage.getCurrentSession();
    Storage.clearCurrentSession();
    localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ action: "logout", email: session?.email || "", ts: Date.now() }));
    window.location.href = "/";
  }

  function createProfileMenu(session) {
    const wrapper = document.createElement("div");
    wrapper.className = "profile-menu";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "profile-trigger";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", session ? "Abrir menu do perfil" : "Entrar ou criar conta");
    trigger.appendChild(createAvatar(session));

    const dropdown = document.createElement("div");
    dropdown.className = "profile-dropdown glass";

    if (session) {
      const header = document.createElement("div");
      header.className = "profile-dropdown-header";
      const name = document.createElement("strong");
      const handle = document.createElement("span");
      name.textContent = session.nome;
      handle.textContent = session.username ? `@${session.username}` : session.email;
      header.append(createAvatar(session), name, handle);

      const group = (title, ...items) => {
        const wrapper = document.createElement("div");
        wrapper.className = "menu-group";
        if (title) {
          const heading = document.createElement("span");
          heading.className = "menu-group-title";
          heading.textContent = title;
          wrapper.appendChild(heading);
        }
        wrapper.append(...items);
        return wrapper;
      };

      dropdown.append(
        header,
        group(
          "Conta",
          createMenuItem("Editar perfil", "/perfil.html#tabPerfil", "user"),
          createMenuItem("Meu perfil público", `/usuario.html?u=${encodeURIComponent(session.username || "")}`, "globe"),
          createMenuItem("Senha e segurança", "/perfil.html#tabSeguranca", "lock")
        ),
        group(
          "Música",
          createMenuItem("Biblioteca", "/favoritos.html", "library"),
          createMenuItem("Retrospectiva", "/retrospectiva.html", "trophy"),
          createMenuItem("Comunidade", "/comunidade.html", "users")
        ),
        group("", createMenuItem("Sair", logout, "logout", true))
      );
    } else {
      dropdown.append(
        createMenuItem("Entrar", "/login.html", "user"),
        createMenuItem("Criar conta", "/cadastro.html", "plus"),
        createMenuItem("Sobre a Wikiband", "/sobre.html", "info")
      );
    }

    const close = () => {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = wrapper.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });
    document.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    wrapper.addEventListener("click", (event) => event.stopPropagation());

    wrapper.append(trigger, dropdown);
    return wrapper;
  }

  function createThemeToggle() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn theme-toggle";
    button.setAttribute("aria-label", "Alternar tema claro/escuro");
    button.title = "Alternar tema";
    button.innerHTML = `${icon("sun", "icon-sun")}${icon("moon", "icon-moon")}`;
    button.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
    return button;
  }

  function renderHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const currentPage = header.dataset.page || "";
    const session = Storage?.getCurrentSession?.() || null;

    const shell = document.createElement("div");
    shell.className = "nav-shell glass";

    const brand = document.createElement("a");
    brand.className = "brand";
    brand.href = "/";
    brand.setAttribute("aria-label", "Wikiband, página inicial");
    brand.innerHTML = `<span class="brand-mark"><img src="/assets/icons/android-chrome-192x192.png" alt="" width="34" height="34"></span><span>Wikiband</span>`;

    const tabs = document.createElement("nav");
    tabs.className = "nav-tabs";
    tabs.setAttribute("aria-label", "Navegação principal");
    NAV_ITEMS.forEach((item) => tabs.appendChild(createLink(item, currentPage)));
    tabs.appendChild(createButtonTab("MusicAI", "sparkle", openMusicAI));

    const actions = document.createElement("div");
    actions.className = "nav-actions";
    // On phones the floating MusicAI button is hidden, so the header carries it.
    const aiButton = document.createElement("button");
    aiButton.type = "button";
    aiButton.className = "icon-btn musicai-action";
    aiButton.setAttribute("aria-label", "Abrir MusicAI");
    aiButton.innerHTML = icon("sparkle");
    aiButton.addEventListener("click", openMusicAI);

    actions.append(aiButton, createThemeToggle(), createProfileMenu(session));

    shell.append(brand, tabs, actions);
    header.replaceChildren(shell);

    // Mobile: iOS-style bottom tab bar
    const tabbar = document.createElement("nav");
    tabbar.className = "tabbar glass";
    tabbar.setAttribute("aria-label", "Navegação principal");
    tabbar.append(
      createLink(NAV_ITEMS[0], currentPage),
      createButtonTab("Buscar", "search", focusSearch),
      createLink(NAV_ITEMS[1], currentPage),
      createLink(NAV_ITEMS[2], currentPage),
      createLink({ id: "profile", label: session ? "Perfil" : "Entrar", href: session ? "/perfil.html" : "/login.html", icon: "user" }, currentPage)
    );
    document.querySelector(".tabbar")?.remove();
    document.body.appendChild(tabbar);
  }

  function renderFooter() {
    if (document.querySelector(".site-footer") || !document.querySelector(".site-header")) return;

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="footer-brand">
        <a class="brand" href="/"><span class="brand-mark"><img src="/assets/icons/android-chrome-192x192.png" alt="" width="34" height="34"></span><span>Wikiband</span></a>
        <p>Uma vitrine para conhecer artistas, ouvir prévias e guardar suas descobertas.</p>
        <small>Dados musicais: Apple Music / iTunes. Biografias: Wikipédia.</small>
      </div>
      <div>
        <h3>Explorar</h3>
        <nav aria-label="Explorar">
          <a href="/">Início</a>
          <a href="/#em-alta">Em alta</a>
          <a href="/favoritos.html">Biblioteca</a>
          <a href="/perfil.html">Perfil</a>
        </nav>
      </div>
      <div>
        <h3>Wikiband</h3>
        <nav aria-label="Institucional">
          <a href="/sobre.html">Sobre</a>
          <a href="/sobre.html#privacidade">Privacidade</a>
          <a href="/sobre.html#termos">Termos de uso</a>
        </nav>
      </div>
    `;

    const anchor = document.querySelector("main");
    (anchor?.parentNode || document.body).insertBefore(footer, anchor?.nextSibling || null);
  }

  function showWelcome(session) {
    if (!session || !Storage?.consumeWelcomePending?.()) return;

    const overlay = document.createElement("div");
    overlay.className = "welcome-screen";
    overlay.innerHTML = '<div class="welcome-card glass"><span class="welcome-avatar"></span><strong></strong><p>Bom te ver por aqui.</p></div>';
    overlay.querySelector(".welcome-avatar").textContent = Storage.getUserInitials?.(session) || "WB";
    overlay.querySelector("strong").textContent = `Bem-vindo, ${session.nome}`;
    document.body.appendChild(overlay);

    window.setTimeout(() => overlay.classList.add("is-leaving"), 1300);
    window.setTimeout(() => overlay.remove(), 1750);
  }

  function refresh() {
    renderHeader();
    showWelcome(Storage?.getCurrentSession?.());
  }

  window.addEventListener("storage", (event) => {
    if (event.key === AUTH_EVENT_KEY || event.key === "wikiband_session") {
      window.location.reload();
    }

    if (event.key === THEME_KEY && event.newValue) {
      document.documentElement.setAttribute("data-theme", event.newValue);
    }
  });

  document.addEventListener("wikiband:profile-updated", renderHeader);
  document.addEventListener("wikiband:session-expired", () => {
    renderHeader();
    toast("Sua sessão expirou. Entre novamente para sincronizar.");
  });

  window.WikibandUI = { icon, initTabs, toast, setTheme };

  refresh();
  renderFooter();
  initTabs();
  Storage?.syncLibrary?.();
})(window, document);
