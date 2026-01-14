// src/scripts/baixarDiPdf.js
(() => {
  if (window.__baixarDiPdfLoaded) return;
  window.__baixarDiPdfLoaded = true;

  console.log("[baixarDiPdf.js] carregado ✅", new Date().toISOString());

  let dis = [];
  let outputDir = "";
  let cancelRequested = false;
  let runToken = 0;

  // DOM
  let inputDi;
  let btnAddDi;
  let listContainer;
  let warningEl;

  let outputPathEl;
  let btnChooseOutput;
  let btnOpenOutput;

  let btnProcessar;

  // Modal
  let loadingOverlay;
  let loadingBox;
  let resultBox;
  let msgEl;
  let textareaEl;
  let btnCancelar;
  let btnCopiar;
  let btnFechar;
  let btnOpenOutputModal;

  function onlyDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function parseDis(raw) {
    return String(raw || "")
      .split(/[,\|]/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(onlyDigits)
      .filter((d) => d.length > 0);
  }

  function showWarning(show, message) {
    if (!warningEl) return;
    if (message) warningEl.textContent = message;
    warningEl.classList.toggle("is-hidden", !show);
  }

  function renderList() {
    if (!listContainer) return;
    listContainer.innerHTML = "";

    dis.forEach((di) => {
      const row = document.createElement("div");
      row.className = "list-item";

      const text = document.createElement("div");
      text.className = "list-text";
      text.textContent = di;

      const btnRemove = document.createElement("button");
      btnRemove.type = "button";
      btnRemove.className = "btn-remove";
      btnRemove.textContent = "Remover";
      btnRemove.addEventListener("click", () => removeDi(di));

      row.appendChild(text);
      row.appendChild(btnRemove);
      listContainer.appendChild(row);
    });
  }

  function addFromInput() {
    if (!inputDi) return;

    const raw = inputDi.value;
    if (!raw || !raw.trim()) {
      showWarning(true, "Você precisa informar pelo menos uma DI antes de adicionar.");
      return;
    }

    const parsed = parseDis(raw);

    // aceita 8 a 12 dígitos
    const valid = parsed.filter((d) => d.length >= 8 && d.length <= 12);

    if (!valid.length) {
      showWarning(true, "Informe DI(s) válidas (8 a 12 dígitos).");
      return;
    }

    showWarning(false);

    valid.forEach((d) => {
      if (!dis.includes(d)) dis.push(d);
    });

    inputDi.value = "";
    renderList();
  }

  function removeDi(di) {
    dis = dis.filter((x) => x !== di);
    renderList();
  }

  function setProcessing(isProcessing) {
    if (!btnProcessar) return;
    btnProcessar.disabled = isProcessing;
    btnProcessar.textContent = isProcessing ? "Processando..." : "Gerar PDF(s)";
  }

  function showLoading(message) {
    if (msgEl) msgEl.textContent = message || "Processando...";
    loadingBox?.classList.remove("hidden");
    resultBox?.classList.add("hidden");
    loadingOverlay?.classList.remove("hidden");
    loadingOverlay?.setAttribute("aria-hidden", "false");

    // no loading, não faz sentido botão do modal aparecer
    if (btnOpenOutputModal) btnOpenOutputModal.style.display = "none";
  }

  function showResult(lines = []) {
    if (!textareaEl) return;
    textareaEl.value = (lines || []).join("\n");

    loadingBox?.classList.add("hidden");
    resultBox?.classList.remove("hidden");

    // no resultado, mostra botão abrir pasta (se tiver outputDir)
    if (btnOpenOutputModal) {
      btnOpenOutputModal.disabled = !outputDir;
      btnOpenOutputModal.style.display = outputDir ? "inline-flex" : "none";
    }
  }

  function hideModal() {
    loadingOverlay?.classList.add("hidden");
    loadingOverlay?.setAttribute("aria-hidden", "true");
  }

  async function copyAllToClipboard(text) {
    const t = String(text || "");
    if (!t.trim()) return false;

    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      return false;
    }
  }

  async function escolherPasta() {
    if (!window.api?.selectDiPdfOutputDir) {
      showWarning(true, "Erro interno: seletor de pasta não disponível.");
      return;
    }

    const res = await window.api.selectDiPdfOutputDir();
    if (!res?.ok || !res?.path) return;

    outputDir = res.path;

    if (outputPathEl) outputPathEl.value = outputDir;
    if (btnOpenOutput) btnOpenOutput.disabled = !outputDir;

    showWarning(false);
  }

  async function abrirPastaSaida() {
    if (!outputDir) return;
    try {
      await window.api?.openPath?.(outputDir);
    } catch (e) {
      console.error("[baixarDiPdf] erro ao abrir pasta:", e);
    }
  }

  async function processar() {
    if (!dis.length) {
      showWarning(true, "Adicione pelo menos uma DI antes de executar.");
      return;
    }
    if (!outputDir) {
      showWarning(true, "Selecione a pasta de saída antes de executar.");
      return;
    }

    if (!window.api?.diPdfDownloadAndConvert) {
      showWarning(true, "Erro interno: API não disponível no preload.");
      return;
    }

    cancelRequested = false;
    const currentToken = ++runToken;

    try {
      setProcessing(true);
      showLoading("Iniciando DI → PDF...");

      const result = await window.api.diPdfDownloadAndConvert([...dis], outputDir);

      if (cancelRequested || currentToken !== runToken) return;

      if (result?.status === "sucesso") {
        const files = Array.isArray(result?.files) ? result.files : [];

        if (files.length) {
          const lines = [`Destino: ${outputDir}`, "", ...files];
          showResult(lines);
        } else {
          showLoading(result?.mensagem || "Processo finalizado, porém sem arquivos.");
        }
      } else {
        showLoading(result?.mensagem || "Erro ao processar.");
      }
    } catch (err) {
      if (!cancelRequested && currentToken === runToken) {
        console.error("[baixarDiPdf] erro:", err);
        showLoading(`Erro inesperado: ${err?.message || err}`);
      }
    } finally {
      setProcessing(false);
    }
  }

  function initBaixarDiPdf() {
    // reset ao entrar na tela
    dis = [];
    outputDir = "";
    cancelRequested = false;

    // dom
    inputDi = document.getElementById("di-input");
    btnAddDi = document.getElementById("add-di-btn");
    listContainer = document.getElementById("di-list");
    warningEl = document.getElementById("di-warning");

    outputPathEl = document.getElementById("output-path");
    btnChooseOutput = document.getElementById("choose-output-btn");
    btnOpenOutput = document.getElementById("open-output-btn");

    btnProcessar = document.getElementById("btnProcessar");

    // modal
    loadingOverlay = document.getElementById("loading-overlay");
    loadingBox = document.getElementById("di-pdf-loading");
    resultBox = document.getElementById("di-pdf-result");
    msgEl = document.getElementById("scraper-progress-message");
    textareaEl = document.getElementById("di-pdf-textarea");
    btnCancelar = document.getElementById("cancelar-btn");
    btnCopiar = document.getElementById("copy-btn");
    btnFechar = document.getElementById("close-result-btn");
    btnOpenOutputModal = document.getElementById("open-output-btn-modal");

    if (!inputDi || !btnAddDi || !listContainer || !btnProcessar) return;

    // estado inicial
    if (outputPathEl) outputPathEl.value = "";
    if (btnOpenOutput) btnOpenOutput.disabled = true;
    if (btnOpenOutputModal) btnOpenOutputModal.style.display = "none";

    btnAddDi.onclick = addFromInput;

    inputDi.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addFromInput();
      }
    };

    btnChooseOutput?.addEventListener("click", escolherPasta);
    btnOpenOutput?.addEventListener("click", abrirPastaSaida);

    btnProcessar.onclick = processar;

    // updates de progresso do main (opcional)
    window.api?.onDiPdfProgress?.((payload) => {
      if (!payload?.message) return;
      if (msgEl) msgEl.textContent = payload.message;
    });

    btnCancelar?.addEventListener("click", async () => {
      if (cancelRequested) return;
      cancelRequested = true;
      hideModal();
      try {
        await window.api?.cancelDiPdf?.();
      } catch {}
    });

    btnCopiar?.addEventListener("click", async () => {
      const ok = await copyAllToClipboard(textareaEl?.value || "");
      if (!btnCopiar) return;

      if (ok) {
        const old = btnCopiar.textContent;
        btnCopiar.textContent = "Copiado!";
        setTimeout(() => (btnCopiar.textContent = old || "Copiar lista"), 1200);
      } else {
        alert("Não foi possível copiar para a área de transferência.");
      }
    });

    btnOpenOutputModal?.addEventListener("click", abrirPastaSaida);
    btnFechar?.addEventListener("click", hideModal);

    showWarning(false);
    renderList();
    setProcessing(false);
  }

  window.initBaixarDiPdf = initBaixarDiPdf;
})();
