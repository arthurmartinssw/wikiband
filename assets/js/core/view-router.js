(function initWikibandViewRouter(window) {
  const VALID_VIEWS = new Set(["home", "favorites", "detail", "about"]);

  function hasDetailParams(params) {
    return (
      params.has("albumId") ||
      params.has("trackId") ||
      params.has("artistId") ||
      params.has("artist") ||
      params.has("album") ||
      params.has("song")
    );
  }

  function readViewFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");

    if (VALID_VIEWS.has(view)) {
      return view;
    }

    if (hasDetailParams(params)) {
      return "detail";
    }

    return "home";
  }

  function setMenuState(view) {
    document.querySelectorAll("[data-nav-view]").forEach((link) => {
      link.classList.toggle("active", link.dataset.navView === view);
    });
  }

  function setPanelsState(view) {
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== view;
    });
  }

  function notifyViewChange(view) {
    window.dispatchEvent(
      new CustomEvent("wikiband:view-change", {
        detail: { view }
      })
    );
  }

  function applyView(view, { notify = true } = {}) {
    setPanelsState(view);
    setMenuState(view);

    if (notify) {
      notifyViewChange(view);
    }
  }

  function syncViewToUrl(view, { replace = false } = {}) {
    const params = new URLSearchParams(window.location.search);

    if (view === "home") {
      params.set("view", "home");
    } else {
      params.set("view", view);
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}`;

    if (replace) {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
  }

  function navigateToView(view, { replace = false } = {}) {
    const normalized = VALID_VIEWS.has(view) ? view : "home";
    syncViewToUrl(normalized, { replace });
    applyView(normalized);
  }

  function openDetail(item) {
    if (!item || !window.WikibandLinks?.buildDetailUrl) {
      navigateToView("detail");
      return;
    }

    const detailUrl = window.WikibandLinks.buildDetailUrl(item);
    window.history.pushState({}, "", detailUrl);
    applyView("detail");
  }

  function handleNavClick(event) {
    const link = event.target.closest("a[data-nav-view]");

    if (!link) return;

    event.preventDefault();
    navigateToView(link.dataset.navView);
  }

  function handlePopState() {
    applyView(readViewFromUrl());
  }

  document.addEventListener("click", handleNavClick);
  window.addEventListener("popstate", handlePopState);

  const initialView = readViewFromUrl();
  syncViewToUrl(initialView, { replace: true });
  applyView(initialView);

  window.WikibandViewRouter = {
    navigateToView,
    openDetail,
    readViewFromUrl
  };
})(window);
