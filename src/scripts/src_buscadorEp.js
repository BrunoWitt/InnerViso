//src/scripts/src_buscadorEp.js
function initBuscadorEp() {
    //Botões
    const btnSelectBase = document.getElementById('btnSelecionarBase');
    const btnSelectSearch = document.getElementById('btnSelecionarBusca');
    const btnRunSearch = document.getElementById('btnExecutarBusca');
    const btnSelectOutPath = document.getElementById('btnSelecionarSaida');

    //Inputs
    const inputBasePath = document.getElementById('inputBasePath');
    const inputBuscaPath = document.getElementById('inputBuscaPath');
    const inputOutPath = document.getElementById('inputSaidaPath');

    //Funções
    async function handleSelectFile(tipo) {
        btnSelectBase.disabled = true;
        btnSelectSearch.disabled = true;
        btnSelectOutPath.disabled = true;

        if (tipo == 'base') {
            const file = await window.api.selectBaseFile();
            if (file) document.getElementById('inputBasePath').value = file;
        } else if (tipo == 'search') {
            const file = await window.api.selectSearchFile();
            if (file) document.getElementById('inputBuscaPath').value = file;
        } else if( tipo == 'out') {
            const pathOut = await window.api.selectPathOutFolder();
            if (pathOut) document.getElementById('inputSaidaPath').value = pathOut;
        }
        btnSelectBase.disabled = false;
        btnSelectSearch.disabled = false;
        btnSelectOutPath.disabled = false;
    }

    //Eventos
    btnSelectBase.addEventListener('click', () => handleSelectFile('base'));
    btnSelectSearch.addEventListener('click', () => handleSelectFile('search'));
    btnSelectOutPath.addEventListener('click', () => handleSelectFile('out'));

    btnRunSearch.addEventListener('click', async () => {
        const basePath = inputBasePath.value.trim();
        const searchPath = inputBuscaPath.value.trim();

    if (!basePath || !searchPath) {
        alert("Selecione a planilha BASE e a planilha de BUSCA antes de executar.");
        return;
    }

    btnRunSearch.disabled = true;
    btnSelectBase.disabled = true;
    btnSelectSearch.disabled = true;

    try {
      // se você tiver inputs de parâmetros, pegue daqui. Por enquanto fixo:
        const result = await window.api.buscadorEpRun({
            basePath,
            searchPath,
            bert_weight: 0.5,
            cnpj_sheet_name: null,
        }, inputOutPath.value.trim());

        if (result?.saved) {
            alert(`Resultado salvo em:\n${result.filePath}`);
        } else {
            alert("Execução concluída, mas você cancelou o salvamento do arquivo.");
        }
    } catch (e) {
        console.error(e);
        alert(e?.message || String(e));
    } finally {
        btnRunSearch.disabled = false;
        btnSelectBase.disabled = false;
        btnSelectSearch.disabled = false;
    }
    });
}

window.initBuscadorEp = initBuscadorEp;