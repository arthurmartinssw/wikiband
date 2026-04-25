(function initLoginPage(window, document) {
  const Storage = window.WikibandStorage;
  const AUTH_EVENT_KEY = "wikiband_auth_event";
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const statusElement = document.getElementById("loginStatus");
  const submitButton = document.getElementById("loginSubmit");

  if (!form || !emailInput || !passwordInput || !statusElement || !submitButton) {
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

  function completeLogin(email) {
    const opener = window.opener;

    createAuthEvent("login", email);

    if (opener && !opener.closed) {
      try {
        opener.focus();
        opener.location.reload();
      } catch (erro) {
        console.warn("Nao foi possivel atualizar a aba de origem:", erro);
      }
    }

    window.close();
    window.setTimeout(() => {
      window.location.href = "/index.html";
    }, 320);
  }

  if (!Storage || typeof Storage.authenticateUser !== "function") {
    setFeedback("Nao foi possivel inicializar o login agora.", "error");
    submitButton.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const senha = passwordInput.value;

    if (!email || !senha) {
      setFeedback("Preencha e-mail e senha.", "error");
      return;
    }

    submitButton.disabled = true;
    setFeedback("Validando credenciais...", "success");

    try {
      const result = await Storage.authenticateUser({ email, senha });

      if (!result.ok) {
        setFeedback(result.message || "E-mail ou senha invalidos.", "error");
        return;
      }

      setFeedback("Login realizado com sucesso. Redirecionando...", "success");
      window.setTimeout(() => {
        completeLogin(result.user?.email || email);
      }, 500);
    } catch (erro) {
      console.warn("Falha ao autenticar usuario:", erro);
      setFeedback("Nao foi possivel concluir o login agora.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
})(window, document);
