# Segurança pré-produção — checklist

> **REGRA: Nenhum deploy a produção com paciente real acontece enquanto houver item CRÍTICO ou ALTO com status ABERTO.**

Este arquivo é a **fonte única de verdade** sobre dívida de segurança pré-produção do psi-maria-cristina. Regras de manutenção:

- Todo item tem: risco, localização no código (arquivo/rota, quando aplicável), gravidade, fase do plano em que será tratado, status.
- Status possíveis: **ABERTO** · **RESOLVIDO** (com commit e confirmação do `code-reviewer-security`) · **ACEITO** (risco assumido pelo dono, com justificativa — não conta como aberto, mas não some).
- Nenhum item é removido do arquivo. Quando resolvido, o status muda e ganha a referência do commit; o histórico fica.
- O `code-reviewer-security` é quem confirma RESOLVIDO; a auditoria de cada fase deve terminar atualizando este arquivo.
- Novos achados de qualquer auditoria entram aqui, mesmo que sejam corrigidos na mesma tarefa (entram já como RESOLVIDO).

Gravidade: **CRÍTICO** = exposição ou manipulação direta de dado de paciente/dinheiro, ou exigência legal · **ALTO** = facilita ataque ou compromete segredo/infra · **MÉDIO** = defesa em profundidade, higiene, superfície reduzida.

Referências: fases em `PLANO-reconstrucao.md`; modelo em `PROPOSTA-schema.md`. Commits de referência: `20cb0e7` (Fase 0), `6fd2c52` (stubs), `00ad07b` (Prisma/migration/seed), `ea5292e` (Fase 1 · auth), `2af0aed` (Fase 2 · pacientes), `835fb22` (Fase 3 · agenda), pendente (Fase 4 · área do paciente e alertas, a commitar), pendente (Documentos clínicos, a commitar).

Última atualização: 2026-09-21 (após Documentos clínicos e edição de e-mail pelo paciente).

---

## Resumo

| Gravidade | Abertos | Aceitos | Resolvidos |
|---|---|---|---|
| CRÍTICO | 4 | 0 | 3 |
| ALTO | 8 | 0 | 4 |
| MÉDIO | 11 | 6 | 8 |

---

## CRÍTICOS — bloqueiam produção sem exceção

### C1 · IDOR nas rotas de pagamento — ABERTO
- **Risco:** `consultaId` vem do body/query e é usado sem verificar se a consulta pertence ao paciente logado. Qualquer paciente autenticado vê/manipula a cobrança de outro (gera PIX, consulta status, marca pago).
- **Onde:** `src/app/api/pagamento/route.ts` POST; `src/app/api/pagamento-checkout/route.ts` POST (`consultaId` linha ~37), GET (`?consultaId=`), PUT (linha ~203); `src/app/api/pagamento-direto/route.ts` POST.
- **Mitigação atual:** desde a Fase 1 exigem login (`requireAuth`), mas não checam dono.
- **Fase:** 5 (reescrita do pagamento com `Pagamento` 1:1 e `auth.pacienteId === consulta.pacienteId`).

### C2 · Cliente se declara pago — ABERTO
- **Risco:** `PUT /api/pagamento-checkout` recebe `{ paymentId, consultaId }` do cliente, faz `payment.get(paymentId)` e, se `approved`, marca a consulta como `pago` — **sem conferir `external_reference === consultaId`**. Um `paymentId` aprovado de qualquer outra transação (inclusive de R$ 1) marca qualquer consulta como paga. O POST também marca `pago` a partir do próprio fluxo, e o `agendamento` legado gravava `pagamento` no JSON.
- **Onde:** `src/app/api/pagamento-checkout/route.ts` linhas ~96 e ~212–220.
- **Fase:** 5 (fonte de verdade = webhook com `x-signature` + `payment.get` + `external_reference`; reconciliação idempotente — PROPOSTA §4).

### C3 · Valor da cobrança vem do cliente — ABERTO *(novo nesta varredura)*
- **Risco:** `valor` é lido do body (`const { valor = 150.00 } = body`) e enviado ao MercadoPago como `transaction_amount`. O cliente pode pagar R$ 1 e o sistema marca a consulta como paga (combinado com C2).
- **Onde:** `src/app/api/pagamento-checkout/route.ts` POST linha ~42 (`transaction_amount: valor` em ~56); `src/app/api/pagamento-direto/route.ts` linha ~41 (~67); `src/components/CheckoutTransparente.tsx` linha ~265 envia `valor: 150.00`. O GET PIX usa `150.00` fixo (linha ~162) — afetados: POST cartão e `pagamento-direto`.
- **Fase:** 5 (valor vem de `Pagamento.valor`, definido pela psicóloga a partir de `Configuracao.valorPadraoSessao`; nunca do body).

### R-C3 · Vazamento de dado pessoal no agendamento público (era C4) — RESOLVIDO (Fase 3)
- **Era:** `POST /api/agendamento` (público) achava o paciente por email e devolvia `paciente: pacienteExistente` inteiro (nome, telefone, CPF, data de nascimento, responsável) — enumeração + coleta de CPF a partir de um e-mail.
- **Resolução:** rota reescrita (Prisma). Resposta 201 contém apenas `{ consulta: { id, inicio, status }, novoCadastro }` + cookie de sessão `httpOnly`; 400 devolve só `error`/`campos` (mensagens fixas de validação do próprio input); 409 devolve `{ error, codigo: 'EMAIL_EXISTENTE' }` sem nenhum dado do registro (pré-cheque com `select: { id: true }`). Validação de formato/cadastro/senha ocorre **antes** do pré-cheque de e-mail, então payload inválido nunca revela existência de conta. A distinção 409/201 para e-mail válido é enumeração **aceita** pelo dono (mesmo perfil de M1). Cadastro (Usuario + Paciente) e consulta são criados na mesma transação Serializable. Confirmado pelo revisor (auditoria Fase 3, eixo a). Commit `835fb22`.

