function initColetarDi() {
  console.log("[coletarDi] iniciado");

  

  const btnParser = document.getElementById("run-parser-btn");
  const loadingOverlay = document.getElementById("loading-overlay");
  const btnCancelar = document.getElementById("cancel-parser-btn");

  const msgEl = document.getElementById("expo8-progress-message");

  const resultBox = document.getElementById("coletar-di-result");
  const textarea = document.getElementById("coletar-di-textarea");
  const copyBtn = document.getElementById("copy-dis-btn");
  const closeBtn = document.getElementById("close-result-btn");
  const loadingBox = document.getElementById("coletar-di-loading");

  let cancelRequested = false;

  function showLoading(message) {
    if (msgEl) msgEl.textContent = message || "Processando...";
    loadingBox?.classList.remove("hidden");
    resultBox?.classList.add("hidden");
    loadingOverlay.classList.remove("hidden");
}

function showResult(dis = []) {
    textarea.value = dis.join("\n");

    loadingBox?.classList.add("hidden");   // 🔴 some spinner
    resultBox?.classList.remove("hidden"); // ✅ mostra resultado
}

  function hideModal() {
    loadingOverlay.classList.add("hidden");
  }

  // =========================
  // COPIAR DIs
  // =========================
  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      copyBtn.textContent = "Copiado!";
      setTimeout(() => (copyBtn.textContent = "Copiar DIs"), 1200);
    } catch {
      alert("Não foi possível copiar para a área de transferência.");
    }
  });

  closeBtn?.addEventListener("click", hideModal);

  // =========================
  // CANCELAR
  // =========================
  btnCancelar?.addEventListener("click", async () => {
    if (cancelRequested) return;
    cancelRequested = true;
    btnCancelar.textContent = "Cancelando...";

    try {
      await window.api.cancelColetarDi();
    } finally {
      hideModal();
    }
  });

  // =========================
  // EXECUTAR COLETA
  // =========================
  btnParser.addEventListener("click", async () => {
    cancelRequested = false;
    showLoading("Iniciando coleta das DIs...");

    try {
      const result = await window.api.coletarDi();

      if (result?.status === "sucesso") {
        showResult(result.dis || []);
      } else {
        msgEl.textContent = result?.mensagem || "Erro na coleta.";
      }
    } catch (e) {
      msgEl.textContent = "Erro inesperado durante a coleta.";
    }
  });
}

window.initColetarDi = initColetarDi;