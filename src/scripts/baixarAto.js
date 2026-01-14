// src/scripts/baixarAto.js
(() => {
    if (window.__baixarAtoLoaded) return;
    window.__baixarAtoLoaded = true;

    console.log("[baixarAto.js] carregado ✅", new Date().toISOString());

    let outputDir = "";
    let csvPath = "";
    let cancelRequested = false;
    let runToken = 0;

  // paginação
    let offset = 0;
    const PAGE_SIZE = 500;
    let hasMore = false;

  // DOM
    let inputAto;
    let btnClearAto;
    let warningEl;

    let outputPathEl;
    let btnChooseOutput;
    let btnOpenOutput;
    let btnOpenOutputModal;
    let btnShowAll;

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
    let btnLoadMore;
    let resultTitleEl;

    function onlyDigits(v) {
        return String(v || "").replace(/\D+/g, "");
    }

    function normalizeAto(raw) {
        const d = onlyDigits(raw);
        return d.length >= 8 ? d : "";
    }

    function showWarning(show, message) {
        if (!warningEl) return;
        if (message) warningEl.textContent = message;
        warningEl.classList.toggle("is-hidden", !show);
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

    async function copyToClipboard(text) {
        const t = String(text || "");
        if (!t.trim()) return false;
        try {
        await navigator.clipboard.writeText(t);
        return true;
        } catch {
        return false;
        }
    }

    function updateOpenButtonsState() {
        if (btnOpenOutput) btnOpenOutput.disabled = !outputDir;
    }

    async function escolherPasta() {
        if (!window.api?.selectBaixarAtoOutputDir) {
        showWarning(true, "Erro interno: seletor de pasta não disponível.");
        return;
        }

        const res = await window.api.selectBaixarAtoOutputDir();
        if (!res?.ok || !res?.path) return;

        outputDir = res.path;
        if (outputPathEl) outputPathEl.value = outputDir;

        showWarning(false);
        updateOpenButtonsState();
    }

    async function openOutputFolder() {
        if (!outputDir) return;
        try {
        await window.api?.openPathAto?.(outputDir);
        } catch {}
    }

    function appendLinesToTextarea(newLines) {
        const current = textareaEl?.value || "";
        const add = (newLines || []).join("\n");
        textareaEl.value = current ? (current + "\n" + add) : add;
    }

    function setLoadMoreEnabled(enabled) {
        if (!btnLoadMore) return;
        btnLoadMore.disabled = !enabled;
        btnLoadMore.textContent = enabled ? "Carregar mais" : "Sem mais";
    }

    async function carregarMais() {
        if (!csvPath) return;
        if (!window.api?.baixarAtoGetPage) return;

        btnLoadMore.disabled = true;
        btnLoadMore.textContent = "Carregando...";

        try {
        const res = await window.api.baixarAtoGetPage(csvPath, offset, PAGE_SIZE);
        if (!res?.ok) {
            setLoadMoreEnabled(false);
            return;
        }

        const codes = Array.isArray(res?.codes) ? res.codes : [];
        hasMore = !!res?.hasMore;

        if (codes.length) {
            appendLinesToTextarea(codes);
            offset += codes.length;
        }

        setLoadMoreEnabled(hasMore);
        if (resultTitleEl) {
            resultTitleEl.textContent = `Códigos (1ª coluna do CSV) — exibindo ${offset}${hasMore ? "+" : ""}`;
        }
        } finally {
        if (hasMore) setLoadMoreEnabled(true);
        else setLoadMoreEnabled(false);
        }
    }

    function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

        async function exibirTodos() {
        if (!csvPath) return;
        if (!window.api?.baixarAtoGetPage) return;

        // evita clicar várias vezes
        if (btnShowAll) {
            btnShowAll.disabled = true;
            btnShowAll.textContent = "Carregando...";
        }
        if (btnLoadMore) btnLoadMore.disabled = true;

        // lote maior pra ir mais rápido (sem exagerar)
        const BATCH = 2000;

        try {
            while (true) {
            const res = await window.api.baixarAtoGetPage(csvPath, offset, BATCH);
            if (!res?.ok) break;

            const codes = Array.isArray(res?.codes) ? res.codes : [];
            hasMore = !!res?.hasMore;

            if (codes.length) {
                appendLinesToTextarea(codes);
                offset += codes.length;

                if (resultTitleEl) {
                resultTitleEl.textContent =
                    `Códigos (1ª coluna do CSV) — exibindo ${offset}${hasMore ? "+" : ""}`;
                }
            }

            // sem mais páginas
            if (!hasMore) break;

            // yield pra UI não travar
            await sleep(0);
            }

            // finaliza
            setLoadMoreEnabled(false);

            if (btnShowAll) {
            btnShowAll.textContent = "Exibidos";
            btnShowAll.disabled = true;
            }
        } catch (e) {
            console.error("[baixarAto] exibirTodos erro:", e);
            if (btnShowAll) {
            btnShowAll.textContent = "Exibir todos";
            btnShowAll.disabled = false;
            }
            // mantém carregar mais disponível se ainda tiver
            setLoadMoreEnabled(hasMore);
        }
        }

    async function processar() {
        const numAto = normalizeAto(inputAto?.value || "");

        btnShowAll?.addEventListener("click", exibirTodos);

        btnShowAll?.addEventListener("click", exibirTodos);

        if (!numAto) {
        showWarning(true, "Informe um número de Ato válido.");
        return;
        }
        if (!outputDir) {
        showWarning(true, "Selecione a pasta de saída antes de executar.");
        return;
        }

        if (!window.api?.baixarAto) {
        console.error("[baixarAto] window.api.baixarAto não existe (preload não expôs?)");
        showWarning(true, "Erro interno: API não disponível no preload.");
        return;
        }

        cancelRequested = false;
        const currentToken = ++runToken;

        // reset paginação
        csvPath = "";
        offset = 0;
        hasMore = false;
        if (textareaEl) textareaEl.value = "";
        setLoadMoreEnabled(false);

    try {
        setProcessing(true);
        showLoading("Iniciando...");

        const result = await window.api.baixarAto(numAto, outputDir);

        if (cancelRequested || currentToken !== runToken) return;

        if (result?.status === "sucesso") {
            const preview = Array.isArray(result?.preview) ? result.preview : [];
            hasMore = !!result?.hasMore;
            csvPath = String(result?.csvPath || "");

            offset = preview.length;

            showResult(preview);

            setLoadMoreEnabled(hasMore);

            if (resultTitleEl) {
            resultTitleEl.textContent = `Códigos (1ª coluna do CSV) — exibindo ${offset}${hasMore ? "+" : ""}`;
            }
        } else {
            showLoading(result?.mensagem || "Erro ao processar.");
        }
        } catch (err) {
        if (!cancelRequested && currentToken === runToken) {
            console.error("[baixarAto] erro:", err);
            showLoading(`Erro inesperado: ${err?.message || err}`);
        }
        } finally {
        setProcessing(false);
        }
    }

    function initBaixarAto() {
        cancelRequested = false;

        btnShowAll = document.getElementById("show-all-btn");
        inputAto = document.getElementById("ato-input");
        btnClearAto = document.getElementById("btnClearAto");
        warningEl = document.getElementById("ato-warning");

        outputPathEl = document.getElementById("output-path");
        btnChooseOutput = document.getElementById("choose-output-btn");
        btnOpenOutput = document.getElementById("open-output-btn");

        btnProcessar = document.getElementById("btnProcessar");

        // modal
        loadingOverlay = document.getElementById("loading-overlay");
        loadingBox = document.getElementById("baixar-ato-loading");
        resultBox = document.getElementById("baixar-ato-result");
        msgEl = document.getElementById("scraper-progress-message");

        textareaEl = document.getElementById("baixar-ato-textarea");
        btnCancelar = document.getElementById("cancelar-btn");
        btnCopiar = document.getElementById("copy-btn");
        btnFechar = document.getElementById("close-result-btn");
        btnLoadMore = document.getElementById("load-more-btn");
        btnOpenOutputModal = document.getElementById("open-output-btn-modal");
        resultTitleEl = document.getElementById("result-title");

        // reset UI
        if (outputPathEl) outputPathEl.value = outputDir || "";
        showWarning(false);
        updateOpenButtonsState();
        setProcessing(false);
        setLoadMoreEnabled(false);

        btnChooseOutput?.addEventListener("click", escolherPasta);
        btnOpenOutput?.addEventListener("click", openOutputFolder);
        btnOpenOutputModal?.addEventListener("click", openOutputFolder);

        btnProcessar?.addEventListener("click", processar);

        btnClearAto?.addEventListener("click", () => {
            if (inputAto) inputAto.value = "";
            showWarning(false);
        });

        inputAto?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                processar();
            }
        });

        // progresso do main
        window.api?.onBaixarAtoProgress?.((payload) => {
            if (!payload?.message) return;
            if (msgEl) msgEl.textContent = payload.message;
            });

            btnCancelar?.addEventListener("click", async () => {
            if (cancelRequested) return;
            cancelRequested = true;

            hideModal();
            try { await window.api?.cancelBaixarAto?.(); } catch {}
            });

            btnCopiar?.addEventListener("click", async () => {
            const ok = await copyToClipboard(textareaEl?.value || "");
            if (!btnCopiar) return;

            if (ok) {
                const old = btnCopiar.textContent;
                btnCopiar.textContent = "Copiado!";
                setTimeout(() => (btnCopiar.textContent = old || "Copiar (visíveis)"), 1200);
            } else {
                alert("Não foi possível copiar para a área de transferência.");
            }
            });

            btnLoadMore?.addEventListener("click", carregarMais);
            btnShowAll?.addEventListener("click", exibirTodos);
            btnFechar?.addEventListener("click", hideModal);
        }

    window.initBaixarAto = initBaixarAto;
})();