### C5 · LGPD — anonimização/exclusão de dados de paciente (Q12) — ABERTO
- **Risco:** não há mecanismo para anonimizar ou excluir dados de paciente a pedido do titular (LGPD art. 18). Dados de saúde (`Consulta.relatorio`) são dado sensível. Sem isso, não se pode guardar dado real.
- **Onde:** modelo — `Paciente` sem `anonimizadoEm`; nenhuma rota de anonimização; `onDelete: Restrict` impede exclusão física com histórico (correto, mas exige a anonimização lógica).
- **Fase:** a definir — **antes de produção**, via migration incremental (`Paciente.anonimizadoEm`, limpeza de nome/telefone/cpf/avatar + exclusão do objeto no storage, `Usuario.ativo = false`) + rota protegida da psicóloga + registro em `PROPOSTA-schema.md` §8.
- **Nota Fase 3 (CPF):** `Paciente.cpf` permanece **opcional no banco** (paciente pode existir sem login e sem CPF, cadastrado pela psicóloga só para agenda); `dataNascimento` e `usuarioId` passaram a nullable (migration `20260918231528_paciente_sem_login`). O CPF será **obrigatório no momento da cobrança** (Fase 5 / gateway), validado na aplicação (`validarCpfCampo` já existe), não por constraint. Para LGPD: minimização de dado — só coleta CPF de quem será cobrado. INFORMATIVO, não altera a contagem.
- **Nota Documentos clínicos (2026-09-21):** a anonimização/exclusão (C5) **DEVE apagar os `Documento` do paciente — registro no banco E arquivo físico em `DOCUMENTOS_DIR`** (`removerArquivo` em `src/lib/documentos/armazenamento.ts`). `Documento.paciente` usa `onDelete: Restrict` **de propósito** (`prisma/schema.prisma`, migration `20260921225641_documento_clinico`): cascade no banco apagaria o registro e deixaria o binário órfão em disco com dado de saúde. A rotina de C5 deve iterar os documentos do paciente, apagar cada arquivo e só então o registro (ou usar a reconciliação de M20 como rede de segurança). Sem isso, C5 não pode ser dado como RESOLVIDO.

### R-C1 · Senha do paciente exposta em texto puro — RESOLVIDO (Fase 1)
- **Era:** `POST /api/agendamento` devolvia `acessoAreaRestrita: { email, senha: id.slice(-8) }`; o passo 3 da página exibia a senha.
- **Resolução:** campo removido da resposta; senha agora só por `TokenAcesso` (primeiro acesso) ou autocadastro. Commit `ea5292e`. Confirmado pelo revisor (auditoria Fase 1, eixo f).

### R-C2 · Rotas de gerenciamento sem autenticação — RESOLVIDO (Fase 1)
- **Era:** `GET /api/area-restrita?action=pacientes` devolvia a lista completa de pacientes (com CPF) a qualquer cliente HTTP; PUT/PATCH, `horarios` POST/DELETE, `consultas/[id]` PUT/DELETE sem verificação.
- **Resolução:** `requireAuth(request, 'psicologa')` em todos; `requireAuth(request)` nas rotas de pagamento. Commit `ea5292e`. Confirmado pelo revisor (eixo e).
- **Fase 2:** `GET /api/area-restrita?action=pacientes` passou a responder `410 { error: 'Use /api/pacientes' }`; listagem/detalhe/cadastro/edição de paciente agora em `src/app/api/pacientes/route.ts` e `src/app/api/pacientes/[id]/route.ts`, todos com `requireAuth(request, 'psicologa')`. Lista devolve `PacienteResumo` (sem CPF/dataNascimento); detalhe (`PacienteDetalhe`, com CPF) só psicóloga. Confirmado pelo revisor (auditoria Fase 2, eixos a/b). Commit `2af0aed`.

---

## ALTOS

### A1 · Sem rate limiting no login e nos consumos de token — ABERTO
- **Risco:** força bruta online contra `POST /api/auth/login` (bcrypt custo 12 e mensagem genérica mitigam só parcialmente) e contra `primeiro-acesso`/`redefinir-senha` (token de 256 bits torna adivinhação impraticável, mas o endpoint aceita tentativas ilimitadas).
- **Onde:** `src/app/api/auth/login/route.ts`, `primeiro-acesso/route.ts`, `redefinir-senha/route.ts`.
- **Fase:** UI/middleware (Fase 4) — limite por IP+email (janela deslizante) em `middleware.ts` ou tabela de tentativas; lockout temporário após N falhas.

- **Nota Troca de senha/e-mail (2026-09-21):** `PATCH /api/auth/senha` (`src/app/api/auth/senha/route.ts:67`) e `PATCH /api/paciente/me` com `email` (`src/app/api/paciente/me/route.ts:83`) passaram a fazer `bcrypt.compare` da senha atual exigindo apenas sessão válida. Com um cookie roubado (M14), o atacante tem 8 h para adivinhar a senha atual sem limite de tentativas e, acertando, troca senha ou e-mail (sequestro persistente — M21). Cada tentativa custa um bcrypt custo 12 no servidor (também esgota CPU). Incluir estas duas rotas no limitador de A1, com chave `usuarioId`+IP e lockout temporário após N falhas (ex.: 5 em 15 min), e registrar falhas repetidas para auditoria. Melhoria defensiva relacionada: `validarForcaSenha` sem tamanho máximo (bcrypt trunca em 72 bytes) — limitar a 72/128 caracteres.
### A2 · Segredos de produção distintos e fora do repositório — ABERTO
- **Risco:** reutilizar `JWT_SECRET`, `DATABASE_URL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` de desenvolvimento em produção, ou commitá-los. Um vazamento local vira comprometimento de produção.
- **Onde:** `.env.local` (dev, ignorado); VPS (produção, a configurar).
- **Verificar no deploy:** valores diferentes por ambiente; `JWT_SECRET` ≥ 32 bytes aleatórios; `git ls-files | grep -i env` só lista `.env.example`; credenciais MP de **produção** (não `TEST-`), com as de teste **rotacionadas** (as antigas ficaram no histórico git — ver A3).
- **Fase:** 6 (deploy).

### A3 · Credenciais de teste do MercadoPago no histórico git — ABERTO
- **Risco:** o access token `TEST-8724…` e a public key `TEST-635a…` foram commitados (commits `7d57efe` → `429e4bd`). Removidos do working tree na Fase 0, mas permanecem no histórico. Dão acesso à conta sandbox; se a mesma conta virar produção, o par de chaves de produção é gerado separadamente, mas o histórico segue expondo a sandbox.
- **Ação:** revogar/rotacionar no painel do MP (obrigatório); reescrever histórico (`git filter-repo`) é opcional se o repositório for privado — decisão do dono.
- **Fase:** antes do deploy (Fase 6).

### A4 · Webhook do MercadoPago inexistente / sem assinatura — ABERTO
- **Risco:** `notification_url` aponta para `/api/pagamento/webhook`, que não existe; o esboço `PUT /api/pagamento` não valida `x-signature` e só faz `console.log`. Sem webhook confiável, a confirmação depende do cliente (C2).
- **Onde:** `src/app/api/pagamento/route.ts` linhas ~50 e ~86–101; `src/app/api/mercadopago/route.ts` (stub 501, destino previsto).
- **Fase:** 5 (webhook `POST` com HMAC-SHA256 de `x-signature`/`x-request-id`, `payment.get`, `external_reference`, idempotência por `mpNotificationId`).

