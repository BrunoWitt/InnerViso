// main/modelo7.js
const { ipcMain } = require("electron");
const { spawn, execFile } = require("child_process");
const fs = require("fs");

const MODELO7_PATH = String.raw`G:\Público\APP Viso Modelo 7\VisoModelo7.exe`;

function waitForMainWindowHandle(pid, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const intervalMs = opts.intervalMs ?? 250;

  const start = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      // Se passar do tempo, não trava o usuário: libera mesmo assim
      if (Date.now() - start >= timeoutMs) {
        resolve({ ok: true, mainWindowHandle: null, warn: "timeout" });
        return;
      }

      // PowerShell: pega o MainWindowHandle quando a janela existir
      const cmd = `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).MainWindowHandle`;

      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", cmd],
        { windowsHide: true },
        (err, stdout) => {
          const raw = String(stdout || "").trim();
          const handle = Number(raw);

          // handle > 0 geralmente indica que a janela principal já existe
          if (!err && Number.isFinite(handle) && handle > 0) {
            resolve({ ok: true, mainWindowHandle: handle, warn: null });
            return;
          }

          // Continua tentando
          setTimeout(tick, intervalMs);
        }
      );
    };

    tick();
  });
}

function registerModelo7Ipc() {
  ipcMain.handle("modelo7:run", async (_event, args = []) => {
    if (!fs.existsSync(MODELO7_PATH)) {
      return {
        ok: false,
        pid: null,
        code: null,
        out: "",
        err: `Executável não encontrado em: ${MODELO7_PATH}`,
      };
    }

    return await new Promise((resolve) => {
      let resolved = false;

      const child = spawn(MODELO7_PATH, args, {
        windowsHide: true,
        cwd: undefined,
        env: process.env,
      });

      let out = "";
      let err = "";

      child.stdout?.on("data", (d) => (out += d.toString()));
      child.stderr?.on("data", (d) => (err += d.toString()));

      child.once("error", (e) => {
        if (resolved) return;
        resolved = true;
        resolve({ ok: false, pid: null, code: null, out, err: err + "\n" + e.message });
      });

      child.once("spawn", async () => {
        try {
          const pid = child.pid ?? null;

          // Se por algum motivo não tiver pid, libera logo
          if (!pid) {
            if (resolved) return;
            resolved = true;
            resolve({ ok: true, pid: null, code: null, out, err, started: true, mainWindowHandle: null });
            return;
          }

          const ready = await waitForMainWindowHandle(pid, { timeoutMs: 30000, intervalMs: 250 });

          if (resolved) return;
          resolved = true;

          resolve({
            ok: true,
            pid,
            code: null, // ainda não terminou
            out,
            err,
            started: true,
            mainWindowHandle: ready.mainWindowHandle,
            warn: ready.warn,
          });
        } catch (e) {
          if (resolved) return;
          resolved = true;
          resolve({
            ok: true,
            pid: child.pid ?? null,
            code: null,
            out,
            err: err + "\n" + (e?.message || String(e)),
            started: true,
            mainWindowHandle: null,
            warn: "exception",
          });
        }
      });
    });
  });
}

module.exports = { registerModelo7Ipc };
