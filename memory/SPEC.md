# Mariáh Noivas — Sistema de Locação (SPEC)

App para loja de aluguel de trajes de festa (substitui o bloco de 3 vias "Mariáh Noivas — Trajes a Rigor").
UI em pt-BR. Auth: senha única da loja (env STORE_PASSWORD) → cookie httpOnly JWT `mn_session` (30 dias).

## Data model (Mongo)
- `trajes`: id, codigo, nome, categoria, tamanho, cor, valor_locacao, status (disponivel|alugado|prova|lavanderia), foto_url, observacoes
- `fichas`: id, numero (auto, counter `counters._id=ficha`, começa em 6937), dados cliente (nome, endereco, numero_end, bairro, cpf, telefone, telefone2), traje_ids[], trajes_descricao, data_saida/data_retorno/data_prova (YYYY-MM-DD strings), medidas{traje,calca,camisa,comp_manga,comp_calca,busto,cintura,observacoes}, total, sinal, forma_pagamento, observacoes, status (reservado|retirado|devolvido|cancelado), pagamentos[{id,valor,forma,data}], created_at. `saldo` = total − sinal − Σpagamentos (computado).

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
