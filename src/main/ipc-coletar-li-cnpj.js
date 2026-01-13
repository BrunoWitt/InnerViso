// src/main/ipc-coletar-li-cnpj.js
const { ipcMain } = require("electron");
const axios = require("axios");

function registerColetarLiCnpj() {
    const running = new Map();

    // ============================
    // CANCELAR COLETA (LI CNPJ)
    // ============================
    ipcMain.handle("cancelar-coletar-li-cnpj", async (event) => {
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
    // COLETAR LI POR CNPJ (PERÍODO)
    // ============================
    ipcMain.handle("coletar-li-cnpj", async (event, payload = {}) => {
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
            lis: [],
            mensagem: "Nenhum CNPJ válido informado (precisa ter 14 dígitos).",
            };
        }

        if (!String(initialDate).trim() || !String(endDate).trim()) {
            return {
            status: "erro",
            lis: [],
            mensagem: "Informe data inicial e data final.",
            };
        }

        const url = "http://10.0.0.230:2026/li/collect/period/cnpj";

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

        // Normaliza retorno (pode vir objeto, ou [obj, 200])
        const rawData = resp?.data;

        let data = rawData ?? {};
        let httpStatus = resp?.status;

        if (Array.isArray(rawData)) {
            data = rawData[0] ?? {};
            if (typeof rawData[1] === "number") httpStatus = rawData[1];
        }

        // ────────────────────────────────
        // Normaliza responses (array/string)
        // ────────────────────────────────
        let responses = data?.responses;

        if (typeof responses === "string") {
            try {
            responses = JSON.parse(responses);
            } catch {
            // segue, tentaremos regex depois
            }
        }

        // ────────────────────────────────
        // Extrai LIs (robusto)
        // ────────────────────────────────
        let lis = [];

        // Caso 1: responses array
        if (Array.isArray(responses)) {
            lis = responses
            .map((r) => r?.response)
            .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
            .filter((v) => v.length > 0);
        }

        // Caso 2: responses string “estranha”
        if (!lis.length && typeof responses === "string") {
            const matches = responses.match(/\b\d{6,20}\b/g); // LI pode variar, então deixa mais flexível
            lis = Array.from(new Set(matches || []));
        }

        // Remove duplicados por segurança
        lis = Array.from(new Set(lis));

        return {
            status: "sucesso",
            lis,
            mensagem: lis.length
            ? `Foram coletadas ${lis.length} LIs:\n\n${lis.join(", ")}`
            : "Nenhuma LI encontrada para os filtros informados.",
            raw: data,
            httpStatus,
        };
        } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
            return {
            status: "erro",
            lis: [],
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
            lis: [],
            mensagem: `Erro ao coletar LIs por CNPJ: ${backendMsg}`,
        };
        } finally {
        running.delete(event.sender.id);
        }
    });
}

module.exports = { registerColetarLiCnpj };
