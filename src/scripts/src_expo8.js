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

    function setLoading(isLoading) {
        if (isLoading) {
            loadingOverlay.classList.remove("hidden");
        } else {
            loadingOverlay.classList.add("hidden")
        }

        btnAdicionar.disabled = isLoading;
        btnAdicionarSaida.disabled = isLoading;
        btnParser.disabled = isLoading;
        lblCode.disabled = isLoading;
    }

    function mostrarResultado(resultado, log) {
        const modal = document.createElement("div");
        modal.className = "resultado-modal";

        const titulo =
            resultado.SUCESSO ||
            resultado.ERRO ||
            resultado.message ||
            "Resultado do processamento";

        modal.innerHTML = `
            <div class="resultado-box">
            <h2>${titulo}</h2>

            <h3>Log do processo:</h3>
            <pre class="log-box">${log || "(sem log disponível)"}</pre>

            <button id="fechar-modal">Fechar</button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById("fechar-modal").onclick = () => modal.remove();
    }

    // Adicionar novo código
    btnAdicionar.addEventListener("click", () => {
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
            if (!r?.ok) {
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

    try {
        setLoading(true);

        const result = await window.api.parserExpo8(window.listCodes, pathOut);
        // result = { ok, message, log }

        mostrarResultado(
        result.ok
            ? { SUCESSO: result.message }
            : { ERRO: result.message },
        result.log
        );

    } catch (err) {
        mostrarResultado(
        { ERRO: err.message },
        err.stack || "Erro inesperado."
        );
    } finally {
        setLoading(false);
    }
    });



}

window.initExpo8 = initExpo8;
