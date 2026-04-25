(function initCadastroPage(window, document) {
  const Storage = window.WikibandStorage;
  const form = document.getElementById("cadastroForm");
  const nomeInput = document.getElementById("signupName");
  const emailInput = document.getElementById("signupEmail");
  const senhaInput = document.getElementById("signupPassword");
  const confirmarInput = document.getElementById("signupConfirmPassword");
  const statusElement = document.getElementById("cadastroStatus");
  const submitButton = document.getElementById("cadastroSubmit");

  if (
    !form ||
    !nomeInput ||
    !emailInput ||
    !senhaInput ||
    !confirmarInput ||
    !statusElement ||
    !submitButton
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

  if (!Storage || typeof Storage.registerUser !== "function") {
    setFeedback("Nao foi possivel inicializar o cadastro agora.", "error");
    submitButton.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const senha = senhaInput.value;
    const confirmarSenha = confirmarInput.value;

    if (!nome || !email || !senha || !confirmarSenha) {
      setFeedback("Preencha todos os campos.", "error");
      return;
    }

    if (senha !== confirmarSenha) {
      setFeedback("Senha e confirmacao de senha devem ser iguais.", "error");
      return;
    }

    submitButton.disabled = true;
    setFeedback("Criando conta...", "success");

    try {
      const result = await Storage.registerUser({ nome, email, senha });

      if (!result.ok) {
        setFeedback(result.message || "Nao foi possivel criar a conta.", "error");
        return;
      }

      setFeedback("Conta criada com sucesso. Redirecionando para login...", "success");
      form.reset();
      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 900);
    } catch (erro) {
      console.warn("Falha ao criar usuario:", erro);
      setFeedback("Nao foi possivel concluir o cadastro agora.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
})(window, document);
