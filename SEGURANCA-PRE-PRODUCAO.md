# Segurança pré-produção — checklist

> **REGRA: Nenhum deploy a produção com paciente real acontece enquanto houver item CRÍTICO ou ALTO com status ABERTO.**

Este arquivo é a **fonte única de verdade** sobre dívida de segurança pré-produção do psi-maria-cristina. Regras de manutenção:

- Todo item tem: risco, localização no código (arquivo/rota, quando aplicável), gravidade, fase do plano em que será tratado, status.
- Status possíveis: **ABERTO** · **RESOLVIDO** (com commit e confirmação do `code-reviewer-security`) · **ACEITO** (risco assumido pelo dono, com justificativa — não conta como aberto, mas não some).
- Nenhum item é removido do arquivo. Quando resolvido, o status muda e ganha a referência do commit; o histórico fica.
- O `code-reviewer-security` é quem confirma RESOLVIDO; a auditoria de cada fase deve terminar atualizando este arquivo.
- Novos achados de qualquer auditoria entram aqui, mesmo que sejam corrigidos na mesma tarefa (entram já como RESOLVIDO).

Gravidade: **CRÍTICO** = exposição ou manipulação direta de dado de paciente/dinheiro, ou exigência legal · **ALTO** = facilita ataque ou compromete segredo/infra · **MÉDIO** = defesa em profundidade, higiene, superfície reduzida.

Referências: fases em `PLANO-reconstrucao.md`; modelo em `PROPOSTA-schema.md`. Commits de referência: `20cb0e7` (Fase 0), `6fd2c52` (stubs), `00ad07b` (Prisma/migration/seed), `ea5292e` (Fase 1 · auth), pendente (Fase 2 · pacientes, a commitar pelo dono).

Última atualização: 2026-09-18 (após Fase 2 · gerenciamento de pacientes + UI de login).

---

## Resumo

| Gravidade | Abertos | Aceitos | Resolvidos |
|---|---|---|---|
| CRÍTICO | 5 | 0 | 2 |
| ALTO | 6 | 0 | 4 |
| MÉDIO | 10 | 6 | 4 |

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

### C4 · Vazamento de dado pessoal no agendamento público — ABERTO
- **Risco:** `POST /api/agendamento` (público, visitante anônimo) acha o paciente **por email** e devolve `paciente: pacienteExistente` inteiro — nome, telefone, CPF, data de nascimento, responsável. Basta informar um email para coletar o CPF de quem já é paciente (enumeração + coleta).
- **Onde:** `src/app/api/agendamento/route.ts` linhas ~153–154.
- **Nota:** a Fase 1 removeu o campo `acessoAreaRestrita.senha` da mesma resposta (RESOLVIDO em R-C1); o objeto `paciente` continua.
- **Fase:** 3 (reescrita do agendamento: visitante → horário → cadastro/login → consulta na transação; resposta só com `consulta.id`, `inicio`, `status`).

### C5 · LGPD — anonimização/exclusão de dados de paciente (Q12) — ABERTO
- **Risco:** não há mecanismo para anonimizar ou excluir dados de paciente a pedido do titular (LGPD art. 18). Dados de saúde (`Consulta.relatorio`) são dado sensível. Sem isso, não se pode guardar dado real.
- **Onde:** modelo — `Paciente` sem `anonimizadoEm`; nenhuma rota de anonimização; `onDelete: Restrict` impede exclusão física com histórico (correto, mas exige a anonimização lógica).
- **Fase:** a definir — **antes de produção**, via migration incremental (`Paciente.anonimizadoEm`, limpeza de nome/telefone/cpf/avatar + exclusão do objeto no storage, `Usuario.ativo = false`) + rota protegida da psicóloga + registro em `PROPOSTA-schema.md` §8.

