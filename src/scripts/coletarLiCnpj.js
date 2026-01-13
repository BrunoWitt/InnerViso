// src/scripts/coletarLiCnpj.js
(() => {
  if (window.__coletarLiCnpjLoaded) return;
  window.__coletarLiCnpjLoaded = true;

  console.log("[coletarLiCnpj.js] carregado ✅", new Date().toISOString());

  // =========================
  // ESTADO (privado do script)
  // =========================
  let cnpjs = [];
  let cancelRequested = false;
  let runToken = 0;

  // refs DOM
  let btnAdicionarCnpj;
  let btnProcessar;
  let inputCnpj;
  let listContainer;
  let warningEl;

  let dataInicialEl;
  let dataFinalEl;

  let loadingOverlay;
  let loadingBox;
  let resultBox;
  let msgEl;
  let textareaEl;
  let btnCancelarModal;
  let btnCopiar;
  let btnFechar;

  function isoToBrDate(iso) {
    const s = String(iso || "").trim();
    if (!s) return "";
    const [yyyy, mm, dd] = s.split("-");
    if (!yyyy || !mm || !dd) return "";
    return `${dd}/${mm}/${yyyy}`;
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function parseCnpjs(raw) {
    return String(raw || "")
      .split(/[,\|]/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(onlyDigits)
      .filter((d) => d.length > 0);
  }

  function formatCnpj(digits) {
    if (digits.length !== 14) return digits;
    return (
      digits.slice(0, 2) + "." +
      digits.slice(2, 5) + "." +
      digits.slice(5, 8) + "/" +
      digits.slice(8, 12) + "-" +
      digits.slice(12, 14)
    );
  }

  function showWarning(show, message) {
    if (!warningEl) return;
    if (message) warningEl.textContent = message;
    warningEl.classList.toggle("is-hidden", !show);
  }

  function renderCnpjList() {
    if (!listContainer) return;

    listContainer.innerHTML = "";

    cnpjs.forEach((cnpjDigits) => {
      const row = document.createElement("div");
      row.className = "list-item";

      const text = document.createElement("div");
      text.className = "list-text";
      text.textContent = formatCnpj(cnpjDigits);

      const btnRemove = document.createElement("button");
      btnRemove.type = "button";
      btnRemove.className = "btn-remove";
      btnRemove.textContent = "Remover";
      btnRemove.addEventListener("click", () => removeCnpj(cnpjDigits));

      row.appendChild(text);
      row.appendChild(btnRemove);
      listContainer.appendChild(row);
    });
  }

  function addCnpjsFromInput() {
    if (!inputCnpj) return;

    const raw = inputCnpj.value;

    if (!raw || !raw.trim()) {
      showWarning(true, "Você precisa informar pelo menos um CNPJ antes de adicionar.");
      return;
    }

    const parsed = parseCnpjs(raw);
    const valid = parsed.filter((d) => d.length === 14);

    if (valid.length === 0) {
      showWarning(true, "Informe CNPJ(s) com 14 dígitos (ex.: 12.345.678/0001-90).");
      return;
    }

    showWarning(false);

    valid.forEach((d) => {
      if (!cnpjs.includes(d)) cnpjs.push(d);
    });

    inputCnpj.value = "";
    renderCnpjList();
  }

  function removeCnpj(cnpjDigits) {
    cnpjs = cnpjs.filter((x) => x !== cnpjDigits);
    renderCnpjList();
  }

  function setProcessing(isProcessing) {
    if (!btnProcessar) return;
    btnProcessar.disabled = isProcessing;
    btnProcessar.textContent = isProcessing ? "Processando..." : "Executar coleta";
  }

  function showLoading(message) {
    if (msgEl) msgEl.textContent = message || "Processando...";
    loadingBox?.classList.remove("hidden");
    resultBox?.classList.add("hidden");
    loadingOverlay?.classList.remove("hidden");
    loadingOverlay?.setAttribute("aria-hidden", "false");
  }

  function showResult(lis = []) {
    if (!textareaEl) return;
    textareaEl.value = (lis || []).join("\n");
    loadingBox?.classList.add("hidden");
    resultBox?.classList.remove("hidden");
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

  async function processarColeta() {
    const initialDateIso = dataInicialEl?.value || "";
    const endDateIso = dataFinalEl?.value || "";

    const initialDate = isoToBrDate(initialDateIso);
    const endDate = isoToBrDate(endDateIso);

    if (cnpjs.length === 0) {
      showWarning(true, "Adicione pelo menos um CNPJ antes de executar.");
      return;
    }

    if (!initialDate || !endDate) {
      showWarning(true, "Informe a data inicial e a data final antes de executar.");
      return;
    }

    showWarning(false);

    if (!window.api?.coletarLiCnpj) {
      console.error("[coletarLiCnpj] window.api.coletarLiCnpj não existe (preload não expôs?)");
      showWarning(true, "Erro interno: API não disponível no preload.");
      return;
    }

    cancelRequested = false;
    const currentToken = ++runToken;

    try {
      setProcessing(true);
      showLoading("Iniciando coleta das LIs...");

      const result = await window.api.coletarLiCnpj([...cnpjs], initialDate, endDate);

      if (cancelRequested || currentToken !== runToken) return;

      if (result?.status === "sucesso") {
        const lis = Array.isArray(result?.lis) ? result.lis : [];
        if (lis.length > 0) showResult(lis);
        else showLoading(result?.mensagem || "Nenhuma LI encontrada para os filtros informados.");
      } else {
        showLoading(result?.mensagem || "Erro ao processar.");
      }
    } catch (err) {
      if (!cancelRequested && currentToken === runToken) {
        console.error("[coletarLiCnpj] erro chamando IPC:", err);
        showLoading(`Erro inesperado: ${err?.message || err}`);
      }
    } finally {
      setProcessing(false);
    }
  }

  function initColetarLiCnpj() {
    // reset por abertura de tela (opcional)
    cnpjs = [];
    cancelRequested = false;

    btnAdicionarCnpj = document.getElementById("add-cnpj-btn");
    btnProcessar = document.getElementById("btnProcessar");
    inputCnpj = document.getElementById("cnpj-input");
    listContainer = document.getElementById("cnpj-list");
    warningEl = document.getElementById("cnpj-warning");
    dataInicialEl = document.getElementById("dataInicial");
    dataFinalEl = document.getElementById("dataFinal");

    loadingOverlay = document.getElementById("loading-overlay");
    loadingBox = document.getElementById("coletar-li-cnpj-loading");
    resultBox = document.getElementById("coletar-li-cnpj-result");
    msgEl = document.getElementById("scraper-progress-message");
    textareaEl = document.getElementById("coletar-li-cnpj-textarea");
    btnCancelarModal = document.getElementById("cancelar-coleta-btn");
    btnCopiar = document.getElementById("copy-lis-btn");
    btnFechar = document.getElementById("close-result-btn");

    console.log("[coletarLiCnpj] init", {
      btnAdicionarCnpj: !!btnAdicionarCnpj,
      btnProcessar: !!btnProcessar,
      inputCnpj: !!inputCnpj,
      listContainer: !!listContainer,
    });

    if (!btnAdicionarCnpj || !btnProcessar || !inputCnpj || !listContainer) return;

    btnAdicionarCnpj.onclick = addCnpjsFromInput;
    inputCnpj.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCnpjsFromInput();
      }
    };
    btnProcessar.onclick = processarColeta;

    btnCancelarModal?.addEventListener("click", () => {
      cancelRequested = true;
      if (btnCancelarModal) btnCancelarModal.textContent = "Cancelado";
      hideModal();
    });

    btnCopiar?.addEventListener("click", async () => {
      const ok = await copyAllToClipboard(textareaEl?.value || "");
      if (!btnCopiar) return;
      if (ok) {
        const old = btnCopiar.textContent;
        btnCopiar.textContent = "Copiado!";
        setTimeout(() => (btnCopiar.textContent = old || "Copiar todas"), 1200);
      } else {
        alert("Não foi possível copiar para a área de transferência.");
      }
    });

    btnFechar?.addEventListener("click", hideModal);

    showWarning(false);
    renderCnpjList();
    setProcessing(false);
  }

  // ✅ Única coisa exposta pro router:
  window.initColetarLiCnpj = initColetarLiCnpj;
})();