### A5 · Dados de cartão trafegam pelo servidor (PCI) — ABERTO
- **Risco:** `pagamento-direto` recebe número, CVV e validade do cartão em texto e os envia ao MP — o servidor entra no escopo PCI-DSS. Não há chamador ativo (código morto), mas a rota existe e está exposta (exige login desde a Fase 1).
- **Onde:** `src/app/api/pagamento-direto/route.ts` linhas ~79–88.
- **Fase:** 5 — remover a rota (decisão P2 do plano: Checkout Pro substitui tudo isso).

### A6 · Erro bruto do MercadoPago ecoado ao cliente — ABERTO
- **Risco:** `details: error.cause || error.message` devolve ao navegador a resposta de erro do MP, que pode conter dados do `payer` (CPF, email) e detalhes internos.
- **Onde:** `src/app/api/pagamento-checkout/route.ts` linha ~133; `src/app/api/pagamento-direto/route.ts` linha ~151.
- **Fase:** 5 (resposta só com `error` genérico + `statusDetail` mapeado).

### A7 · `DOCUMENTOS_DIR` fora do backup — ABERTO *(novo · Documentos clínicos)*
- **Risco:** os binários dos documentos clínicos ficam **fora do PostgreSQL** (só metadados na tabela `documento`). `pg_dump` não os cobre: perda do disco/crash do VPS destrói todos os documentos clínicos, deixando registros apontando para arquivos inexistentes (download responde 404, `download/route.ts` linha ~51). Dado de saúde sem cópia = violação de disponibilidade/integridade (LGPD art. 46).
- **Onde:** pasta apontada por `DOCUMENTOS_DIR` (`src/lib/documentos/armazenamento.ts` linhas 18-34); `.env.example`.
- **Fase:** 6 (deploy) — backup **criptografado** de `DOCUMENTOS_DIR` na mesma janela do `pg_dump` (snapshot consistente: banco e pasta), retenção definida, **restauração testada** (restaurar banco + pasta em ambiente limpo e baixar um documento).

### A8 · Permissões da pasta de documentos no SO — ABERTO *(novo · Documentos clínicos)*
- **Risco:** se `DOCUMENTOS_DIR` for legível por outros usuários do VPS, servida por engano pelo reverse proxy (alias de estáticos) ou ficar em disco sem criptografia, o dado de saúde fica exposto fora do controle de acesso da aplicação.
- **Onde:** VPS (produção, a configurar); `src/lib/documentos/armazenamento.ts` já cria cada arquivo com `mode: 0o600` (linha 90) e recusa pasta dentro de `/public` (linhas 21-25) — a guarda compara caminhos de forma case-sensitive (irrelevante em Linux).
- **Fase:** 6 — `DOCUMENTOS_DIR` com caminho **absoluto**, **fora da web root e do repositório**, `chown` para o usuário do app e `chmod 700`; nenhum `location`/`alias` do nginx apontando para ela; disco (ou volume) e backup criptografados.

### R-A1 · Logs com PAN/CVV/token de cartão e CPF — RESOLVIDO (Fase 0 · T0.1)
- **Era:** `console.log('Dados do cartão:', cardForm)` no navegador; `paymentData` com `token` e `payer.identification` no servidor.
- **Resolução:** todos removidos/sanitizados; catches logam `{ message, status, cause[{code, description}] }`. Commit `20cb0e7`.

### R-A2 · Access token e public key do MP hardcoded — RESOLVIDO (Fase 0 · T0.2)
- **Resolução:** `getClient()` lazy com `MP_ACCESS_TOKEN` (500 se ausente); `NEXT_PUBLIC_MP_PUBLIC_KEY` no cliente. Commit `20cb0e7`. (Histórico: ver A3.)

### R-A3 · Credenciais fixas da psicóloga e senha derivada de id — RESOLVIDO (Fase 1)
- **Era:** `admin123` literal; `senha === paciente.id.slice(-8)`; comparação com `===`.
- **Resolução:** `Usuario` seed via `PSICOLOGA_SENHA_HASH` (env), `bcrypt.compare` custo 12, POST legado removido. Commits `00ad07b` (seed) e `ea5292e` (rotas). Únicas ocorrências restantes de `admin123`/`slice(-8)` estão no bloco 100% comentado de `src/app/area-restrita/page.tsx` (preservado por regra do dono; será apagado na Fase 4).

### R-A4 · Dados reais de paciente commitados — RESOLVIDO (Fase 0 · T0.3)
- **Resolução:** `src/data/pacientes.json` substituído por seeds fictícios, removido do índice (`git rm --cached`) e ignorado; nome real removido de `notificacoes.json`. Commit `20cb0e7`. **Histórico git ainda contém os dados** (commits `7d57efe`+): reescrever ou não é decisão do dono — registrar junto com A3.

---

## MÉDIOS

### M1 · Enumeração de usuário via 403 no login — ACEITO
- **Risco:** `POST /api/auth/login` devolve 403 `Defina sua senha pelo link de primeiro acesso` quando o email existe e `senhaHash` é null — revela que a conta existe (só para contas cadastradas pela psicóloga e ainda sem senha).
- **Onde:** `src/app/api/auth/login/route.ts` linhas ~29–34.
- **Decisão do dono (Fase 1):** UX > sigilo de enumeração; base pequena e de baixo valor para enumeração. Todos os outros casos (inexistente, inativo, senha errada) devolvem 401 genérico com timing equalizado.

- **Nota Área do paciente (2026-09-21):** `PATCH /api/paciente/me` responde 409 "E-mail já cadastrado" quando o e-mail pertence a outro `Usuario` (inclusive à psicóloga), permitindo a um paciente autenticado sondar existência de contas. Aceito pelos mesmos motivos de M1 e por exigir sessão de paciente; a mensagem não revela id, nome nem papel do dono.
### M2 · Cookie `secure` só em produção — ACEITO
- **Risco:** em dev (`http://localhost`) o cookie vai sem `Secure`. Em produção depende de `NODE_ENV=production`.
- **Onde:** `src/lib/auth/cookie.ts` linha 9.
- **Verificar no deploy:** `NODE_ENV=production` e HTTPS obrigatório (ver M8).

