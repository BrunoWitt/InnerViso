// src/scripts/coletarLi.js
function initColetarLi() {
    console.log("[coletarLi] iniciado");

    const btnRun = document.getElementById("run-coletar-li-btn");
    const overlay = document.getElementById("loading-overlay-li");
    const btnCancelar = document.getElementById("cancel-li-btn");

    const msgEl = document.getElementById("li-progress-message");

    const resultBox = document.getElementById("coletar-li-result");
    const textarea = document.getElementById("coletar-li-textarea");
    const copyBtn = document.getElementById("copy-lis-btn");
    const closeBtn = document.getElementById("close-li-result-btn");
    const loadingBox = document.getElementById("coletar-li-loading");

    let cancelRequested = false;

    function showLoading(message) {
        if (msgEl) msgEl.textContent = message || "Processando...";
        loadingBox?.classList.remove("hidden");
        resultBox?.classList.add("hidden");
        overlay?.classList.remove("hidden");
    }

    function showResult(lis = []) {
        textarea.value = lis.join("\n");
        loadingBox?.classList.add("hidden");
        resultBox?.classList.remove("hidden");
    }

    function hideModal() {
        overlay?.classList.add("hidden");
    }

    // =========================
    // COPIAR LIs
    // =========================
    copyBtn?.addEventListener("click", async () => {
        try {
        await navigator.clipboard.writeText(textarea.value);
        copyBtn.textContent = "Copiado!";
        setTimeout(() => (copyBtn.textContent = "Copiar LIs"), 1200);
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
        if (!window.api?.cancelColetarLi) {
            console.error("[coletarLi] window.api.cancelColetarLi não existe (preload não expôs?)");
        } else {
            await window.api.cancelColetarLi();
        }
        } finally {
        hideModal();
        btnCancelar.textContent = "Cancelar";
        cancelRequested = false;
        }
    });

    // =========================
    // EXECUTAR COLETA
    // =========================
    btnRun?.addEventListener("click", async () => {
        cancelRequested = false;
        showLoading("Iniciando coleta das LIs...");

        try {
        if (!window.api?.coletarLi) {
            msgEl.textContent = "Erro interno: API não disponível no preload.";
            return;
        }

        const result = await window.api.coletarLi();

        if (result?.status === "sucesso") {
            showResult(result.lis || []);
        } else {
            msgEl.textContent = result?.mensagem || "Erro na coleta.";
        }
        } catch (e) {
        msgEl.textContent = "Erro inesperado durante a coleta.";
        }
    });
}

window.initColetarLi = initColetarLi;
