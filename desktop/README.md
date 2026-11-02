# Mariáh Noivas — Aplicativo Windows

Programa de Windows feito com Electron. Ele usa as mesmas telas do sistema web (`../frontend`). As regras de negócio rodam num servidor local (`server/app.js`) que só aceita conexões do próprio computador (127.0.0.1).

## Onde ficam os dados no Windows
- Banco de dados e fotos: `%APPDATA%\Mariah Noivas\dados\` (`dados.json`, `dados.json.bak`, `fotos\`)
- Backups automáticos e de segurança: `Documentos\Mariah Noivas - Backups\`
- A desinstalação não apaga nenhuma dessas pastas.

## Gerar o instalador
```bash
cd desktop
yarn install
yarn web    # gera o frontend e copia para desktop/web
yarn dist   # gera dist/MariahNoivas-Setup-<versão>.exe
```
Em Linux ARM64, sem Wine: `apt install nsis` e crie `/opt/nsis-custom` (veja `memory/SPEC.md`).

## Testar o servidor local sem o Electron
`yarn server` sobe em http://127.0.0.1:3100 com os dados em `.test-data/`.
