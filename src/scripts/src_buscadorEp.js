    // src/scripts/src_buscadorEp.js
    function initBuscadorEp() {
    // Botões
    const btnSelectBase = document.getElementById("btnSelecionarBase");
    const btnSelectSearch = document.getElementById("btnSelecionarBusca");
    const btnRunSearch = document.getElementById("btnExecutarBusca");
    const btnSelectOutPath = document.getElementById("btnSelecionarSaida");
    const btnCancelRun = document.getElementById("epCancelBtn");
    const btnLimparBase = document.getElementById("btnLimparBase");
    const btnLimparBusca = document.getElementById("btnLimparBusca");
    const btnLimparTudo = document.getElementById("btnLimparTudo");
    const btnResOpenPath = document.getElementById("epResultOpenPath");

    // ReqId / cancel
    let currentReqId = null;
    let lastResultPath = null;

    // Elementos preview
    const previewBaseEl = document.getElementById("previewBase");
    const previewBuscaEl = document.getElementById("previewBusca");

    // Inputs
    const inputBasePath = document.getElementById("inputBasePath");
    const inputBuscaPath = document.getElementById("inputBuscaPath");
    const inputOutPath = document.getElementById("inputSaidaPath");
    // Configurações (NOVO)
    const inputCnpjSheetName = document.getElementById("inputCnpjSheetName");
    const inputBertWeight = document.getElementById("inputBertWeight");


    // ===== Modal Resultado + Log =====
    const resultModal = document.getElementById("epResultModal");
    const elResIcon = document.getElementById("epResultIcon");
    const elResTitle = document.getElementById("epResultTitle");
    const elResSubtitle = document.getElementById("epResultSubtitle");
    const elResPath = document.getElementById("epResultPath");
    const elResLog = document.getElementById("epResultLog");
    const btnResClose = document.getElementById("epResultClose");
    const btnResCloseX = document.getElementById("epResultCloseX");
    const btnResCopy = document.getElementById("epResultCopyLog");

    let runLog = [];
    let _lastProgressMsg = null;

    function _ts() {
        const d = new Date();
        return d.toLocaleTimeString("pt-BR", { hour12: false });
    }

    function _pushLog(kind, msg, extra) {
        const line = `[${_ts()}] ${kind}: ${msg}${extra ? ` ${extra}` : ""}`;
        runLog.push(line);
        if (runLog.length > 1200) runLog = runLog.slice(-1200);
    }

    function _setResultModal(kind /* success|error|cancel */, title, subtitle, pathText, logText) {
        if (!resultModal) return;

        resultModal.classList.remove("ep-modal--success", "ep-modal--error", "ep-modal--cancel");
        resultModal.classList.add(
        kind === "success" ? "ep-modal--success" : kind === "cancel" ? "ep-modal--cancel" : "ep-modal--error"
        );

        if (elResIcon) elResIcon.textContent = kind === "success" ? "✓" : kind === "cancel" ? "!" : "✕";
        if (elResTitle) elResTitle.textContent = title || "Resultado";
        if (elResSubtitle) elResSubtitle.textContent = subtitle || "";
        if (elResPath) elResPath.textContent = pathText || "—";
        if (elResLog) elResLog.textContent = logText || "";

        lastResultPath = pathText && pathText !== "—" ? pathText : null;

        if (elResPath) elResPath.textContent = pathText || "—";
        if (elResLog) elResLog.textContent = logText || "";

        // opcional: desabilita o botão se não tiver path
        if (btnResOpenPath) btnResOpenPath.disabled = !lastResultPath;

    }

    function showResultModal() {
        if (!resultModal) return;
        resultModal.classList.remove("ep-hidden");
    }

    function hideResultModal() {
        if (!resultModal) return;
        resultModal.classList.add("ep-hidden");
    }

    btnResClose?.addEventListener("click", hideResultModal);
    btnResCloseX?.addEventListener("click", hideResultModal);

    // fecha clicando fora
    resultModal?.addEventListener("click", (e) => {
        if (e.target === resultModal) hideResultModal();
    });

    // ESC fecha
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && resultModal && !resultModal.classList.contains("ep-hidden")) hideResultModal();
    });

    btnResCopy?.addEventListener("click", async () => {
        try {
        await navigator.clipboard.writeText(elResLog?.textContent || "");
        if (btnResCopy) {
            btnResCopy.textContent = "Copiado!";
            setTimeout(() => (btnResCopy.textContent = "Copiar log"), 900);
        }
        } catch (err) {
        console.error(err);
        if (btnResCopy) {
            btnResCopy.textContent = "Falhou";
            setTimeout(() => (btnResCopy.textContent = "Copiar log"), 900);
        }
        }
    });

    btnResOpenPath?.addEventListener("click", async () => {
        if (!lastResultPath) return;

        try {
            const resp = await window.api.openPath(lastResultPath);
            if (!resp?.ok) {
            const msg = resp?.error || "Não foi possível abrir o caminho.";
            _pushLog("ERROR", `Abrir caminho falhou: ${msg}`);
            _setResultModal("error", "Erro ao abrir caminho", msg, lastResultPath, runLog.join("\n"));
            showResultModal();
            }
        } catch (e) {
            const msg = e?.message || String(e);
            _pushLog("ERROR", `Abrir caminho falhou: ${msg}`);
            _setResultModal("error", "Erro ao abrir caminho", msg, lastResultPath, runLog.join("\n"));
            showResultModal();
        }
    });

    // ===== Seleção de arquivos/pasta =====
    async function handleSelectFile(tipo) {
        btnSelectBase.disabled = true;
        btnSelectSearch.disabled = true;
        btnSelectOutPath.disabled = true;

        try {
        if (tipo === "base") {
            const file = await window.api.selectBaseFile();
            if (file) {
            inputBasePath.value = file;
            const pv = await window.api.previewXlsx(file, { maxRows: 100 });
            if (pv?.ok) renderPreview(previewBaseEl, pv.data);
            else clearPreview(previewBaseEl);
            }
        } else if (tipo === "search") {
            const file = await window.api.selectSearchFile();
            if (file) {
            inputBuscaPath.value = file;
            const pv = await window.api.previewXlsx(file, { maxRows: 100 });
            if (pv?.ok) renderPreview(previewBuscaEl, pv.data);
            else clearPreview(previewBuscaEl);
            }
        } else if (tipo === "out") {
            const pathOut = await window.api.selectPathOutFolder();
            if (pathOut) inputOutPath.value = pathOut;
        }
        } finally {
        btnSelectBase.disabled = false;
        btnSelectSearch.disabled = false;
        btnSelectOutPath.disabled = false;
        }
    }

    // ===== Preview XLSX =====
    function _emptyPreviewHtml() {
        return `
        <div class="ep-empty">
            <div class="ep-empty__title">Nenhum arquivo carregado</div>
            <div class="ep-empty__subtitle">
            Selecione uma planilha para visualizar as primeiras linhas.
            </div>
        </div>
        `;
    }

    function _escapeHtml(s) {
        return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function renderPreview(containerEl, preview) {
        if (!containerEl) return;

        const { header, rows, sheet } = preview || {};
        const safeHeader = Array.isArray(header) ? header : [];
        const safeRows = Array.isArray(rows) ? rows : [];

        const thead = safeHeader
        .map((h) => `<th title="${_escapeHtml(h)}">${_escapeHtml(h)}</th>`)
        .join("");

        const tbody = safeRows
        .map((r) => {
            const rr = Array.isArray(r) ? r : [];
            return `<tr>${rr
            .map((c) => `<td><span class="ep-cell">${_escapeHtml(c)}</span></td>`)
            .join("")}</tr>`;
        })
        .join("");

        containerEl.innerHTML = `
        <div class="ep-preview__meta">
            <div class="ep-preview__metaLeft">
            Aba: <b>${_escapeHtml(sheet)}</b>
            </div>
            <div class="ep-preview__metaRight">
            Mostrando <b>${safeRows.length}</b> linha(s) • <b>${safeHeader.length}</b> coluna(s)
            </div>
        </div>

        <div class="ep-table-wrap">
            <table class="ep-table">
            <thead><tr>${thead}</tr></thead>
            <tbody>${tbody}</tbody>
            </table>
        </div>
        `;
    }

    function clearPreview(containerEl) {
        if (!containerEl) return;
        containerEl.innerHTML = _emptyPreviewHtml();
    }

    // ===== Eventos seleção =====
    btnSelectBase.addEventListener("click", () => handleSelectFile("base"));
    btnSelectSearch.addEventListener("click", () => handleSelectFile("search"));
    btnSelectOutPath.addEventListener("click", () => handleSelectFile("out"));

    // ===== Ações limpar =====
    btnLimparBase.addEventListener("click", () => {
        inputBasePath.value = "";
        clearPreview(previewBaseEl);
    });

    btnLimparBusca.addEventListener("click", () => {
        inputBuscaPath.value = "";
        clearPreview(previewBuscaEl);
    });

    btnLimparTudo.addEventListener("click", () => {
        inputBasePath.value = "";
        inputBuscaPath.value = "";
        inputOutPath.value = "";
        clearPreview(previewBaseEl);
        clearPreview(previewBuscaEl);
    });

    // ===== Execução =====
    btnRunSearch.addEventListener("click", async () => {
        const basePath = inputBasePath.value.trim();
        const searchPath = inputBuscaPath.value.trim();
        const outDir = inputOutPath.value.trim();
        const cnpjSheetNameRaw = (inputCnpjSheetName?.value || "").trim();
        const bertWeightRaw = inputBertWeight?.value;

        if (!basePath || !searchPath) {
        _setResultModal(
            "error",
            "Campos obrigatórios",
            "Selecione a planilha BASE e a planilha de BUSCA antes de executar.",
            "—",
            `[${_ts()}] ERROR: Base/Busca não selecionadas.`
        );
        showResultModal();
        return;
        }

        // overlay
        const overlay = document.getElementById("epLoadingOverlay");
        const elMsg = document.getElementById("epLoadingMsg");
        const elBar = document.getElementById("epLoadingBar");
        const elPct = document.getElementById("epLoadingPct");
        const elReq = document.getElementById("epLoadingReq");

        const showLoading = (reqId) => {
        if (elMsg) elMsg.textContent = "Iniciando…";
        if (elBar) elBar.style.width = "0%";
        if (elPct) elPct.textContent = "0%";
        if (elReq) elReq.textContent = reqId ? `req_id: ${reqId}` : "";
        overlay?.classList.remove("ep-hidden");
        _pushLog("INFO", "Overlay aberto", reqId ? `(req_id=${reqId})` : "");
        };

        const hideLoading = () => {
        overlay?.classList.add("ep-hidden");
        _pushLog("INFO", "Overlay fechado");
        };

        const setProgress = (msg, pct) => {
        const p = Math.max(0, Math.min(100, Number(pct ?? 0)));
        if (elMsg) elMsg.textContent = msg || "Processando…";
        if (elBar) elBar.style.width = `${p}%`;
        if (elPct) elPct.textContent = `${Math.round(p)}%`;

        if (msg && msg !== _lastProgressMsg) {
            _lastProgressMsg = msg;
            _pushLog("PROGRESS", msg, `(pct=${Math.round(p)}%)`);
        }
        };

        btnRunSearch.disabled = true;
        btnSelectBase.disabled = true;
        btnSelectSearch.disabled = true;
        btnSelectOutPath.disabled = true;

        // zera log da rodada
        runLog = [];
        _lastProgressMsg = null;
        _pushLog("INFO", "Iniciando processamento");
        _pushLog("INFO", `Base: ${basePath}`);
        _pushLog("INFO", `Busca: ${searchPath}`);
        _pushLog("INFO", `Saída: ${outDir || "(Downloads)"}`);

        let bertWeight = Number.parseFloat(String(bertWeightRaw ?? "0.5"));
        if (!Number.isFinite(bertWeight)) bertWeight = 0.5;
        bertWeight = Math.max(0, Math.min(1, bertWeight));

        const cnpjSheetName = cnpjSheetNameRaw ? cnpjSheetNameRaw : null;

        _pushLog("INFO", `BERT weight: ${bertWeight}`);
        _pushLog("INFO", `CNPJ sheet: ${cnpjSheetName || "(primeira aba)"}`);

        try {
        // 1) START
        const start = await window.api.buscadorEpStart({
            basePath,
            searchPath,
            bert_weight: bertWeight,
            cnpj_sheet_name: cnpjSheetName,
        });

        currentReqId = start?.req_id;
        _pushLog("INFO", "Processo iniciado", currentReqId ? `(req_id=${currentReqId})` : "");
        showLoading(currentReqId);

        // 2) PROGRESS polling
        const pollMs = 700;
        let done = false;

        while (!done) {
            const pr = await window.api.buscadorEpProgress(currentReqId);

            if (!pr?.ok) {
            setProgress("Aguardando inicialização…", 0);
            } else {
            const data = pr.data || {};
            const status = data.status;
            setProgress(data.message, data.percent);

            if (status === "error") {
                const err = data.error || "Falha no processamento.";
                _pushLog("ERROR", err);
                throw new Error(err);
            }

            if (status === "canceled") {
                done = true;
                setProgress("⛔ Cancelado pelo usuário.", data.percent ?? 0);
                _pushLog("CANCEL", "Cancelado pelo usuário");
                break;
            }

            if (status === "done") {
                done = true;
                setProgress("Baixando resultado…", 100);
                _pushLog("INFO", "Backend concluiu (done). Preparando download…");
                break;
            }
            }

            await new Promise((r) => setTimeout(r, pollMs));
        }

        // Verifica cancelamento final
        const prFinal = await window.api.buscadorEpProgress(currentReqId);
        if (prFinal?.ok && prFinal?.data?.status === "canceled") {
            hideLoading();
            _setResultModal(
            "cancel",
            "Cancelado",
            "O processo foi cancelado pelo usuário.",
            "—",
            runLog.join("\n")
            );
            showResultModal();
            return;
        }

        // 3) DOWNLOAD
        const result = await window.api.buscadorEpDownload(currentReqId, outDir);

        hideLoading();

        if (result?.saved) {
            _pushLog("DONE", "Arquivo salvo", result.filePath);
            _setResultModal(
            "success",
            "Concluído",
            "Processamento finalizado e arquivo salvo com sucesso.",
            result.filePath,
            runLog.join("\n")
            );
            showResultModal();
        } else {
            _pushLog("WARN", "Concluiu, mas não foi possível salvar o arquivo.");
            _setResultModal(
            "error",
            "Concluiu com aviso",
            "Processo concluiu, mas não foi possível salvar o arquivo.",
            "—",
            runLog.join("\n")
            );
            showResultModal();
        }
        } catch (e) {
        console.error(e);
        hideLoading();

        const errMsg = e?.message || String(e);
        _pushLog("ERROR", errMsg);

        _setResultModal("error", "Erro no processamento", errMsg, "—", runLog.join("\n"));
        showResultModal();
        } finally {
        btnRunSearch.disabled = false;
        btnSelectBase.disabled = false;
        btnSelectSearch.disabled = false;
        btnSelectOutPath.disabled = false;
        }
    });

    // ===== Cancelar =====
    btnCancelRun.addEventListener("click", async () => {
        if (!currentReqId) return;

        try {
        _pushLog("INFO", "Solicitando cancelamento…", `(req_id=${currentReqId})`);
        await window.api.buscadorEpCancel(currentReqId);
        } catch (e) {
        console.error(e);
        const errMsg = e?.message || String(e);
        _pushLog("ERROR", `Falha ao cancelar: ${errMsg}`);
        _setResultModal("error", "Erro ao cancelar", errMsg, "—", runLog.join("\n"));
        showResultModal();
        }
    });

    // ===== AJUDA (VÍDEO) =====
    const btnAjuda = document.getElementById("btnAjuda");
    const modal = document.getElementById("helpVideoModal");
    const btnFechar2 = document.getElementById("btnFecharAjuda");
    const video = document.getElementById("helpVideoPlayer");

    // Coloque aqui o caminho do mp4 (relative ao HTML)
    const VIDEO_URL = "../assets/vids/Buscador-EP.mp4";

    function abrirAjuda() {
    if (!modal || !video) return;

    video.src = VIDEO_URL;      // <-- video, não iframe
    video.load();
    modal.style.display = "flex";
    video.play().catch(() => {}); // autoplay pode ser bloqueado, ok
    }

    function fecharAjuda() {
    if (!modal || !video) return;

    modal.style.display = "none";
    video.pause();
    video.currentTime = 0;
    video.removeAttribute("src");
    video.load();
    }

btnAjuda?.addEventListener("click", abrirAjuda);
btnFechar2?.addEventListener("click", fecharAjuda);

// Clicar fora fecha
modal?.addEventListener("click", (e) => {
  if (e.target === modal) fecharAjuda();
});

// ESC fecha
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal && modal.style.display !== "none") fecharAjuda();
});


}

    window.initBuscadorEp = initBuscadorEp;