### R-C1 · Senha do paciente exposta em texto puro — RESOLVIDO (Fase 1)
- **Era:** `POST /api/agendamento` devolvia `acessoAreaRestrita: { email, senha: id.slice(-8) }`; o passo 3 da página exibia a senha.
- **Resolução:** campo removido da resposta; senha agora só por `TokenAcesso` (primeiro acesso) ou autocadastro. Commit `ea5292e`. Confirmado pelo revisor (auditoria Fase 1, eixo f).

### R-C2 · Rotas de gerenciamento sem autenticação — RESOLVIDO (Fase 1)
- **Era:** `GET /api/area-restrita?action=pacientes` devolvia a lista completa de pacientes (com CPF) a qualquer cliente HTTP; PUT/PATCH, `horarios` POST/DELETE, `consultas/[id]` PUT/DELETE sem verificação.
- **Resolução:** `requireAuth(request, 'psicologa')` em todos; `requireAuth(request)` nas rotas de pagamento. Commit `ea5292e`. Confirmado pelo revisor (eixo e).
- **Fase 2:** `GET /api/area-restrita?action=pacientes` passou a responder `410 { error: 'Use /api/pacientes' }`; listagem/detalhe/cadastro/edição de paciente agora em `src/app/api/pacientes/route.ts` e `src/app/api/pacientes/[id]/route.ts`, todos com `requireAuth(request, 'psicologa')`. Lista devolve `PacienteResumo` (sem CPF/dataNascimento); detalhe (`PacienteDetalhe`, com CPF) só psicóloga. Confirmado pelo revisor (auditoria Fase 2, eixos a/b). Commit pendente (Fase 2).

---

## ALTOS

### A1 · Sem rate limiting no login e nos consumos de token — ABERTO
- **Risco:** força bruta online contra `POST /api/auth/login` (bcrypt custo 12 e mensagem genérica mitigam só parcialmente) e contra `primeiro-acesso`/`redefinir-senha` (token de 256 bits torna adivinhação impraticável, mas o endpoint aceita tentativas ilimitadas).
- **Onde:** `src/app/api/auth/login/route.ts`, `primeiro-acesso/route.ts`, `redefinir-senha/route.ts`.
- **Fase:** UI/middleware (Fase 4) — limite por IP+email (janela deslizante) em `middleware.ts` ou tabela de tentativas; lockout temporário após N falhas.

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

### M2 · Cookie `secure` só em produção — ACEITO
- **Risco:** em dev (`http://localhost`) o cookie vai sem `Secure`. Em produção depende de `NODE_ENV=production`.
- **Onde:** `src/lib/auth/cookie.ts` linha 9.
- **Verificar no deploy:** `NODE_ENV=production` e HTTPS obrigatório (ver M8).

### M3 · Token de acesso na URL — ACEITO com mitigações
- **Risco:** o link `/primeiro-acesso?token=…` passa pelo WhatsApp e pode ficar em histórico do navegador/logs de proxy. Mitigações já existentes: uso único, expiração (7 d / 1 h), só SHA-256 no banco, invalidação dos anteriores ao gerar novo.
- **Onde:** `src/app/api/auth/token-acesso/route.ts`.
- **Mitigação implementada (Fase 2):** `src/app/primeiro-acesso/page.tsx` e `src/app/redefinir-senha/page.tsx` leem o token de `window.location.search` e chamam `history.replaceState` no mesmo efeito, antes de qualquer `fetch`; token só em `useState`, nunca em storage/log. O link ainda trafega pelo WhatsApp e pelo access log do primeiro GET — por isso permanece ACEITO. Confirmado pelo revisor (eixo e). Commit pendente (Fase 2).

