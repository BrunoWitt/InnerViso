//src_expo8.js
function initExpo8() {
    console.log("[expo8] iniciado");

    const btnAdicionar = document.getElementById("add-code-btn");
    const btnAdicionarSaida = document.getElementById("choose-folder-btn")
    const btnParser = document.getElementById("run-parser-btn")
    const btnAbrirPasta = document.getElementById("open-folder-btn")
    const btnCopiarPasta = document.getElementById("copy-path-btn")
    const lblCode = document.getElementById("code-input");
    const lblSaida = document.getElementById("output-path-input")
    const listContainer = document.getElementById("codes-list");
    const loadingOverlay = document.getElementById("loading-overlay");
    const btnCancelar = document.getElementById("cancel-parser-btn");
    const nomeSaidaInput = document.getElementById("output-name-input");
    const limparNomeBtn = document.getElementById("clear-output-name-btn");

    let cancelRequested = false;

    // lista global (caso queira usar fora)
    window.listCodes = [];
    console.log(listCodes)

    // Função que re-renderiza a lista no HTML
    function renderList() {
        listContainer.innerHTML = ""; // limpa tudo

        window.listCodes.forEach((code, index) => {
            // cria o item
            const item = document.createElement("div");
            item.className = "codes-list-item";

            // texto com o código
            const span = document.createElement("span");
            span.textContent = code;

            // botão remover
            const btnRemove = document.createElement("button");
            btnRemove.className = "secondary";
            btnRemove.textContent = "Remover";

            btnRemove.addEventListener("click", () => {
                window.listCodes.splice(index, 1); // remove da lista
                renderList(); // atualiza visualmente
            });

            // montar item
            item.appendChild(span);
            item.appendChild(btnRemove);

            // adicionar ao container
            listContainer.appendChild(item);
            console.log(listCodes)
        });
    }

    function sanitizeFileStem(s) {
        return (s || "")
            .trim()
            .replace(/[\\/:*?"<>|]/g, "-") // inválidos no Windows
            .replace(/\s+/g, " ")
            .slice(0, 60);
        }

        limparNomeBtn?.addEventListener("click", () => {
        if (!nomeSaidaInput) return;
        nomeSaidaInput.value = "";
        nomeSaidaInput.focus();
    });

    // ===== PROGRESS (polling) =====
let progressTimer = null;

// cria (se não existir) os elementos de UI do progresso dentro do overlay
    function ensureProgressUI() {
        const box = loadingOverlay?.querySelector(".loading-box");
        if (!box) return {};

        return {
            msgEl: box.querySelector("#expo8-progress-message"),
            countEl: box.querySelector("#expo8-progress-count"),
            barFill: box.querySelector("#expo8-progress-fill"),
            barWrap: box.querySelector("#expo8-progress-wrap"),
        };
    }

    function renderProgress(p) {
        const { msgEl, countEl, barFill, barWrap } = ensureProgressUI();

        const message = p?.message || "Processando...";
        const current = Number(p?.current ?? 0);
        const total = Number(p?.total ?? 0);

        if (msgEl) msgEl.textContent = message;
        if (countEl) countEl.textContent = total > 0 ? `${current} / ${total}` : "0 / 0";

        if (barFill && barWrap) {
            const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
            barFill.style.width = `${pct}%`;
            barWrap.style.display = total > 0 ? "block" : "none";
        }
    }

    async function tickProgress() {
    try {
        const p = await window.api.getExpo8Progress();
        // p = { ok, message, current, total }
        renderProgress(p);
    } catch (e) {
        renderProgress({ message: "Processando...", current: 0, total: 0 });
    }
    }

    function startProgressPolling() {
    if (progressTimer) return;
    tickProgress(); // já atualiza uma vez na largada
    progressTimer = setInterval(tickProgress, 500);
    }

    function stopProgressPolling() {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
    }

    function setLoading(isLoading) {
        if (isLoading) loadingOverlay.classList.remove("hidden");
        else loadingOverlay.classList.add("hidden");

        btnAdicionar.disabled = isLoading;
        btnAdicionarSaida.disabled = isLoading;
        btnParser.disabled = isLoading;
        lblCode.disabled = isLoading;

        // botão cancelar
        if (btnCancelar) {
        btnCancelar.disabled = !isLoading;
        btnCancelar.textContent = cancelRequested ? "Cancelando..." : "Cancelar";
        }
    }

    function mostrarResultado({ status, mensagem, log }, pastaSaida) {
    const modal = document.createElement("div");
    modal.className = "resultado-modal";

    const ok = String(status).toLowerCase() === "sucesso";
    const titulo = ok ? "Sucesso" : "Erro";
    const icon = ok ? "✓" : "!";

    const msgFinal =
        (mensagem && String(mensagem).trim()) ||
        (ok
        ? "Todos os arquivos EXPO8 foram gerados com sucesso!"
        : "Ocorreu um erro no processamento.");

    const safeLog = (log && String(log)) || "(sem log disponível)";

    modal.innerHTML = `
        <div class="resultado-box">
        <div class="resultado-header ${ok ? "resultado-header--sucesso" : "resultado-header--erro"}">
            <div class="resultado-icon">${icon}</div>
            <h2>${titulo}</h2>
            <p class="resultado-msg">${msgFinal}</p>
        </div>

        <div class="resultado-body">
            <div class="resultado-actions">
                <button id="abrir-pasta-modal" class="primary">Abrir pasta</button>
                <button id="toggle-log-modal" class="primary" aria-expanded="false">Exibir log</button>
                <button id="fechar-modal" class="primary">Fechar</button>
            </div>


            <div id="log-area" class="log-collapsible hidden">
            <h3>Log do processo</h3>
            <pre class="log-box">${safeLog}</pre>
            </div>
        </div>
        </div>
    `;

    document.body.appendChild(modal);

    const btnFechar = modal.querySelector("#fechar-modal");
    const btnAbrirPasta = modal.querySelector("#abrir-pasta-modal");
    const btnToggleLog = modal.querySelector("#toggle-log-modal");
    const logArea = modal.querySelector("#log-area");

    btnFechar.onclick = () => modal.remove();

    btnToggleLog.onclick = () => {
        const isHidden = logArea.classList.contains("hidden");
        logArea.classList.toggle("hidden");
        btnToggleLog.textContent = isHidden ? "Ocultar log" : "Exibir log";
        btnToggleLog.setAttribute("aria-expanded", isHidden ? "true" : "false");
    };

    btnAbrirPasta.onclick = async () => {
        const pasta = (pastaSaida || "").trim();
        if (!pasta) return alert("Nenhuma pasta de saída disponível para abrir.");

        try {
            const r = await window.api.openFolder(pasta);

            // Só trate como erro se vier "status === false" OU vier um "error" preenchido
            const isErro = (r && r.status === false) || (r && r.error);

            if (isErro) {
            alert(`Não consegui abrir a pasta:\n${pasta}\n\nDetalhe: ${r?.error || "erro desconhecido"}`);
            }
        } catch (e) {
            alert(`Falha ao abrir pasta:\n${pasta}`);
        }
    };
    }



    if (btnCancelar) {
        btnCancelar.addEventListener("click", async () => {
        if (cancelRequested) return;
        cancelRequested = true;
        btnCancelar.disabled = true;
        btnCancelar.textContent = "Cancelando...";

        try {
            await window.api.cancelExpo8(); // <- novo
            stopProgressPolling()
        } catch (e) {
            console.warn("Falha ao solicitar cancelamento:", e);
        }
        });
    }


    // Adicionar novo código
    btnAdicionar.addEventListener("click", () => {
        renderList()
        const codeAtual = lblCode.value
        
        if (!codeAtual) return;

        const regex = /[,\s]+/;

        let listTemporaria = codeAtual
            .split(regex)
            .map(s => s.trim())
            .filter(s => s.length > 0)

        window.listCodes.push(...listTemporaria);

        lblCode.value = ""; // limpa input
        renderList();       // atualiza lista
        console.log(window.listCodes)
    });

    //Adicionar saída
    btnAdicionarSaida.addEventListener("click", async () => {
        const caminho = await window.api.selectFolder(false);

        if (caminho) {
            lblSaida.value = caminho;
            console.log("Pasta selecionada:", caminho);
        } else {
            console.log("Nenhuma pasta selecionada");
        }
    });

    //Abrir pasta
    let openingFolder = false;
    btnAbrirPasta.addEventListener("click", async () => {
    if (openingFolder) return;

    const pasta_saida = (lblSaida?.value || "").trim();

    if (!pasta_saida || /nenhum selecionado/i.test(pasta_saida)) {
        alert("Selecione uma pasta de saída antes de abrir");
        return;
    }

    if (!window.api?.openFolder) {
        console.warn("API openFolder indisponível");
        alert("Não foi possível abrir a pasta. API indisponível");
        return;
    }

    openingFolder = true;

    try {
        const r = await window.api.openFolder(pasta_saida);

        // aceita retorno em formatos diferentes (string ou objeto)
        const isErro =
        (typeof r === "string" && r.trim().length > 0) || // se vier string, string != "" é erro
        (r && r.status === false) ||
        (r && typeof r.error === "string" && r.error.trim().length > 0);

        if (isErro) {
        const detalhe = typeof r === "string" ? r : (r?.error || "erro desconhecido");
        console.error("Falha ao abrir pasta:", detalhe);
        alert(`Não consegui abrir a pasta:\n${pasta_saida}\n\nDetalhe: ${detalhe}`);
        }
    } finally {
        openingFolder = false;
    }
    });

    // Rodar parser
    btnParser.addEventListener("click", async () => {
        let nomeSaida = sanitizeFileStem(nomeSaidaInput?.value || "");
        const pathOut = lblSaida.value;

    if (!window.listCodes.length) {
        alert("Adicione pelo menos um código.");
        return;
    }

    if (!pathOut) {
        alert("Selecione uma pasta de saída.");
        return;
    }

    cancelRequested = false;
    setLoading(true);
    renderProgress({ message: "Iniciando...", current: 0, total: window.listCodes.length });
    startProgressPolling();

    try {
        if (nomeSaida.trim() === "") {
            nomeSaida = "expo8"
        }
    
    const result = await window.api.parserExpo8(window.listCodes, pathOut, nomeSaida);
    mostrarResultado(result, pathOut);
    } catch (err) {
    mostrarResultado({
        status: "erro",
        mensagem: err?.message || "Erro inesperado.",
        log: err?.stack || String(err),
    },
    pathOut
    );
    } finally {
    stopProgressPolling();
    cancelRequested = false;
    setLoading(false);
    }
    });

    const btnAjuda = document.getElementById("btnAjuda");
    const modal = document.getElementById("helpVideoModal");
    const btnFechar2 = document.getElementById("btnFecharAjuda");
    const iframe = document.getElementById("helpVideoIframe");

    // Coloque aqui o link embed do seu vídeo
    const VIDEO_EMBED_URL = "../assets/vids/Expo-8-Parser.mp4";

    function abrirAjuda() {
        iframe.src = VIDEO_EMBED_URL;
        modal.style.display = "flex";
    }

    function fecharAjuda() {
        modal.style.display = "none";
        iframe.src = ""; // para o vídeo parar
    }

    btnAjuda?.addEventListener("click", abrirAjuda);
    btnFechar2?.addEventListener("click", fecharAjuda);

    // Clicar fora fecha
    modal?.addEventListener("click", (e) => {
        if (e.target === modal) fecharAjuda();
    });

    // ESC fecha
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.style.display !== "none") fecharAjuda();
    });

}

window.initExpo8 = initExpo8;