### M3 · Token de acesso na URL — ACEITO com mitigações
- **Risco:** o link `/primeiro-acesso?token=…` passa pelo WhatsApp e pode ficar em histórico do navegador/logs de proxy. Mitigações já existentes: uso único, expiração (7 d / 1 h), só SHA-256 no banco, invalidação dos anteriores ao gerar novo.
- **Onde:** `src/app/api/auth/token-acesso/route.ts`.
- **Mitigação implementada (Fase 2):** `src/app/primeiro-acesso/page.tsx` e `src/app/redefinir-senha/page.tsx` leem o token de `window.location.search` e chamam `history.replaceState` no mesmo efeito, antes de qualquer `fetch`; token só em `useState`, nunca em storage/log. O link ainda trafega pelo WhatsApp e pelo access log do primeiro GET — por isso permanece ACEITO. Confirmado pelo revisor (eixo e). Commit `2af0aed`.

### R-M5 · Mass assignment no PUT de consulta da psicóloga (era M4) — RESOLVIDO (Fase 3)
- **Era:** `PUT /api/area-restrita` fazia `{ ...consulta, ...updates }` com o body inteiro.
- **Resolução:** `src/app/api/area-restrita/route.ts` **removido**. Substituto `PATCH /api/consultas/[id]` monta `Prisma.ConsultaUpdateInput` campo a campo (modalidade enum, motivo ≤ 200, observacoes ≤ 1000, relatorio ≤ 5000, `inicio` só via `data`+`hora` validados e revalidados em transação Serializable); `status`, `pacienteId`, `criadaPor`, `id` do body são ignorados. Status muda só em `POST /confirmar|/encerrar|/cancelar`, cada uma passando por `podeTransitar` (`src/lib/agenda/transicoes.ts`). Confirmado pelo revisor (eixo d). Commit `835fb22`.

### R-M6 · `observacoes` sem validação de tipo/tamanho (era M5) — RESOLVIDO (Fase 3)
- **Era:** `PUT /api/consultas/[id]` gravava qualquer valor truthy em `observacoes` no JSON.
- **Resolução:** rota reescrita como `PATCH`; `observacoes` exige `typeof === 'string'` e `≤ 1000`, `motivo ≤ 200`, `relatorio ≤ 5000`, `motivoCancelamento ≤ 300`; `null` explícito limpa o campo. Mesmos limites em `POST /api/consultas` e `POST /api/agendamento`. Confirmado pelo revisor. Commit `835fb22`.

### M6 · PII em query string — ABERTO
- **Risco:** `GET /api/pagamento-checkout?consultaId=&email=&nome=` coloca email e nome do paciente na URL (logs de servidor/proxy).
- **Onde:** `src/app/api/pagamento-checkout/route.ts` GET; chamador em `src/components/CheckoutTransparente.tsx` linha ~101.
- **Fase:** 5 (dados vêm do `Pagamento`/sessão, não da URL).

### M7 · Objeto bruto do MP devolvido ao cliente — ABERTO
- **Risco:** `payment: response` expõe ao navegador o payload completo do MP (`payer.identification`, `card.first_six_digits`/`last_four_digits`, ids internos).
- **Onde:** `src/app/api/pagamento-checkout/route.ts` linha ~106.
- **Fase:** 5.

### M8 · Cabeçalhos de segurança HTTP ausentes — ABERTO
- **Risco:** `next.config.ts` não define `headers()` — sem `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`. O SDK JS do MP e o iframe do Google Maps exigem CSP explícita.
- **Onde:** `next.config.ts`.
- **Fase:** 6 (deploy) — HSTS e CSP (com `sdk.mercadopago.com`, `www.google.com/maps`).

### M9 · Build ignora erros de tipo e lint — ABERTO
- **Risco:** `typescript.ignoreBuildErrors` e `eslint.ignoreDuringBuilds` deixam código quebrado ir a produção (hoje `tsc`/`lint` passam limpos — a flag só esconde regressões futuras).
- **Onde:** `next.config.ts` linhas 7 e 12.
- **Fase:** 6 — remover as duas flags antes do primeiro deploy do sistema novo.

### M10 · Persistência em JSON no servidor de produção — ABERTO (restrito a pagamento)
- **Risco:** rotas legadas de pagamento ainda leem/escrevem `src/data/consultas.json` com `fs` — sem transação, em serverless não persiste, escrita concorrente corrompe. Além disso, o `consultas.json` legado **não tem mais relação com a tabela `consulta` do Prisma**: qualquer "marcar como pago" ali não reflete no banco real.
- **Onde:** `src/app/api/pagamento-checkout/route.ts`, `src/app/api/pagamento-direto/route.ts`.
- **Fase 3:** migrados para Prisma: `agendamento`, `consultas` (+ `[id]`, `/confirmar`, `/encerrar`, `/cancelar`), `disponibilidade`, `horarios` (+ `[id]`), `excecoes` (+ `[id]`). `area-restrita/route.ts` removido. Já em Prisma desde Fases 1–2: auth, pacientes. Nenhum arquivo fora de `pagamento-checkout`/`pagamento-direto` importa `fs` ou `src/data`.
- **Fase 4:** sem alteração. Rotas novas (`paciente/me`, `paciente/me/consultas`, `alertas`, `alertas/[id]`) e `src/lib/agenda/alertas.ts` usam só Prisma; grep de `fs`/`src/data` nos arquivos da fase: zero. Persistência em JSON continua restrita a `pagamento-checkout`/`pagamento-direto`.
- **Fase:** 5 (modelo `Pagamento` no Prisma; remoção de `src/data/*.json`). Segue **ABERTO** até lá — é bloqueante para produção porque as rotas de pagamento estão ativas (com `requireAuth`) e gravam em arquivo.

### M11 · CSRF — ACEITO com mitigação estrutural
- **Risco:** API baseada em cookie de sessão. Mitigação: `sameSite=lax` (bloqueia envio do cookie em POST cross-site), rotas mutáveis aceitam só `application/json` (formulário HTML cross-site não envia JSON). Sem token CSRF dedicado.
- **Onde:** `src/lib/auth/cookie.ts`.
- **Reavaliar** se algum endpoint passar a aceitar `form-urlencoded` ou se `sameSite` mudar.

