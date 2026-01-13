let btnAdicionarCnpj;
let btnProcessar;
let inputCnpj;
let listContainer;
let warningEl;

let dataInicialEl;
let dataFinalEl;

// Modal
let loadingOverlay;
let loadingBox;
let resultBox;
let msgEl;
let textareaEl;
let btnCancelarModal;
let btnCopiar;
let btnFechar;

let cnpjs = []; // 14 dígitos (string)

// Se cancelar for clicado, a gente ignora qualquer retorno do IPC
let cancelRequested = false;
// id da execução para ignorar “retorno atrasado” de execução anterior
let runToken = 0;

function isoToBrDate(iso) {
  // iso esperado: "YYYY-MM-DD"
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

/* =========================
   MODAL HELPERS
========================= */
function showLoading(message) {
    if (msgEl) msgEl.textContent = message || "Processando...";
    loadingBox?.classList.remove("hidden");
    resultBox?.classList.add("hidden");
    loadingOverlay?.classList.remove("hidden");
    loadingOverlay?.setAttribute("aria-hidden", "false");
}

function showResult(dis = []) {
    if (!textareaEl) return;

    textareaEl.value = (dis || []).join("\n");

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

/* =========================
   PROCESSAR
========================= */
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

    if (!window.api?.coletarDiCnpj) {
        console.error("[coletarDiCnpj] window.api.coletarDiCnpj não existe (preload não expôs?)");
        showWarning(true, "Erro interno: API não disponível no preload.");
        return;
    }

    cancelRequested = false;
    const currentToken = ++runToken;

    try {
        setProcessing(true);
        showLoading("Iniciando coleta das DIs...");

        console.log("[coletarDiCnpj] enviando para IPC:", {
        cnpjs: [...cnpjs],
        initialDate,
        endDate,
        });

        const result = await window.api.coletarDiCnpj([...cnpjs], initialDate, endDate);

        // Se cancelou, ou se é retorno de execução antiga, ignora tudo.
        if (cancelRequested || currentToken !== runToken) {
        console.log("[coletarDiCnpj] retorno ignorado (cancelRequested ou token antigo).", { cancelRequested, currentToken, runToken });
        return;
        }

        console.log("[coletarDiCnpj] retorno IPC:", result);

        if (result?.status === "sucesso") {
        const dis = Array.isArray(result?.dis) ? result.dis : [];

        if (dis.length > 0) {
            showResult(dis);
        } else {
            // Mantém modal aberto e mostra mensagem de “nenhuma DI”
            showLoading(result?.mensagem || "Nenhuma DI encontrada para os filtros informados.");
            // Oculta botão cancelar? (opcional) — aqui vamos manter.
        }
        } else {
        showLoading(result?.mensagem || "Erro ao processar.");
        }
    } catch (err) {
        if (!cancelRequested && currentToken === runToken) {
        console.error("[coletarDiCnpj] erro chamando IPC:", err);
        showLoading(`Erro inesperado: ${err?.message || err}`);
        }
    } finally {
        // Se cancelou, a gente já fechou o modal — só resta reativar o botão
        setProcessing(false);
    }
    }

    /* =========================
    INIT
    ========================= */
    function initColetarDiCnpj() {
    btnAdicionarCnpj = document.getElementById("add-cnpj-btn");
    btnProcessar = document.getElementById("btnProcessar");

    inputCnpj = document.getElementById("cnpj-input");
    listContainer = document.getElementById("cnpj-list");
    warningEl = document.getElementById("cnpj-warning");

    dataInicialEl = document.getElementById("dataInicial");
    dataFinalEl = document.getElementById("dataFinal");

    // Modal
    loadingOverlay = document.getElementById("loading-overlay");
    loadingBox = document.getElementById("coletar-di-cnpj-loading");
    resultBox = document.getElementById("coletar-di-cnpj-result");
    msgEl = document.getElementById("scraper-progress-message");

    textareaEl = document.getElementById("coletar-di-cnpj-textarea");
    btnCancelarModal = document.getElementById("cancelar-coleta-btn");
    btnCopiar = document.getElementById("copy-dis-btn");
    btnFechar = document.getElementById("close-result-btn");

    console.log("[coletarDiCnpj] init chamado", {
        btnAdicionarCnpj: !!btnAdicionarCnpj,
        btnProcessar: !!btnProcessar,
        inputCnpj: !!inputCnpj,
        listContainer: !!listContainer,
        warningEl: !!warningEl,
        dataInicialEl: !!dataInicialEl,
        dataFinalEl: !!dataFinalEl,
        loadingOverlay: !!loadingOverlay,
    });

    if (!btnAdicionarCnpj || !btnProcessar || !inputCnpj || !listContainer) return;

    btnAdicionarCnpj.addEventListener("click", addCnpjsFromInput);

    inputCnpj.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
        e.preventDefault();
        addCnpjsFromInput();
        }
    });

    btnProcessar.addEventListener("click", processarColeta);

    // Cancelar no modal (APARÊNCIA: não aborta o backend; apenas ignora retorno)
    btnCancelarModal?.addEventListener("click", async () => {
        if (cancelRequested) return;
        cancelRequested = true;

        if (btnCancelarModal) btnCancelarModal.textContent = "Cancelado";
        hideModal();

        // Opcional: se você quiser TAMBÉM mandar o abort (caso no futuro mude de ideia)
        // try { await window.api.cancelColetarDiCnpj?.(); } catch {}
    });

    // Copiar todas
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

    // Fechar modal resultado
    btnFechar?.addEventListener("click", hideModal);

    showWarning(false);
    renderCnpjList();
    setProcessing(false);
}

window.initColetarDiCnpj = initColetarDiCnpj;
