function initDownloadRe() {
    const $ = (id) => document.getElementById(id);

    const btnEnt = $("btnSelectEntrada");
    const btnSai = $("btnSelectSaida");

    const lblEnt = $("entradaLabel");
    const lblSai = $("saidaLabel");

    const btnLimparEnt = $("btnLimparEntrada");
    const btnLimparSai = $("btnLimparSaida");

    const btnLimparTudo = $("btnLimparTudo");
    const btnExecutar = $("btnExecutar");
    const btnAbrirSaida = $("btnAbrirSaida");

    const inpNomeSaida = $("nomeSaida");
    const btnLimparNome = $("btnLimparNome");

    const statusLabel = $("statusLabel");
    const statusDot = $("statusDot");

    const overlay = $("loadingOverlay");
    const loadingText = $("loadingText");
    const btnCancelar = $("btnCancelar");

    // Se a view ainda não terminou de renderizar, evita crash silencioso
    if (!btnExecutar || !lblEnt || !lblSai) {
        console.warn("[downloadRe] elementos não encontrados na view. init abortado.");
        return;
    }

    function setStatus(text, kind = "idle") {
        if (statusLabel) statusLabel.textContent = text;
        const colors = {
        idle: "#94a3b8",
        running: "#2563eb",
        ok: "#16a34a",
        error: "#dc2626",
        };
        if (statusDot) statusDot.style.background = colors[kind] || colors.idle;
    }

    function sanitizeFileStem(s) {
        return (s || "")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .slice(0, 80);
    }

    function isEmptyPath(v) {
        return !v || !String(v).trim();
    }

    function showOverlay(msg) {
        if (loadingText) loadingText.textContent = msg || "Processando...";
        if (overlay) overlay.style.display = "flex";
    }

    function hideOverlay() {
        if (overlay) overlay.style.display = "none";
    }

    // binds
    btnEnt?.addEventListener("click", async () => {
        const p = await window.api.reSelectFolder?.("in");
        if (p) lblEnt.value = p;
    });

    btnSai?.addEventListener("click", async () => {
        const p = await window.api.reSelectFolder?.("out");
        if (p) lblSai.value = p;
    });

    btnLimparEnt?.addEventListener("click", () => (lblEnt.value = ""));
    btnLimparSai?.addEventListener("click", () => (lblSai.value = ""));

    btnLimparNome?.addEventListener("click", () => {
        if (!inpNomeSaida) return;
        inpNomeSaida.value = "";
        inpNomeSaida.focus();
    });

    btnLimparTudo?.addEventListener("click", () => {
        lblEnt.value = "";
        lblSai.value = "";
        if (inpNomeSaida) inpNomeSaida.value = "";
        setStatus("Aguardando...", "idle");
    });

    btnAbrirSaida?.addEventListener("click", async () => {
        const outDir = (lblSai.value || "").trim();
        if (isEmptyPath(outDir)) {
        alert("Selecione uma pasta de saída primeiro.");
        return;
        }
        const r = await window.api.openFolder?.(outDir);
        if (r?.ok === false) alert(`Não consegui abrir a pasta.\n${r?.error || ""}`);
    });

    btnCancelar?.addEventListener("click", () => {
        hideOverlay();
        setStatus("Aguardando...", "idle");
        btnExecutar.disabled = false;
    });

    btnExecutar?.addEventListener("click", async () => {
        const pathin = (lblEnt.value || "").trim();
        const pathout = (lblSai.value || "").trim();
        const nomeSaida = sanitizeFileStem(inpNomeSaida?.value || "");

        if (isEmptyPath(pathin)) {
        alert("Selecione a pasta de entrada (onde estão os Excel).");
        return;
        }
        if (isEmptyPath(pathout)) {
        alert("Selecione a pasta de saída (onde será salvo o Excel).");
        return;
        }

        btnExecutar.disabled = true;
        setStatus("Executando...", "running");
        showOverlay("Enviando requisição para o backend...");

        try {
        const resp = await window.api.reRun?.({
            pathin,
            pathout,
            nomeSaida: nomeSaida || null,
        });

        hideOverlay();

        const msg =
            typeof resp === "string"
            ? resp
            : (resp?.message || resp?.status || resp?.mensagem || "Concluído");

        setStatus(`✅ Concluído: ${msg}`, "ok");
        alert(`Concluído!\n\n${msg}`);
        } catch (err) {
        hideOverlay();
        console.error(err);
        setStatus("❌ Erro na execução.", "error");
        alert(`Erro ao executar:\n${err?.message || err}`);
        } finally {
        btnExecutar.disabled = false;
        }
    });

    setStatus("Aguardando...", "idle");

    // ===== AJUDA (VÍDEO) =====
    const btnAjuda = $("btnAjuda");
    const helpModal = $("helpVideoModal");
    const btnFecharAjuda = $("btnFecharAjuda");
    const helpVideo = $("helpVideo");
    const helpVideoSource = $("helpVideoSource");

    // Caminho RELATIVO (coloque o mp4 em src/assets/vids e referencie assim)
    const VIDEO_URL = "../assets/vids/";

    function abrirAjuda() {
    if (!helpModal || !helpVideo || !helpVideoSource) return;

    helpVideoSource.src = VIDEO_URL;
    helpVideo.load();                 // garante que pega o novo src
    helpModal.style.display = "flex";

    // tenta dar play (alguns ambientes bloqueiam autoplay com som)
    helpVideo.play?.().catch(() => {});
    }

    function fecharAjuda() {
    if (!helpModal || !helpVideo || !helpVideoSource) return;

    helpModal.style.display = "none";
    helpVideo.pause?.();
    try { helpVideo.currentTime = 0; } catch {}
    helpVideoSource.src = "";
    helpVideo.load();
    }

    btnAjuda?.addEventListener("click", abrirAjuda);
    btnFecharAjuda?.addEventListener("click", fecharAjuda);

    // clicar fora fecha
    helpModal?.addEventListener("click", (e) => {
    if (e.target === helpModal) fecharAjuda();
    });

    // ESC fecha
    document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && helpModal?.style.display !== "none") fecharAjuda();
    });


}

window.initDownloadRe = initDownloadRe;