- **Nota Documentos clínicos:** `POST /api/documentos` aceita `multipart/form-data` (um `<form>` cross-site consegue enviar) — o gatilho de reavaliação disparou. A mitigação restante é `sameSite=lax` (bloqueia o cookie em POST cross-site em todos os navegadores atuais); PATCH/DELETE seguem só JSON. Permanece ACEITO. Hardening barato e recomendado: no POST de upload, responder 403 se `Sec-Fetch-Site: cross-site` ou `Origin` presente e diferente da própria origem.
### M12 · Fallback `http://localhost:3000` para `NEXT_PUBLIC_URL` — ABERTO
- **Risco:** se a env faltar em produção, `back_urls`/`notification_url` do MP e o `link` de primeiro acesso apontam para localhost (falha funcional, e o webhook nunca chega — reforça C2/A4).
- **Onde:** `src/app/api/pagamento/route.ts` linhas ~44–50. (`agendamento/route.ts` não usa mais `NEXT_PUBLIC_URL` desde a Fase 3; `token-acesso` já falha com 500 se ausente — padrão correto.)
- **Fase:** 5 — falhar explicitamente como em `token-acesso`.

### R-M7 · Chamada interna agendamento → pagamento quebrada pela guarda (era M13) — RESOLVIDO (Fase 3)
- **Era:** `POST /api/agendamento` fazia `fetch` server-to-server para `/api/pagamento` sem sessão; recebia 401 engolido pelo `catch`.
- **Resolução:** rota reescrita sem nenhum `fetch` interno e sem uso de `NEXT_PUBLIC_URL`; cobrança fica para a Fase 5 (pós-consulta). Confirmado pelo revisor (auditoria Fase 3). Commit `835fb22`.

### M14 · Sem invalidação de sessão em logout / troca de senha — ABERTO
- **Risco:** JWT stateless: logout só apaga o cookie e redefinir a senha não invalida sessões já emitidas — um cookie roubado continua válido até expirar (8 h), salvo `Usuario.ativo = false`.
- **Onde:** `src/app/api/auth/logout/route.ts`; `src/lib/auth/consumir-token.ts`; `src/lib/auth/guard.ts`.
- **Mitigação atual:** `autenticar()` consulta `ativo` no banco a cada request; expiração curta.
- **Nota Fase 4:** o impacto de um cookie de **paciente** roubado aumentou: agora dá leitura de `GET /api/paciente/me` (nome, e-mail, telefone, CPF, nascimento, responsável), edição desses campos e cancelamento de consultas até a expiração (8 h). Não implementado nesta sub-fase; segue ABERTO (invalidação por `senhaAlteradaEm`/`sessaoVersao`).
- **Fase:** 4 — `Usuario.senhaAlteradaEm` (ou `sessaoVersao`) comparado com `iat` do JWT em `autenticar()`; redefinição de senha atualiza o campo. Relaciona-se com Q10 da proposta (JWT puro × tabela `Sessao`).

- **Nota Área do paciente (2026-09-21):** cookie de paciente roubado agora também permite trocar o e-mail de login (ver M21), o que converte o acesso temporário (8 h) em sequestro persistente. Reforça a prioridade da invalidação por `sessaoVersao`.
### M15 · JWT sem `iss`/`aud` — ACEITO com dependência de A2
- **Risco:** token assinado com o mesmo segredo em outro ambiente/aplicação seria aceito. Só é explorável se o `JWT_SECRET` for reutilizado entre ambientes — exatamente o que A2 proíbe.
- **Onde:** `src/lib/auth/jwt.ts` linhas ~19–30.
- **Melhoria (Fase 4):** `setIssuer('psi-maria-cristina').setAudience('web')` + `jwtVerify(..., { issuer, audience })`.

### M17 · Regra "menor de idade exige responsável" não é aplicada em edição parcial — ACEITO (limitação declarada)
- **Risco:** `validarPacienteEdicao` é pura e só aplica a regra quando `dataNascimento` vem no body; `PATCH {"dataNascimento":"2015-01-01"}` em paciente sem responsável, ou `PATCH {"responsavel":null}` em menor, passam. Integridade cadastral, não exposição; só a psicóloga chama.
- **Onde:** `src/lib/validacao/paciente.ts` linhas ~290–297; `src/app/api/pacientes/[id]/route.ts` linhas ~66–69 (o `select` de `existente` não traz `dataNascimento`/`responsavel`).
- **Nota Fase 4:** `validarPacienteEdicaoPropria` (`src/lib/validacao/paciente.ts` ~399–404) herda a mesma limitação, agora acionável pelo próprio paciente em `PATCH /api/paciente/me`. A correção planejada (validar estado resultante existente ⊕ body) deve cobrir as duas rotas.
- **Melhoria (Fase 4):** no PATCH, carregar `dataNascimento, responsavel, telefoneResponsavel` do registro e aplicar a regra sobre o estado resultante (existente ⊕ body) antes do `update`.

### M18 · Sem teto de agendamentos por paciente e sem rate limit no autocadastro público — ABERTO *(novo na Fase 3)*
- **Risco:** `POST /api/agendamento` é público e cria `Usuario` + `Paciente` + `Consulta`; um paciente logado pode reservar **todos** os horários livres (nenhum limite de consultas futuras por `pacienteId`), e um visitante pode repetir com N e-mails — negação de serviço da agenda e poluição da base com cadastros fictícios. Não é vazamento; é disponibilidade/abuso.
- **Onde:** `src/app/api/agendamento/route.ts` (ambos os ramos); `src/lib/agenda/consultas.ts` (`criarConsultaComTrava`).
- **Nota Fase 4:** sem alteração de risco. `LayoutPaciente` expõe o link "Agendar" ao paciente logado (mesmo `POST /api/agendamento` da Fase 3); teto por paciente ainda não implementado. Segue ABERTO.
- **Fase:** 4 — dentro da mesma transação Serializável, contar consultas do paciente com status em `CONSULTA_STATUS_OCUPA_HORARIO` e `inicio > now` e rejeitar 409 acima de um teto configurável (`Configuracao`, ex.: 2); rate limit por IP no autocadastro junto com A1.

### R-M8 · `GET/PATCH /api/paciente/me` devolvia anotação interna da psicóloga e metadados de conta ao paciente — RESOLVIDO (Fase 4, antes do commit)
- **Era:** a rota reutilizava `SELECT_DETALHE`/`paraDetalhe` da API da psicóloga e serializava `observacoesCadastro` (campo de uso interno da psicóloga sobre o paciente — mesma classe do `relatorio`), além de `usuarioId`, `origemCadastro`, `ultimoLoginEm`, `ativo`, `primeiroAcessoPendente`, e selecionava `usuario.senhaHash` (só convertido em boolean). A UI não exibia, mas qualquer paciente autenticado lia o JSON via DevTools/curl. Sem IDOR (só o próprio registro). Encontrado pelo revisor na auditoria da Fase 4 (eixo a, HIGH).
- **Resolução:** `src/types/paciente.ts` ganhou `PacienteMeDto { id, nome, email, telefone, dataNascimento, cpf, responsavel, telefoneResponsavel }`; `src/lib/validacao/paciente.ts` ganhou `SELECT_ME` (seleciona só esses campos + `usuario.email`; sem `senhaHash`, `observacoesCadastro`, `origemCadastro`, `ultimoLoginEm`, `ativo`, `usuarioId`) e `paraMeDto`; `src/app/api/paciente/me/route.ts` GET/PATCH usam exclusivamente `SELECT_ME` + `paraMeDto`; `area-paciente/{page,dados/page}.tsx` tipam com `PacienteMeDto`. Grep dos campos proibidos em `src/app/api/paciente/**`: zero. Confirmado pelo revisor (re-checagem Fase 4, eixo a). Commit pendente (Fase 4).

