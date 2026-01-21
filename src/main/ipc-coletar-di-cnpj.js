// src/main/ipc-coletar-di-cnpj.js
const { ipcMain } = require("electron");
const axios = require("axios");

function registerColedarDiCnpj() {
    const running = new Map();

    // ============================
    // CANCELAR COLETA (CNPJ)
    // ============================
    ipcMain.handle("cancelar-coletar-di-cnpj", async (event) => {
        const run = running.get(event.sender.id);
        if (!run) return { ok: false };

        try {
        if (run.controller) run.controller.abort();
        return { ok: true };
        } finally {
        running.delete(event.sender.id);
        }
    });

    // ============================
    // COLETAR DI POR CNPJ (PERÍODO)
    // ============================
    ipcMain.handle("coletar-di-cnpj", async (event, payload = {}) => {
        const controller = new AbortController();
        running.set(event.sender.id, { controller });

        try {
        const cnpjs = Array.isArray(payload?.cnpjs) ? payload.cnpjs : [];
        const initialDate = payload?.initialDate ?? "";
        const endDate = payload?.endDate ?? "";

        const cleanCnpjs = cnpjs
            .map((c) => String(c || "").replace(/\D+/g, ""))
            .filter((c) => c.length === 14);

        if (cleanCnpjs.length === 0) {
            return {
            status: "erro",
            dis: [],
            mensagem: "Nenhum CNPJ válido informado (precisa ter 14 dígitos).",
            };
        }

        if (!String(initialDate).trim() || !String(endDate).trim()) {
            return {
            status: "erro",
            dis: [],
            mensagem: "Informe data inicial e data final.",
            };
        }

        const url = "http://10.0.0.230:1071/di/collect/period/cnpj";

        const headers = {
            cnpj: cleanCnpjs.join(","),
            // ⚠️ backend usa "intialDate" (typo mesmo)
            intialDate: String(initialDate),
            endDate: String(endDate),
        };

        const resp = await axios.get(url, {
            timeout: 0,
            signal: controller.signal,
            headers,
        });

        const rawData = resp?.data;

        let data = rawData ?? {};
        let httpStatus = resp?.status;

        if (Array.isArray(rawData)) {
            data = rawData[0] ?? {};
            // se o wrapper manda [obj, 200], usa isso também
            if (typeof rawData[1] === "number") httpStatus = rawData[1];
        }

        // Debug opcional (ajuda MUITO)
        console.log("[ipc-coletar-di-cnpj] resp.status:", resp?.status, "httpStatus(normalizado):", httpStatus);
        console.log("[ipc-coletar-di-cnpj] rawData:", rawData);
        console.log("[ipc-coletar-di-cnpj] data(normalizado):", data);

        // ────────────────────────────────
        // Normaliza responses (pode vir array ou string)
        // ────────────────────────────────
        let responses = data?.responses;

        if (typeof responses === "string") {
            try {
            responses = JSON.parse(responses);
            } catch {
            // se não for JSON, vamos tentar regex depois
            }
        }

        // ────────────────────────────────
        // Extrai DIs (robusto)
        // ────────────────────────────────
        let dis = [];

        // Caso 1: responses array
        if (Array.isArray(responses)) {
            dis = responses
            .map((r) => r?.response)
            .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
            .filter((v) => v.length > 0);
        }

        // Caso 2: responses string (formato estranho)
        if (!dis.length && typeof responses === "string") {
            const matches = responses.match(/\b\d{8,12}\b/g);
            dis = Array.from(new Set(matches || []));
        }

        // Remove duplicados por segurança
        dis = Array.from(new Set(dis));

        return {
            status: "sucesso",
            dis,
            mensagem: dis.length
            ? `Foram coletadas ${dis.length} DIs:\n\n${dis.join(", ")}`
            : "Nenhuma DI encontrada para os filtros informados.",
            raw: data,       // agora SEMPRE é o objeto correto
            httpStatus,      // ajuda debug também
        };
        } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
            return {
            status: "erro",
            dis: [],
            mensagem: "Coleta cancelada pelo usuário.",
            };
        }

        const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data ||
            err?.message ||
            String(err);

        return {
            status: "erro",
            dis: [],
            mensagem: `Erro ao coletar DIs por CNPJ: ${backendMsg}`,
        };
        } finally {
        running.delete(event.sender.id);
        }
    });
}

module.exports = { registerColedarDiCnpj };
