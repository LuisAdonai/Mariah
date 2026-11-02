// electron-builder afterPack hook: embeds the app icon + Windows version info into the .exe
// using resedit (pure JavaScript — no Wine needed when building on Linux).
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const ResEdit = await import("resedit");
  const { NtExecutable, NtExecutableResource, Data, Resource } = ResEdit;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const exe = NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = NtExecutableResource.from(exe);

  const iconFile = Data.IconFile.from(fs.readFileSync(path.join(__dirname, "..", "assets", "icon.ico")));
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries, 1, 1033, iconFile.icons.map((i) => i.data),
  );

  const version = context.packager.appInfo.version;
  const [maj, min, pat] = version.split(".").map(Number);
  const vi = Resource.VersionInfo.fromEntries(res.entries)[0] || Resource.VersionInfo.createEmpty();
  vi.setFileVersion(maj, min, pat, 0, 1033);
  vi.setProductVersion(maj, min, pat, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: "Mariáh Noivas — Sistema de Locação",
    ProductName: "Mariáh Noivas",
    CompanyName: "Mariáh Noivas",
    LegalCopyright: "Mariáh Noivas",
    OriginalFilename: exeName,
    InternalName: "MariahNoivas",
    FileVersion: version,
    ProductVersion: version,
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • ícone e versão aplicados em ${exeName}`);
};