### M19 · Upload carregado inteiro em memória antes da checagem de tamanho — ABERTO *(novo · Documentos clínicos)*
- **Risco:** `POST /api/documentos` chama `request.formData()` (linha 27) antes de comparar `arquivo.size` com `limiteBytes()` (linha 61); o App Router não impõe limite de body. Bodies de centenas de MB em paralelo esgotam a memória do processo. Superfície pequena: a rota exige `requireAuth('psicologa')` (linha 21) — só a psicóloga ou um cookie dela roubado (M14).
- **Onde:** `src/app/api/documentos/route.ts` linhas 27 e 61.
- **Fase:** 6 — `client_max_body_size 16m` (ou `DOCUMENTOS_MAX_MB` + folga) no reverse proxy; na aplicação, pré-checar `content-length` e responder 413 antes de `formData()` (não cobre chunked, por isso o proxy é a defesa principal).

### M20 · Arquivo órfão em disco após `DELETE /api/documentos/[id]` — ABERTO *(novo · Documentos clínicos)*
- **Risco:** a rota apaga o registro (linha 87) e só depois o arquivo (linha 90); se o `unlink` falhar por motivo ≠ ENOENT (no Windows, download em andamento do mesmo arquivo → EBUSY/EPERM; em Linux, EACCES por permissão) ou o processo cair entre as duas operações, o binário com dado de saúde permanece em `DOCUMENTOS_DIR` sem registro — **inacessível pela aplicação** (não há download sem registro), mas retido indevidamente (LGPD: eliminação). A rota loga só o `id` (linha 92) e responde 200. A ordem escolhida é a correta (a alternativa deixaria registro fantasma apontando para arquivo removido).
- **Onde:** `src/app/api/documentos/[id]/route.ts` linhas 82-95; `src/lib/documentos/armazenamento.ts` `removerArquivo` (94-101).
- **Fase:** junto com C5 — rotina de reconciliação (script ou rota da psicóloga): listar `DOCUMENTOS_DIR`, apagar arquivos cujo nome não existe em `documento.nome_arquivo`; executar após anonimização e periodicamente.

### M21 · Troca do e-mail de login pelo paciente sem reautenticação — PARCIALMENTE MITIGADO (manter ABERTO até (2)/(3))
- **Risco:** `PATCH /api/paciente/me` passou a aceitar `email` e atualiza `Usuario.email` (credencial de login) exigindo apenas o cookie de sessão. Com um cookie de paciente roubado (M14, válido até 8 h) o atacante troca o e-mail para um endereço próprio: o titular deixa de conseguir entrar (login é por e-mail), e qualquer link de redefinição/primeiro acesso que venha a ser entregue ao e-mail cadastrado passa a chegar ao atacante — sequestro persistente da conta, que sobrevive à expiração do cookie. Sem aviso ao e-mail antigo, o titular só percebe ao tentar logar.
- **Onde:** `src/app/api/paciente/me/route.ts` linhas 56-89 (pré-check e `tx.usuario.update`); `src/lib/validacao/paciente.ts` `validarPacienteEdicaoPropria` (branch `email`); UI em `src/app/area-paciente/dados/page.tsx`.
- **Mitigação atual:** validação/normalização do e-mail, unicidade global e transação corretas; `Usuario.ativo=false` pela psicóloga corta o acesso; a psicóloga vê o e-mail atual em `/area-restrita/pacientes/[id]` e pode corrigi-lo. CPF deixou de ser editável pelo paciente na mesma mudança.
- **Fase:** 4/5 — (1) exigir `senhaAtual` no body quando `email` for enviado (`bcrypt.compare` contra `Usuario.senhaHash`; 401 genérico em falha; rejeitar troca se `senhaHash` for null) e campo correspondente na tela; (2) quando houver envio de e-mail, notificar o endereço ANTIGO da troca (com o novo endereço mascarado); (3) M14 — invalidar sessões emitidas antes da troca (`sessaoVersao`/`senhaAlteradaEm` também incrementado ao mudar e-mail). Enquanto aberto, o item soma-se ao impacto de M14 já anotado na Fase 4.

- **Mitigação (2026-09-21, Fase 4):** item (1) implementado. `PATCH /api/paciente/me` exige `senhaAtual` sempre que `email` vier no body (`src/app/api/paciente/me/route.ts:56-62`), rejeita cadastro sem `usuarioId`/`senhaHash` (linhas 71-83), faz `bcrypt.compare` contra `Usuario.senhaHash` (linha 83) e responde 401 genérico "Senha atual incorreta" (linhas 85-88); unicidade de e-mail só é verificada APÓS a senha conferir (linhas 91-100), evitando oráculo de e-mail sem posse da senha. Validação de forma em `validarPacienteEdicaoPropria` (`src/lib/validacao/paciente.ts:410-416`); UI em `PacienteForm` (`exigirSenhaAtualSeEmailMudar`, campo "Senha atual" só aparece se o e-mail divergir) e `src/app/area-paciente/dados/page.tsx:62-67`. Na mesma entrega: `PATCH /api/auth/senha` (`src/app/api/auth/senha/route.ts`) permite ao usuário trocar a própria senha com `senhaAtual` + `novaSenha` (`validarForcaSenha`, hash custo 12), UI em `src/components/area-paciente/AlterarSenhaForm.tsx`. Cobertura E2E 18/18.
- **Residual:** cookie roubado + senha adivinhada (ver nota em A1) ainda troca o e-mail; itens (2) aviso ao endereço antigo e (3) invalidação de sessões anteriores (M14/`sessaoVersao`, também ao trocar e-mail e senha) seguem ABERTOS. Enquanto (3) não existir, trocar a senha em `/api/auth/senha` NÃO derruba a sessão do atacante.
### INFORMATIVOS (LOW, não contam no Resumo) — Área do paciente
- **I11 · Loop de redirecionamento login ↔ layouts por `next` de outro papel — RESOLVIDO (2026-09-21):** `next` só é honrado se pertencer à área do papel autenticado (`nextCabeNoPapel`/`destinoFinal`, `src/app/login/page.tsx:32-42`), sempre depois de `destinoSeguro` — R-M4 (open redirect) não regride. `LayoutPaciente`/`LayoutPsicologa` mandam papel errado para a própria área (nunca para `/login`) e, deslogado, para `/login?next=<encodeURIComponent(pathname)>`. Relevância: só disponibilidade (o loop era DoS acidental no navegador); nenhuma exposição de dados. Cobertura E2E 6/6.

