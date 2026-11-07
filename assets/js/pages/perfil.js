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
    const previews = [photoPreview, document.getElementById("profilePhotoLarge")].filter(Boolean);

    previews.forEach((preview) => {
      preview.replaceChildren();

      if (avatar) {
        const image = document.createElement("img");
        image.src = avatar;
        image.alt = "";
        preview.appendChild(image);
        return;
      }

      preview.textContent = Storage.getUserInitials?.(session) || "WB";
    });
  }

  function renderStats() {
    const dashboard = Storage.getDashboardData?.();
    const totals = dashboard?.totals || {};
    const stats = [
      ["Buscas", totals.searches || 0],
      ["Álbuns favoritos", totals.albumFavorites || 0],
      ["Artistas favoritos", totals.bandFavorites || 0],
      ["Coleções", totals.collections || 0],
      ["Reproduções", totals.plays || 0]
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

  // ---------- Security: change password ----------

  const passwordForm = document.getElementById("passwordForm");
  const passwordStatus = document.getElementById("passwordStatus");
  const passwordSubmit = document.getElementById("passwordSubmit");

  function setPasswordFeedback(message, type) {
    passwordStatus.textContent = message;
    passwordStatus.classList.toggle("is-error", type === "error");
    passwordStatus.classList.toggle("is-success", type === "success");
  }

  // Password fields start readonly so the browser cannot autofill the saved password:
  // the user has to type the current and the new password.
  passwordForm?.querySelectorAll("[data-no-autofill]").forEach((field) => {
    field.value = "";
    field.addEventListener("focus", () => field.removeAttribute("readonly"), { once: true });
  });

  passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const senhaAtual = document.getElementById("currentPassword").value;
    const novaSenha = document.getElementById("newPassword").value;
    const confirmacao = document.getElementById("confirmNewPassword").value;

    if (!senhaAtual || !novaSenha) {
      setPasswordFeedback("Preencha a senha atual e a nova senha.", "error");
      return;
    }

    if (novaSenha === senhaAtual) {
      setPasswordFeedback("A nova senha precisa ser diferente da atual.", "error");
      return;
    }

    if (novaSenha !== confirmacao) {
      setPasswordFeedback("A confirmação não confere com a nova senha.", "error");
      return;
    }

    passwordSubmit.disabled = true;
    setPasswordFeedback("Trocando senha...", "success");

    try {
      const result = await Storage.changePassword({ senhaAtual, novaSenha });
      setPasswordFeedback(result.message, result.ok ? "success" : "error");
      if (result.ok) passwordForm.reset();
    } finally {
      passwordSubmit.disabled = false;
    }
  });

  // ---------- Privacy: public profile ----------

  const publicToggle = document.getElementById("publicProfileToggle");
  const privacyStatus = document.getElementById("privacyStatus");
  const publicLinkRow = document.getElementById("publicLinkRow");
  const publicLinkInput = document.getElementById("publicLinkInput");

  function publicProfileUrl() {
    const username = Storage.getCurrentSession()?.username || "";
    return new URL(`/usuario.html?u=${encodeURIComponent(username)}`, window.location.origin).toString();
  }

  function renderPrivacy(publico) {
    publicToggle.checked = publico;
    privacyStatus.textContent = publico
      ? "Qualquer pessoa com o link pode ver seus favoritos e coleções."
      : "Só você vê sua biblioteca.";
    publicLinkRow.hidden = !publico;
    publicLinkInput.value = publicProfileUrl();
    document.getElementById("openPublicLink").href = publicProfileUrl();
  }

  Storage.getLibraryPrivacy?.().then((result) => {
    if (!result?.ok) {
      privacyStatus.textContent = "Perfil público indisponível no momento.";
      return;
    }

    publicToggle.disabled = false;
    renderPrivacy(result.publico);
  });

  publicToggle?.addEventListener("change", async () => {
    publicToggle.disabled = true;
    const result = await Storage.setLibraryPrivacy(publicToggle.checked);
    publicToggle.disabled = false;

    if (!result.ok) {
      publicToggle.checked = !publicToggle.checked;
      window.WikibandUI?.toast(result.message || "Não foi possível salvar.");
      return;
    }

    renderPrivacy(result.publico);
    window.WikibandUI?.toast(result.publico ? "Seu perfil agora é público" : "Seu perfil agora é privado");
  });

  document.getElementById("copyPublicLinkButton")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(publicLinkInput.value);
      window.WikibandUI?.toast("Link copiado");
    } catch (error) {
      publicLinkInput.select();
    }
  });

  document.addEventListener("wikiband:library-synced", renderStats);
})(window, document);
