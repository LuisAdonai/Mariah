// Local, permanent JSON database with crash-safe writes.
// Every save: write temp file -> fsync -> keep previous copy as .bak -> atomic rename.
const fs = require("fs");
const path = require("path");

const EMPTY = () => ({ trajes: [], fichas: [], counters: { ficha: 0 } });

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, "dados.json");
    this.bak = this.file + ".bak";
    this.fotosDir = path.join(dir, "fotos");
    fs.mkdirSync(this.fotosDir, { recursive: true });
    this.data = this.load();
  }

  exists() {
    return fs.existsSync(this.file) || fs.existsSync(this.bak);
  }

  load() {
    for (const f of [this.file, this.bak]) {
      try {
        if (fs.existsSync(f)) {
          const d = JSON.parse(fs.readFileSync(f, "utf8"));
          return { ...EMPTY(), ...d, counters: { ficha: 0, ...(d.counters || {}) } };
        }
      } catch (e) {
        console.error(`Falha ao ler ${f}:`, e.message);
      }
    }
    return EMPTY();
  }

  save() {
    const tmp = this.file + ".tmp";
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeSync(fd, JSON.stringify(this.data));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.bak);
    fs.renameSync(tmp, this.file);
  }

  replaceAll(data) {
    this.data = { ...EMPTY(), ...data };
    this.save();
  }
}

module.exports = { Store };