### M4 · Mass assignment no PUT de consulta da psicóloga — ABERTO
- **Risco:** `PUT /api/area-restrita` faz `{ ...consulta, ...updates }` com o body inteiro — a psicóloga (única autorizada) pode sobrescrever qualquer campo, inclusive `pacienteId`/`id`. Exposição baixa (só psicóloga), mas é padrão a eliminar.
- **Onde:** `src/app/api/area-restrita/route.ts` linhas ~126–137.
- **Fase:** 4 (rotas de gerenciamento reescritas com whitelist de campos e enum de status).
- **Nota Fase 2:** as rotas novas de paciente (`POST /api/pacientes`, `PATCH /api/pacientes/[id]`) já seguem o padrão-alvo: validador com whitelist explícita (`src/lib/validacao/paciente.ts`) e `data` do Prisma montado campo a campo; `id`/`usuarioId`/`origemCadastro`/`senhaHash`/`papel` não são alteráveis. O `PUT /api/area-restrita` legado não foi tocado.

### M5 · `observacoes` sem validação de tipo/tamanho — ABERTO
- **Risco:** `PUT /api/consultas/[id]` grava qualquer valor truthy em `observacoes` (objeto, string enorme) no JSON. Só psicóloga.
- **Onde:** `src/app/api/consultas/[id]/route.ts` linhas ~19 e ~54.
- **Fase:** 4 (validação `typeof === 'string'` + limite).
- **Nota Fase 2:** `observacoesCadastro` do paciente já é validado (string, `≤ 2000`) em `src/lib/validacao/paciente.ts`. O `PUT /api/consultas/[id]` legado não foi tocado.

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

### M10 · Persistência em JSON no servidor de produção — ABERTO
- **Risco:** rotas legadas ainda leem/escrevem `src/data/*.json` com `fs` — sem transação, sem controle de acesso além da rota, e em serverless (Vercel) não persiste; no VPS, escrita concorrente corrompe. Dados de paciente em arquivo ao lado do código.
- **Onde:** `src/app/api/{agendamento,area-restrita,horarios,disponibilidade,consultas/[id],pagamento-checkout,pagamento-direto}/route.ts`.
- **Fase:** 1.3 do plano (troca pelo Prisma Client, rota a rota) — concluída para auth (Fase 1) e para pacientes (Fase 2: `/api/pacientes`, `/api/pacientes/[id]` em Prisma; `area-restrita?action=pacientes` → 410). Pendente: `area-restrita` (dashboard/consultas/notificacoes/PUT/PATCH), `agendamento`, `horarios`, `disponibilidade`, `consultas/[id]`, `pagamento-checkout`, `pagamento-direto`.

### M11 · CSRF — ACEITO com mitigação estrutural
- **Risco:** API baseada em cookie de sessão. Mitigação: `sameSite=lax` (bloqueia envio do cookie em POST cross-site), rotas mutáveis aceitam só `application/json` (formulário HTML cross-site não envia JSON). Sem token CSRF dedicado.
- **Onde:** `src/lib/auth/cookie.ts`.
- **Reavaliar** se algum endpoint passar a aceitar `form-urlencoded` ou se `sameSite` mudar.

### M12 · Fallback `http://localhost:3000` para `NEXT_PUBLIC_URL` — ABERTO
- **Risco:** se a env faltar em produção, `back_urls`/`notification_url` do MP e o `link` de primeiro acesso apontam para localhost (falha funcional, e o webhook nunca chega — reforça C2/A4).
- **Onde:** `src/app/api/agendamento/route.ts` linha ~131; `src/app/api/pagamento/route.ts` linhas ~44–50. (`token-acesso` já falha com 500 se ausente — padrão correto.)
- **Fase:** 5 — falhar explicitamente como em `token-acesso`.

### M13 · Chamada interna agendamento → pagamento quebrada pela guarda — ABERTO
- **Risco:** `POST /api/agendamento` faz `fetch` server-to-server para `/api/pagamento` sem sessão; desde a Fase 1 recebe 401, que é engolido pelo `catch` → `pagamento: null` silencioso. Não é exposição, é dependência interna quebrada e sem observabilidade.
- **Onde:** `src/app/api/agendamento/route.ts` linha ~131.
- **Fase:** 3 (agendamento reescrito não cria pagamento — cobrança é pós-consulta; se precisar reutilizar lógica, chamada direta de função, nunca HTTP interno).

