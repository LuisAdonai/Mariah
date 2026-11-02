// Build helper for Linux/ARM hosts without Wine:
// electron-builder normally runs the NSIS stub under Wine to extract the uninstaller.
// Its pure-JS UninstallerReader does the same job, so we enable it on every non-Windows host.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "node_modules", "app-builder-lib", "out", "targets", "nsis", "NsisTarget.js");
const src = fs.readFileSync(file, "utf8");
const needle = "if ((0, macosVersion_1.isMacOsCatalina)()) {";
if (src.includes(needle)) {
  fs.writeFileSync(file, src.replace(needle, "if ((0, macosVersion_1.isMacOsCatalina)() || process.platform !== \"win32\") {"));
  console.log("patched NsisTarget.js (UninstallerReader without Wine)");
} else {
  console.log("NsisTarget.js already patched");
}

// NSIS 3.08 stubs (Debian's native makensis) carry an extra '.idata'/'.reloc' section.
const utilFile = path.join(__dirname, "..", "node_modules", "app-builder-lib", "out", "targets", "nsis", "nsisUtil.js");
const util = fs.readFileSync(utilFile, "utf8");
if (!util.includes('case ".ndata":')) {
  fs.writeFileSync(utilFile, util.replace('case ".rsrc": {', 'case ".rsrc":\n                case ".idata":\n                case ".reloc":\n                case ".ndata": {'));
  console.log("patched nsisUtil.js (.idata/.reloc sections)");
}
