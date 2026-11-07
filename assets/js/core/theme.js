// Loaded in <head> so the saved theme applies before the first paint (no flash).
(function applyWikibandTheme() {
  var saved = null;

  try {
    saved = localStorage.getItem("wikiband_theme");
  } catch (error) {
    saved = null;
  }

  var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  var theme = saved === "light" || saved === "dark" ? saved : prefersLight ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", theme);
})();
