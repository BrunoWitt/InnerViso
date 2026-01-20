// src/main/ipc-coletar-li.js
const { ipcMain } = require("electron");
const axios = require("axios");

function registerColetarLiIpc() {
    const running = new Map();

    // ============================
    // CANCELAR COLETA (LI)
    // ============================
    ipcMain.handle("cancelar-coletar-li", async (event) => {
        const run = running.get(event.sender.id);
        if (!run) return { ok: false };

        if (run.controller) run.controller.abort();
        return { ok: true };
    });

    // ============================
    // COLETAR LI (HOJE)
    // ============================
    ipcMain.handle("coletar-li", async (event) => {
        const controller = new AbortController();
        running.set(event.sender.id, { controller });

        try {
        // 🔴 URL REAL DO BACKEND
        const url = "http://10.0.0.230:1071/li/collect/today";

        const resp = await axios.get(url, {
            timeout: 0,
            signal: controller.signal,
        });

        const data = resp?.data ?? {};

        // ✅ Extrai SOMENTE responses[].response válidos (mesma lógica do DI)
        const lis = Array.isArray(data.responses)
            ? data.responses
                .map((r) => r?.response)
                .filter((v) => typeof v === "string" && v.trim().length > 0)
            : [];

        return {
            status: "sucesso",
            lis,
            mensagem: lis.length
            ? `Foram coletadas ${lis.length} LIs:\n\n${lis.join(", ")}`
            : "Nenhuma LI encontrada.",
        };
        } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
            return { status: "erro", mensagem: "Coleta cancelada pelo usuário." };
        }

        return {
            status: "erro",
            mensagem: `Erro ao coletar LIs: ${err?.message || err}`,
        };
        } finally {
        running.delete(event.sender.id);
        }
    });
}

module.exports = { registerColetarLiIpc };