### INFORMATIVOS (LOW, não contam no Resumo) — Documentos clínicos
- **I6 · Guarda anti-`/public` case-sensitive** (`src/lib/documentos/armazenamento.ts` linha 23): em FS case-insensitive (Windows/macOS dev) `./Public/x` passa; no VPS Linux não se aplica. Fix opcional: comparar via `realpath`/lowercase.
- **I7 · `.gitignore` só cobre o caminho padrão** `/documentos-privados/`; `DOCUMENTOS_DIR` relativo alternativo dentro do repo entraria no `git add`. Regra: em produção sempre caminho absoluto fora do repo (A8).
- **I8 · Limite de 15 MB hardcoded no cliente** (`PainelDocumentos.tsx` linha 21) vs `DOCUMENTOS_MAX_MB` no servidor — divergência só de UX; servidor é a autoridade (413).
- **I9 · Magic bytes ≠ conteúdo inofensivo:** PDF com JavaScript é aceito. Mitigado por: só a psicóloga envia; download sempre `attachment` + `nosniff` + `CSP sandbox` (nunca renderizado inline na origem do site). Aceito.
- **I10 · `diretorioGarantido`** (`armazenamento.ts` linhas 15, 27-31) é atribuído e nunca lido — código morto, sem impacto.

### INFORMATIVOS (LOW, não contam no Resumo) — Fase 4
- **I4 · `?semana=` sem validação de formato em `src/app/area-restrita/agenda/page.tsx`:** só cliente/psicóloga; servidor valida `de/ate`. Corretude (data inválida pode quebrar a grade), não segurança. Fix opcional: aceitar só `YYYY-MM-DD`, senão `hojeLocalISO()`.
- **I5 · `telefoneComDdi` duplicado** em `src/components/area-restrita/alertas/telefone.ts` e `src/app/area-restrita/pacientes/[id]/page.tsx` — higiene; unificar quando conveniente.

### INFORMATIVOS (LOW, não contam no Resumo) — Fase 3
- **I1 · `P2002` genérico no autocadastro:** `POST /api/agendamento` responde `EMAIL_EXISTENTE` para qualquer violação de unique na transação, inclusive `cpf` — mensagem incorreta e permite distinguir CPF já cadastrado (409) de não cadastrado (201, criando conta). Fix (Fase 4): inspecionar `error.meta.target` e responder 409 genérico sem `codigo` para CPF, ou pré-checar como em `POST /api/pacientes`.
- **I2 · Reagendamento/criação pela psicóloga aceitam `inicio` no passado:** `PATCH /api/consultas/[id]` e `POST /api/consultas` não checam `inicio > now` (só psicóloga). Decidir: rejeitar 400 ou documentar como registro retroativo intencional.
- **I3 · `pacientes/novo` oferecia "Gerar link de primeiro acesso" para paciente sem e-mail** (servidor respondia 400, seguro) — **corrigido na própria Fase 3**: botão só aparece com `temLogin`; aviso explica que o acesso pode ser criado depois.

### R-M1 · Fallback literal de segredo (`|| 'TEST-…'`) — RESOLVIDO (Fase 0)
- Ver R-A2.

### R-M2 · Conta desativada podia consumir token / receber novo link — RESOLVIDO (Fase 1)
- **Resolução:** `usuario: { ativo: true }` no `updateMany` de consumo; `token-acesso` responde 404 igual para inexistente e inativo. Commit `ea5292e`. Confirmado pelo revisor.

