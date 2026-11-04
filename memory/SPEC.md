# Mariáh Noivas — Sistema de Locação (SPEC)

App para loja de aluguel de trajes de festa (substitui o bloco de 3 vias "Mariáh Noivas — Trajes a Rigor").
UI em pt-BR. Auth: senha única da loja (env STORE_PASSWORD) → cookie httpOnly JWT `mn_session` (30 dias).

## Data model (Mongo)
- `trajes`: id, codigo, nome, categoria, tamanho, cor, valor_locacao, status (disponivel|alugado|prova|lavanderia), foto_url, observacoes
- `fichas`: id, numero (auto; counters{_id:ficha}.ultimo = último emitido; nunca abaixo de 7001 — fichas antigas 6937–6944 mantêm o número), dados cliente (nome, cpf, cep, endereco, numero_end, complemento, bairro, telefone, telefone2), traje_ids[], trajes_descricao, data_saida/data_retorno/data_prova (YYYY-MM-DD strings), medidas{traje,calca,camisa,comp_manga,comp_calca,busto,cintura,observacoes}, total, sinal, forma_pagamento, observacoes, status (reservado|retirado|devolvido|cancelado), pagamentos[{id,valor,forma,data}], created_at. `saldo` = total − sinal − Σpagamentos (computado).

## API (/api, all except /auth/login|logout require cookie)
- POST /auth/login {password}, POST /auth/logout, GET /auth/me
- GET/POST /trajes, PUT/DELETE /trajes/{id}, GET /trajes/ocupados?saida&retorno&exclude
- GET /fichas?q&status, GET/PUT/DELETE /fichas/{id}, POST /fichas (409 if traje already booked in overlapping period; 400 if retorno < saida), PATCH /fichas/{id}/status (retirado→trajes alugado; devolvido→trajes lavanderia), POST /fichas/{id}/pagamentos
- GET /agenda?inicio&fim → eventos (prova/saida/retorno), GET /dashboard (hoje em America/Sao_Paulo)

## Pages
/login, / (painel), /fichas, /fichas/nova, /fichas/:id, /fichas/:id/editar, /agenda, /estoque, /impressao/:id (3 vias A4 paisagem, window.print → PDF).
WhatsApp: botões abrem wa.me com mensagens prontas (prova, retirada, devolução, saldo) — sem envio automático.

## Seed (python seed.py, idempotente)
8 trajes (N-001..N-003, T-101..T-103, D-201, F-301). 3 fichas: Nº 6937 Ana Beatriz Souza (prova hoje, saída +3d), Nº 6938 Carlos Henrique Lima (saída hoje), Nº 6939 Roberto Alves (retirado, retorno ontem → atrasado).

## Fotos locais e backup (web + desktop, mesmo formato)
- POST /api/uploads {data_url} → {url:"/api/uploads/<arquivo>"}; GET /api/uploads/{name}. Estoque envia foto do computador (redimensionada p/ 1400px JPEG).
- GET /api/backup/info, GET /api/backup/export (JSON "mariah-backup" v1: trajes, fichas, counters.ficha, fotos base64 — fotos externas são baixadas e embutidas), POST /api/backup/import (substitui tudo; contador = max(counter, maior Nº − 6936)). Desktop: POST /api/backup/agora.
- Página /backup no menu.

## Aplicativo Windows (/app/desktop)
- Electron 33 + servidor Express local (server/app.js = porta fiel das rotas FastAPI) em 127.0.0.1:porta aleatória, servindo o build do frontend (web/).
- Banco local: %APPDATA%\Mariah Noivas\dados\dados.json (+ .bak, gravação atômica) e fotos\. Backups automáticos (ao abrir 1x/dia e ao fechar, mantém 30) em Documentos\Mariah Noivas - Backups.
- Primeira execução importa dados-iniciais.json (export do ambiente de teste). Senha fixa mariah2026.
- Build (pod ARM64, sem Wine): `cd /app/desktop && yarn web && yarn dist` — usa NSIS nativo (/opt/nsis-custom = /usr/share/nsis + plugins do electron-builder), build/patch-nsis.js (UninstallerReader sem Wine) e build/afterPack.js (ícone via resedit).
- Instalador publicado em frontend/public/downloads/MariahNoivas-Setup-1.0.0.exe.

## v1.1 (nov/2026)
- Numeração nova começa em 7001 (lib/numeracao.py; desktop: counters.ultimo).
- `clientes` (cadastro permanente por CPF, cpf_digits único): atualizado a cada ficha salva com CPF de 11 dígitos. GET /api/clientes/cpf/{cpf} (fallback: última ficha com esse CPF). Nova ficha: digitar CPF completo preenche os dados.
- GET /api/cep/{cep} (ViaCEP via backend; 404/503 → usuário preenche manualmente). Campos cep + complemento na ficha e nas vias.
- Via Cliente e Via Loja mostram "Forma de pgto." (sinal + pagamentos).
- Aba Saídas (/saidas): fichas com retirada de sexta a domingo (navegação por fim de semana), Nº contrato, cliente, traje, retirada, restante/Pago, botões Retirou/Devolvido/Desfazer, imprimir planilha. GET /api/fichas?saida_de&saida_ate (exclui cancelados).
- Backup inclui `clientes` e counters.ultimo. Desktop v1.1.0: frontend/public/downloads/MariahNoivas-Setup-1.1.0.exe.
