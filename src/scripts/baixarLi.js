function initBaixarLi() {
  const btnAdd = document.getElementById("add-code-btn");
  const btnChoose = document.getElementById("choose-folder-btn");
  const btnRun = document.getElementById("run-parser-btn");
  const btnOpen = document.getElementById("open-folder-btn");
  const btnCancel = document.getElementById("cancel-parser-btn");

  const inputCode = document.getElementById("code-input");
  const inputPath = document.getElementById("output-path-input");
  const listContainer = document.getElementById("codes-list");
  const loading = document.getElementById("loading-overlay");

  window.listLis = [];

  function render() {
    listContainer.innerHTML = "";
    window.listLis.forEach((li, i) => {
      const div = document.createElement("div");
      div.className = "codes-list-item";

      div.innerHTML = `
        <span>${li}</span>
        <button class="secondary">Remover</button>
      `;

      div.querySelector("button").onclick = () => {
        window.listLis.splice(i, 1);
        render();
      };

      listContainer.appendChild(div);
    });
  }

  btnAdd.onclick = () => {
    const values = inputCode.value
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    window.listLis.push(...values);
    inputCode.value = "";
    render();
  };

  btnChoose.onclick = async () => {
    const path = await window.api.selectFolder(false);
    if (path) inputPath.value = path;
  };

  btnOpen.onclick = async () => {
    if (!inputPath.value) {
      alert("Selecione uma pasta.");
      return;
    }
    await window.api.openFolder(inputPath.value);
  };

  btnCancel.onclick = async () => {
    await window.api.cancelBaixarLi();
  };

  btnRun.onclick = async () => {
    if (!window.listLis.length) {
      alert("Adicione pelo menos uma LI.");
      return;
    }

    loading.classList.remove("hidden");

    try {
      const r = await window.api.baixarLi(
        window.listLis,
        inputPath.value
      );

      alert(r?.mensagem || "Processo finalizado.");
    } finally {
      loading.classList.add("hidden");
    }
  };
}

window.initBaixarLi = initBaixarLi;