### M14 · Sem invalidação de sessão em logout / troca de senha — ABERTO
- **Risco:** JWT stateless: logout só apaga o cookie e redefinir a senha não invalida sessões já emitidas — um cookie roubado continua válido até expirar (8 h), salvo `Usuario.ativo = false`.
- **Onde:** `src/app/api/auth/logout/route.ts`; `src/lib/auth/consumir-token.ts`; `src/lib/auth/guard.ts`.
- **Mitigação atual:** `autenticar()` consulta `ativo` no banco a cada request; expiração curta.
- **Fase:** 4 — `Usuario.senhaAlteradaEm` (ou `sessaoVersao`) comparado com `iat` do JWT em `autenticar()`; redefinição de senha atualiza o campo. Relaciona-se com Q10 da proposta (JWT puro × tabela `Sessao`).

### M15 · JWT sem `iss`/`aud` — ACEITO com dependência de A2
- **Risco:** token assinado com o mesmo segredo em outro ambiente/aplicação seria aceito. Só é explorável se o `JWT_SECRET` for reutilizado entre ambientes — exatamente o que A2 proíbe.
- **Onde:** `src/lib/auth/jwt.ts` linhas ~19–30.
- **Melhoria (Fase 4):** `setIssuer('psi-maria-cristina').setAudience('web')` + `jwtVerify(..., { issuer, audience })`.

### M17 · Regra "menor de idade exige responsável" não é aplicada em edição parcial — ACEITO (limitação declarada)
- **Risco:** `validarPacienteEdicao` é pura e só aplica a regra quando `dataNascimento` vem no body; `PATCH {"dataNascimento":"2015-01-01"}` em paciente sem responsável, ou `PATCH {"responsavel":null}` em menor, passam. Integridade cadastral, não exposição; só a psicóloga chama.
- **Onde:** `src/lib/validacao/paciente.ts` linhas ~290–297; `src/app/api/pacientes/[id]/route.ts` linhas ~66–69 (o `select` de `existente` não traz `dataNascimento`/`responsavel`).
- **Melhoria (Fase 4):** no PATCH, carregar `dataNascimento, responsavel, telefoneResponsavel` do registro e aplicar a regra sobre o estado resultante (existente ⊕ body) antes do `update`.

### R-M1 · Fallback literal de segredo (`|| 'TEST-…'`) — RESOLVIDO (Fase 0)
- Ver R-A2.

### R-M2 · Conta desativada podia consumir token / receber novo link — RESOLVIDO (Fase 1)
- **Resolução:** `usuario: { ativo: true }` no `updateMany` de consumo; `token-acesso` responde 404 igual para inexistente e inativo. Commit `ea5292e`. Confirmado pelo revisor.

### R-M4 · Open redirect em `/login?next=` via barra invertida — RESOLVIDO (Fase 2, antes do commit)
- **Era:** `destinoSeguro()` só rejeitava valores que não começassem com `/` ou começassem com `//`; `?next=%2F%5Cevil.com` (`/\evil.com`) passava e o App Router resolvia `new URL('/\evil.com', location.href)` como `https://evil.com/` — redirect externo pós-login (phishing). Encontrado pelo revisor na auditoria da Fase 2.
- **Onde:** `src/app/login/page.tsx` (`destinoSeguro`). O `next` gerado pelo `middleware.ts` é sempre `pathname` (seguro); o vetor era link malicioso.
- **Resolução:** `destinoSeguro` rejeita `\`, resolve com `new URL(next, window.location.origin)`, exige `origin` igual e devolve só `pathname + search`. Commit pendente (Fase 2).

### R-M3 · Seed logava email da psicóloga e erro bruto — RESOLVIDO (Fase 1 · Prisma)
- **Resolução:** `prisma/seed.ts` sem email no log; `catch` só com a primeira linha da mensagem. Commit `00ad07b`.

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
