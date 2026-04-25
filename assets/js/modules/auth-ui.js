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

  function createLogoutButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-auth-btn";
    button.textContent = "Sair";

    button.addEventListener("click", () => {
      const session = Storage.getCurrentSession();
      Storage.clearCurrentSession();
      createAuthEvent("logout", session?.email || "");
      window.location.href = "/index.html";
    });

    return button;
  }

  function createLoginLink() {
    const link = document.createElement("a");
    link.href = "/login.html";
    link.target = "_blank";
    link.textContent = "Login";
    link.setAttribute("data-auth-link", "true");
    return link;
  }

  function refreshMenus() {
    const session = Storage.getCurrentSession();
    const menus = document.querySelectorAll(".menu");

    menus.forEach((menu) => {
      const existingAuthButton = menu.querySelector(".menu-auth-btn");
      const existingLoginLink =
        menu.querySelector('[data-auth-link="true"]') ||
        menu.querySelector('a[href="/login.html"]') ||
        menu.querySelector('a[href="login.html"]');

      if (session) {
        if (existingLoginLink) {
          existingLoginLink.remove();
        }

        if (!existingAuthButton) {
          menu.appendChild(createLogoutButton());
        }

        return;
      }

      if (existingAuthButton) {
        existingAuthButton.remove();
      }

      if (!existingLoginLink) {
        menu.appendChild(createLoginLink());
      }
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === AUTH_EVENT_KEY || event.key === "wikiband_session") {
      window.location.reload();
    }
  });

  refreshMenus();
})(window, document);
