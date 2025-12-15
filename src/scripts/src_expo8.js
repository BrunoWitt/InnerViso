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

    let cancelRequested = false;

    // lista global (caso queira usar fora)
    window.listCodes = ['25BR0006635014',];
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

    function mostrarResultado({ status, mensagem, log }) {
        const modal = document.createElement("div");
        modal.className = "resultado-modal";

        const ok = String(status).toLowerCase() === "sucesso";

        modal.innerHTML = `
            <div class="resultado-box">
            <h2>${ok ? "Sucesso" : "Erro"}</h2>
            <p style="margin: 6px 0 14px;"><b>${mensagem}</b></p>

            <h3>Log do processo:</h3>
            <pre class="log-box">${log || "(sem log disponível)"}</pre>

            <button id="fechar-modal">Fechar</button>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById("fechar-modal").onclick = () => modal.remove();
    }

    if (btnCancelar) {
        btnCancelar.addEventListener("click", async () => {
        if (cancelRequested) return;
        cancelRequested = true;
        btnCancelar.disabled = true;
        btnCancelar.textContent = "Cancelando...";

        try {
            await window.api.cancelExpo8(); // <- novo
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
        console.log(listCodes)
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
        if (openingFolder)  return;

        const pasta_saida = (lblSaida?.value || "").trim();

        if (!pasta_saida || /nenhum selecionado/i.test(pasta_saida)) {
            alert("Selecione uma pasta de saída nates de abrir");
            return;
        }

        if (!window.api?.openFolder) {
            console.warn("API openFolder indisponivel");
            alert("Não foi possivel abrir a pasta. API indisponível");
            return;
        }
''
        openingFolder = true;

        try{
            const r = await window.api.openFolder(pasta_saida);
            if (!r?.status) {
            console.error("Falha ao abrir pasta:", r?.error);
            alert(`Não consegui abrir a pasta:\n${pasta_saida}\n\nDetalhe: ${r?.error || 'erro desconhecido'}`);
        }
        } finally {
        openingFolder = false;
        }
    });

    // Rodar parser
    btnParser.addEventListener("click", async () => {
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

    try {

        const result = await window.api.parserExpo8(window.listCodes, pathOut);
        // result = { status, message, log }

        mostrarResultado(result)

    } catch (err) {
    mostrarResultado({
        status: "erro",
        mensagem: err?.message || "Erro inesperado.",
        log: err?.stack || String(err),
    });
    } finally {
    cancelRequested = false;
    setLoading(false);
    }
    });

}

window.initExpo8 = initExpo8;
