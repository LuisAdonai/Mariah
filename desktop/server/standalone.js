// Run the desktop backend without Electron (used for automated testing on Linux).
const path = require("path");
const { startServer } = require("./app");

const root = path.join(__dirname, "..");
const dataDir = process.env.DATA_DIR || path.join(root, ".test-data");
startServer(
  {
    dataDir,
    backupsDir: process.env.BACKUPS_DIR || path.join(dataDir, "..", ".test-backups"),
    staticDir: path.join(root, "web"),
    seedFile: path.join(root, "dados-iniciais.json"),
  },
  Number(process.env.PORT || 3100),
).then(({ port }) => console.log(`Mariah Noivas local server on http://127.0.0.1:${port}`));
