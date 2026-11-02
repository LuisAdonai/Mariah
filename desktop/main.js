// Electron shell: starts the local backend on 127.0.0.1 (never exposed to the network)
// and opens the existing React interface in a native Windows window.
const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { startServer } = require("./server/app");

app.setAppUserModelId("br.com.mariahnoivas.locacao");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  let ctx = null;

  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  const dataDir = () => path.join(app.getPath("userData"), "dados");
  // Backups live in Documentos — outside the install folder, so uninstalling never deletes them.
  const backupsDir = () => path.join(app.getPath("documents"), "Mariah Noivas - Backups");

  function todaysAutoBackupExists() {
    const d = backupsDir();
    const today = new Date().toISOString().slice(0, 10);
    return fs.existsSync(d) && fs.readdirSync(d).some((n) => n.startsWith(`auto-mariah-backup-${today}`));
  }

  async function createWindow() {
    ctx = await startServer({
      dataDir: dataDir(),
      backupsDir: backupsDir(),
      staticDir: path.join(__dirname, "web"),
      seedFile: path.join(__dirname, "dados-iniciais.json"),
    });

    if (!todaysAutoBackupExists()) ctx.writeBackupFile("auto");

    win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      title: "Mariáh Noivas — Trajes a Rigor",
      icon: path.join(__dirname, "assets", "icon.png"),
      backgroundColor: "#FAF7F2",
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.once("ready-to-show", () => {
      win.maximize();
      win.show();
    });

    // WhatsApp and any external link open in the default browser / WhatsApp Desktop.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url) && !url.startsWith(`http://127.0.0.1:${ctx.port}`)) {
        shell.openExternal(url);
        return { action: "deny" };
      }
      return { action: "allow" };
    });

    // Backup downloads: let the user choose the destination (pendrive, HD externo...).
    win.webContents.session.on("will-download", (_e, item) => {
      const target = dialog.showSaveDialogSync(win, {
        title: "Salvar backup",
        defaultPath: path.join(app.getPath("documents"), item.getFilename()),
        filters: [{ name: "Backup Mariáh Noivas", extensions: ["json"] }],
      });
      if (target) item.setSavePath(target);
      else item.cancel();
      item.once("done", (_ev, state) => {
        if (state === "completed") {
          dialog.showMessageBox(win, { type: "info", title: "Backup", message: "Backup salvo com sucesso.", detail: target });
        }
      });
    });

    win.loadURL(`http://127.0.0.1:${ctx.port}/`);
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Arquivo",
        submenu: [
          { label: "Abrir pasta de backups", click: () => { fs.mkdirSync(backupsDir(), { recursive: true }); shell.openPath(backupsDir()); } },
          { type: "separator" },
          { label: "Sair", role: "quit" },
        ],
      },
      {
        label: "Exibir",
        submenu: [
          { label: "Recarregar", role: "reload" },
          { label: "Tela cheia", role: "togglefullscreen" },
          { label: "Aumentar zoom", role: "zoomIn" },
          { label: "Diminuir zoom", role: "zoomOut" },
          { label: "Zoom normal", role: "resetZoom" },
        ],
      },
    ]),
  );

  app.whenReady().then(() =>
    createWindow().catch((e) => {
      dialog.showErrorBox("Mariáh Noivas", `Não foi possível iniciar o sistema.\n\n${e.stack || e}`);
      app.quit();
    }),
  );

  // Safety copy on every close.
  app.on("before-quit", () => {
    try {
      if (ctx) ctx.writeBackupFile("auto");
    } catch (e) {
      console.error(e);
    }
  });

  app.on("window-all-closed", () => {
    if (ctx) ctx.server.close();
    app.quit();
  });
}
