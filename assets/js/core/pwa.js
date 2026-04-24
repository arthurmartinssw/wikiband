(function initWikibandPWA(window) {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      })
      .catch((erro) => {
        console.warn("Falha ao registrar service worker:", erro);
      });
  });
})(window);
