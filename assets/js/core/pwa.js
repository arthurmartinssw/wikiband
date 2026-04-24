(function initWikibandPWA(window) {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((erro) => {
      console.warn("Falha ao registrar service worker:", erro);
    });
  });
})(window);
