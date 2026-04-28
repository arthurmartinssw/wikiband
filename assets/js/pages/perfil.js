(function initPerfilPage(window, document) {
  const Storage = window.WikibandStorage;
  const AUTH_EVENT_KEY = "wikiband_auth_event";
  const form = document.getElementById("profileForm");
  const photoInput = document.getElementById("profilePhoto");
  const photoPreview = document.getElementById("profilePhotoPreview");
  const nameInput = document.getElementById("profileName");
  const usernameInput = document.getElementById("profileUsername");
  const emailInput = document.getElementById("profileEmail");
  const statusElement = document.getElementById("profileStatus");
  const submitButton = document.getElementById("profileSubmit");
  const removePhotoButton = document.getElementById("profileRemovePhoto");
  const statsElement = document.getElementById("profileStats");

  if (
    !Storage ||
    !form ||
    !photoInput ||
    !photoPreview ||
    !nameInput ||
    !usernameInput ||
    !emailInput ||
    !statusElement ||
    !submitButton ||
    !removePhotoButton ||
    !statsElement
  ) {
    return;
  }

  function setFeedback(message, type) {
    statusElement.textContent = message;
    statusElement.classList.remove("is-error", "is-success");

    if (type === "error") {
      statusElement.classList.add("is-error");
    }

    if (type === "success") {
      statusElement.classList.add("is-success");
    }
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

  function renderPhoto(session) {
    const avatar = Storage.getCurrentAvatar?.();
    photoPreview.replaceChildren();

    if (avatar) {
      const image = document.createElement("img");
      image.src = avatar;
      image.alt = "";
      photoPreview.appendChild(image);
      return;
    }

    photoPreview.textContent = Storage.getUserInitials?.(session) || "WB";
  }

  function renderStats() {
    const dashboard = Storage.getDashboardData?.();
    const totals = dashboard?.totals || {};
    const stats = [
      ["Buscas", totals.searches || 0],
      ["Albuns favoritos", totals.albumFavorites || 0],
      ["Bandas favoritas", totals.bandFavorites || 0],
      ["Colecoes", totals.collections || 0],
      ["Reproducoes", totals.plays || 0]
    ];

    statsElement.replaceChildren(
      ...stats.map(([label, value]) => {
        const item = document.createElement("div");
        const number = document.createElement("strong");
        const text = document.createElement("span");

        number.textContent = String(value);
        text.textContent = label;
        item.append(number, text);
        return item;
      })
    );
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();

        image.onload = () => {
          const maxSize = 256;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          canvas.width = width;
          canvas.height = height;
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.84));
        };

        image.onerror = () => reject(new Error("Imagem invalida."));
        image.src = String(reader.result || "");
      };

      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });
  }

  const session = Storage.getCurrentSession();

  if (!session) {
    setFeedback("Entre na sua conta para editar o perfil.", "error");
    form.hidden = true;
    window.setTimeout(() => {
      window.location.href = "/login.html";
    }, 900);
    return;
  }

  nameInput.value = session.nome;
  usernameInput.value = session.username || "";
  emailInput.value = session.email;
  renderPhoto(session);
  renderStats();

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback("Escolha uma imagem valida.", "error");
      return;
    }

    submitButton.disabled = true;
    setFeedback("Preparando foto...", "success");

    try {
      const dataUrl = await resizeImage(file);
      Storage.saveCurrentAvatar(dataUrl);
      renderPhoto(Storage.getCurrentSession());
      document.dispatchEvent(new CustomEvent("wikiband:profile-updated"));
      setFeedback("Foto salva neste navegador.", "success");
    } catch (error) {
      console.warn("Falha ao processar foto:", error);
      setFeedback("Nao foi possivel salvar essa foto.", "error");
    } finally {
      submitButton.disabled = false;
      photoInput.value = "";
    }
  });

  removePhotoButton.addEventListener("click", () => {
    Storage.saveCurrentAvatar("");
    renderPhoto(Storage.getCurrentSession());
    document.dispatchEvent(new CustomEvent("wikiband:profile-updated"));
    setFeedback("Foto removida deste navegador.", "success");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = nameInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();

    if (!nome || !username) {
      setFeedback("Preencha nome e nome de usuario.", "error");
      return;
    }

    if (typeof Storage.validateUsername === "function") {
      const usernameError = Storage.validateUsername(username);
      if (usernameError) {
        setFeedback(usernameError, "error");
        return;
      }
    }

    submitButton.disabled = true;
    setFeedback("Salvando perfil...", "success");

    try {
      const result = await Storage.updateUserProfile({ nome, username });

      if (!result.ok) {
        setFeedback(result.message || "Nao foi possivel salvar o perfil.", "error");
        return;
      }

      nameInput.value = result.user.nome;
      usernameInput.value = result.user.username;
      renderPhoto(result.user);
      createAuthEvent("profile", result.user.email);
      document.dispatchEvent(new CustomEvent("wikiband:profile-updated"));
      setFeedback("Perfil atualizado.", "success");
    } catch (error) {
      console.warn("Falha ao salvar perfil:", error);
      setFeedback("Nao foi possivel salvar o perfil agora.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
})(window, document);