### R-M4 · Open redirect em `/login?next=` via barra invertida — RESOLVIDO (Fase 2, antes do commit)
- **Era:** `destinoSeguro()` só rejeitava valores que não começassem com `/` ou começassem com `//`; `?next=%2F%5Cevil.com` (`/\evil.com`) passava e o App Router resolvia `new URL('/\evil.com', location.href)` como `https://evil.com/` — redirect externo pós-login (phishing). Encontrado pelo revisor na auditoria da Fase 2.
- **Onde:** `src/app/login/page.tsx` (`destinoSeguro`). O `next` gerado pelo `middleware.ts` é sempre `pathname` (seguro); o vetor era link malicioso.
- **Resolução:** `destinoSeguro` rejeita `\`, resolve com `new URL(next, window.location.origin)`, exige `origin` igual e devolve só `pathname + search`. Commit `2af0aed`.

### R-M3 · Seed logava email da psicóloga e erro bruto — RESOLVIDO (Fase 1 · Prisma)
- **Resolução:** `prisma/seed.ts` sem email no log; `catch` só com a primeira linha da mensagem. Commit `00ad07b`.

---

## Documentos clínicos (dado de saúde) — modelo e controles

Entidade `Documento` (`prisma/schema.prisma`, migration `20260921225641_documento_clinico`): documento clínico **do paciente** (não da consulta), enviado pela psicóloga — `id`, `pacienteId` (FK `onDelete: Restrict`), `titulo` ≤ 120, `nomeArquivo` (único; `uuid + .pdf|.png|.jpg`, gerado pelo sistema), `nomeOriginal` (só rótulo de exibição, sanitizado), `mimeType`, `tamanhoBytes`, `visivelParaPaciente` (default `false`), `enviadoPorId` (FK `Usuario`, `onDelete: SetNull`), `criadoEm`. O **binário fica fora do banco e fora de `/public`**, em `DOCUMENTOS_DIR` (env; padrão `./documentos-privados`, ignorado no git), gravado com `flag 'wx'` e `mode 0o600`. Único caminho para o binário: `GET /api/documentos/[id]/download` (autenticado + autorizado). Rotas: `POST /api/documentos` (upload, psicóloga), `PATCH|DELETE /api/documentos/[id]` (psicóloga), `GET /api/pacientes/[id]/documentos` (psicóloga, todos), `GET /api/paciente/me/documentos` (paciente, só os próprios visíveis). Auditado em 2026-09-21 (`code-reviewer-security`), com E2E Playwright 29/29 da tarefa.

| Controle | Status | Evidência |
|---|---|---|
| (a) Download só após verificar dono + visibilidade; 404 idêntico; nenhum acesso ao disco antes da autorização | **CONFIRMADO** | `src/app/api/documentos/[id]/download/route.ts`: `requireAuth` 17-18 → regex UUID 22 → `findUnique` só metadados 24-35 → `autorizado` = psicóloga ∨ (paciente ∧ `doc.pacienteId === auth.pacienteId` ∧ `visivelParaPaciente === true`) 37-43 → `NAO_ENCONTRADO()` (10) para id inválido/inexistente/de outro/não visível (45) e arquivo físico ausente (52); primeiro toque no disco em `abrirStream` (49). `auth.pacienteId` vem do banco (`src/lib/auth/guard.ts` 16-27). |
| (b) Nenhum arquivo acessível por URL direta/estática | **CONFIRMADO** | `src/lib/documentos/armazenamento.ts` 18-25 (resolve `DOCUMENTOS_DIR`, lança se `=== /public` ou dentro dele — fail-closed → 500 genérico), 1 (`server-only`); `.gitignore` 53; `.env.example` 23-29. Nenhum `fs`/`src/data` fora de `src/lib/documentos` e `src/app/api/**`. E2E `/documentos-privados/` → 404. Pendências operacionais: A7, A8. |
| (c) Upload: magic bytes, tamanho, sanitização, nome uuid+ext, sem traversal; nada gravado em falha; rollback do arquivo se `create` falhar | **CONFIRMADO** | `src/app/api/documentos/route.ts`: ordem auth 21 → campos 39-50 → paciente 52-55 → arquivo 57-59 → 413 `limiteBytes()` 61-64 → 415 `detectarMime` 66-73 → 415 coerência `file.type` 74-79 → **só então** `salvarArquivo` 84 → `create` falha ⇒ `removerArquivo` + rethrow 86-105. `armazenamento.ts`: `detectarMime` 51-63 (`%PDF-`, PNG 8 bytes, `FF D8 FF`), `gerarNomeArquivo` 65-67, `caminhoDoArquivo` 69-84 (regex `^[0-9a-f-]{36}\.(pdf|png|jpg)$` + `startsWith(dir + sep)`), `salvarArquivo` 87-91 (`wx`, `0o600`), `sanitizarNomeOriginal` 113-119 (`basename`, remove controle/aspas/barras, ≤ 255). `tamanhoBytes` = `buffer.length` (94). Ressalva: M19. |
| (d) Paciente vê só os próprios visíveis (WHERE); psicóloga vê todos; escrita só psicóloga; PATCH whitelist | **CONFIRMADO** | `src/app/api/paciente/me/documentos/route.ts` 10-18 (`requireAuth('paciente')`, `where: { pacienteId: auth.pacienteId, visivelParaPaciente: true }`, DTO sem `pacienteId`/flag); `src/app/api/pacientes/[id]/documentos/route.ts` 11-24 (`requireAuth('psicologa')`); POST 21, PATCH `[id]/route.ts` 13, DELETE 77 com `requireAuth('psicologa')`; PATCH monta `data` só com `titulo`/`visivelParaPaciente` 27-48, sem spread. |
| (e) DELETE remove registro E arquivo | **CONFIRMADO com ressalva** | `src/app/api/documentos/[id]/route.ts` 82-95: registro primeiro (87), `unlink` depois (90), falha ≠ ENOENT loga só `id` (92). Ordem correta; cenário de órfão registrado em M20 (reconciliação junto com C5). |
| (f) Caminho no disco / `nomeArquivo` / `enviadoPorId` / erros do fs nunca chegam ao cliente | **CONFIRMADO** | `SELECT_DOCUMENTO` (`armazenamento.ts` 128-137) e DTOs (150-172) sem `nomeArquivo`/`enviadoPorId`; `select` do download (24-35) usa `nomeArquivo` só no servidor; headers do download: `Content-Disposition` com fallback ASCII sem aspas/controle + `filename*` percent-encoded (122-125, sem injeção), `nosniff`, `Cache-Control: private, no-store`, `CSP default-src 'none'; sandbox` (55-65); únicos `console.*` (`download/route.ts` 51, `[id]/route.ts` 92) só com `id`; todos os `catch` de rota respondem `{ error: 'Erro interno do servidor' }`. `src/types/documento.ts` sem campos de servidor. |

Relação com itens existentes: C5 (nota: exclusão deve apagar `Documento` + arquivo; `Restrict` proposital), M11 (nota `multipart`), M14 (cookie de psicóloga roubado também baixa/apaga documentos por até 8 h), A7/A8/M19/M20 novos.

---

## Verificação de deploy (Fase 6) — checklist operacional

Complementa os itens acima; marcar cada linha no dia do deploy:

- [ ] Nenhum CRÍTICO/ALTO ABERTO neste arquivo.
- [ ] `NODE_ENV=production`; HTTPS com redirecionamento; HSTS (M8).
- [ ] Envs de produção distintas das de dev (A2); `.env*` fora do repo; `PSICOLOGA_SENHA_HASH` gerado com senha forte.
- [ ] Credenciais MP de produção; as de teste rotacionadas (A3); `MP_WEBHOOK_SECRET` configurado e URL do webhook registrada no painel do MP (A4).
- [ ] PostgreSQL do VPS: acesso só local ou por rede privada, TLS se remoto, usuário da aplicação sem superuser, backups automáticos testados (restauração).
- [ ] `next.config.ts` sem `ignoreBuildErrors`/`ignoreDuringBuilds` (M9); `tsc` e `lint` limpos.
- [ ] `src/data/*.json` sem dado real (`consultas.json`, `notificacoes.json` fictícios ou vazios).
- [ ] Rota de anonimização LGPD existente e testada (C5).
- [ ] Rate limiting ativo no login (A1).
- [ ] `DOCUMENTOS_DIR` com caminho absoluto, fora da web root e do repositório; nenhum alias/location do proxy apontando para ela (A8).
- [ ] `DOCUMENTOS_DIR` com `chown` do usuário do app e `chmod 700`; disco/volume criptografado (A8).
- [ ] `DOCUMENTOS_DIR` incluída no backup criptografado, na mesma janela do `pg_dump` (A7).
- [ ] Restauração testada: banco + pasta em ambiente limpo, download de um documento OK (A7).
- [ ] `client_max_body_size` no proxy ≥ `DOCUMENTOS_MAX_MB` + folga (M19).
- [ ] Rotina de reconciliação de órfãos em `DOCUMENTOS_DIR` disponível e executada após anonimizações (M20/C5).
