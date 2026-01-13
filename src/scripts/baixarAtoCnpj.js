// src/scripts/baixarAtoCnpj.js
(() => {
    if (window.__baixarAtoCnpjLoaded) return;
    window.__baixarAtoCnpjLoaded = true;

    console.log("[baixarAtoCnpj.js] carregado ✅", new Date().toISOString());

    let cnpjs = [];
    let cancelRequested = false;
    let runToken = 0;

    // DOM refs
    let btnAdicionarCnpj;
    let btnProcessar;
    let inputCnpj;
    let listContainer;
    let warningEl;

    // Modal
    let loadingOverlay;
    let loadingBox;
    let resultBox;
    let msgEl;
    let textareaEl;
    let btnCancelarModal;
    let btnCopiar;
    let btnFechar;

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
        btnProcessar.textContent = isProcessing ? "Processando..." : "Processar";
    }

    function showLoading(message) {
        if (msgEl) msgEl.textContent = message || "Processando...";
        loadingBox?.classList.remove("hidden");
        resultBox?.classList.add("hidden");
        loadingOverlay?.classList.remove("hidden");
        loadingOverlay?.setAttribute("aria-hidden", "false");
    }

    function showResult(lines = []) {
        if (!textareaEl) return;

        textareaEl.value = (lines || []).join("\n");

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

    async function processar() {
        if (cnpjs.length === 0) {
        showWarning(true, "Adicione pelo menos um CNPJ antes de executar.");
        return;
        }

        showWarning(false);

        if (!window.api?.baixarAtoCnpj) {
        console.error("[baixarAtoCnpj] window.api.baixarAtoCnpj não existe (preload não expôs?)");
        showWarning(true, "Erro interno: API não disponível no preload.");
        return;
        }

        cancelRequested = false;
        const currentToken = ++runToken;

        try {
        setProcessing(true);
        showLoading("Iniciando...");

        const result = await window.api.baixarAtoCnpj([...cnpjs]);

        if (cancelRequested || currentToken !== runToken) return;

        if (result?.status === "sucesso") {
            const docs = Array.isArray(result?.docs) ? result.docs : [];

            if (docs.length > 0) {
            showResult(docs);
            } else {
            showLoading(result?.mensagem || "Nenhum documento retornado.");
            }
        } else {
            showLoading(result?.mensagem || "Erro ao processar.");
        }
        } catch (err) {
        if (!cancelRequested && currentToken === runToken) {
            console.error("[baixarAtoCnpj] erro:", err);
            showLoading(`Erro inesperado: ${err?.message || err}`);
        }
        } finally {
        setProcessing(false);
        }
    }

    function initBaixarAtoCnpj() {
        // reset ao abrir tela
        cnpjs = [];
        cancelRequested = false;

        btnAdicionarCnpj = document.getElementById("add-cnpj-btn");
        btnProcessar = document.getElementById("btnProcessar");

        inputCnpj = document.getElementById("cnpj-input");
        listContainer = document.getElementById("cnpj-list");
        warningEl = document.getElementById("cnpj-warning");

        // modal
        loadingOverlay = document.getElementById("loading-overlay");
        loadingBox = document.getElementById("baixar-ato-cnpj-loading");
        resultBox = document.getElementById("baixar-ato-cnpj-result");
        msgEl = document.getElementById("scraper-progress-message");

        textareaEl = document.getElementById("baixar-ato-cnpj-textarea");
        btnCancelarModal = document.getElementById("cancelar-coleta-btn");
        btnCopiar = document.getElementById("copy-docs-btn");
        btnFechar = document.getElementById("close-result-btn");

        console.log("[baixarAtoCnpj] init", {
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

        btnProcessar.onclick = processar;

        btnCancelarModal?.addEventListener("click", async () => {
        if (cancelRequested) return;
        cancelRequested = true;

        if (btnCancelarModal) btnCancelarModal.textContent = "Cancelado";
        hideModal();

        // Aqui sim vale abortar de verdade
        try { await window.api.cancelBaixarAtoCnpj?.(); } catch {}
        });

        btnCopiar?.addEventListener("click", async () => {
        const ok = await copyAllToClipboard(textareaEl?.value || "");
        if (!btnCopiar) return;

        if (ok) {
            const old = btnCopiar.textContent;
            btnCopiar.textContent = "Copiado!";
            setTimeout(() => (btnCopiar.textContent = old || "Copiar todos"), 1200);
        } else {
            alert("Não foi possível copiar para a área de transferência.");
        }
        });

        btnFechar?.addEventListener("click", hideModal);

        showWarning(false);
        renderCnpjList();
        setProcessing(false);
    }

    window.initBaixarAtoCnpj = initBaixarAtoCnpj;
})();
