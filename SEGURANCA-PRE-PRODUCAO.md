# Segurança pré-produção — checklist

> **REGRA: Nenhum deploy a produção com paciente real acontece enquanto houver item CRÍTICO ou ALTO com status ABERTO.**

Este arquivo é a **fonte única de verdade** sobre dívida de segurança pré-produção do psi-maria-cristina. Regras de manutenção:

- Todo item tem: risco, localização no código (arquivo/rota, quando aplicável), gravidade, fase do plano em que será tratado, status.
- Status possíveis: **ABERTO** · **RESOLVIDO** (com commit e confirmação do `code-reviewer-security`) · **ACEITO** (risco assumido pelo dono, com justificativa — não conta como aberto, mas não some).
- Nenhum item é removido do arquivo. Quando resolvido, o status muda e ganha a referência do commit; o histórico fica.
- O `code-reviewer-security` é quem confirma RESOLVIDO; a auditoria de cada fase deve terminar atualizando este arquivo.
- Novos achados de qualquer auditoria entram aqui, mesmo que sejam corrigidos na mesma tarefa (entram já como RESOLVIDO).

Gravidade: **CRÍTICO** = exposição ou manipulação direta de dado de paciente/dinheiro, ou exigência legal · **ALTO** = facilita ataque ou compromete segredo/infra · **MÉDIO** = defesa em profundidade, higiene, superfície reduzida.

Referências: fases em `PLANO-reconstrucao.md`; modelo em `PROPOSTA-schema.md`. Commits de referência: `20cb0e7` (Fase 0), `6fd2c52` (stubs), `00ad07b` (Prisma/migration/seed), `ea5292e` (Fase 1 · auth), `2af0aed` (Fase 2 · pacientes), `835fb22` (Fase 3 · agenda), pendente (Fase 4 · área do paciente e alertas, a commitar), pendente (Documentos clínicos, a commitar), `86ba8a2` (Fase 5a · pagamento manual), pendente (Fase 5b · pagamento online, a commitar).

Última atualização: 2026-09-25 (após Fase 5b · pagamento online).

---

## Resumo

| Gravidade | Abertos | Aceitos | Resolvidos |
|---|---|---|---|
| CRÍTICO | 1 | 0 | 6 |
| ALTO | 5 | 0 | 7 |
| MÉDIO | 11 | 6 | 14 |

---

## CRÍTICOS — bloqueiam produção sem exceção

### R-C5 · IDOR nas rotas de pagamento (era C1) — RESOLVIDO (Fase 5b)
- **Era:** `consultaId` vinha do body/query e era usado sem verificar dono; qualquer paciente autenticado gerava PIX, consultava status ou marcava pago a cobrança de outro (`api/pagamento`, `api/pagamento-checkout` POST/GET/PUT, `api/pagamento-direto`).
- **Resolução:** as quatro rotas legadas foram **removidas** (`api/pagamento/route.ts`, `api/pagamento-checkout/route.ts`, `api/pagamento-direto/route.ts`, `api/mercadopago/route.ts`), junto com `src/components/CheckoutTransparente.tsx` e `src/lib/pagamentos/valor-padrao.ts`. `grep -rn "pagamento-checkout|pagamento-direto|CheckoutTransparente" src/` → só duas linhas comentadas no legado `src/app/area-restrita/page.tsx:42,785`. A única rota de pagamento que aceita id do cliente é agora `GET /api/pagamentos/[id]/cobranca`, com autorização explícita: `requireAuth` (401 anônimo) → `findUnique` só de metadados → 404 se inexistente, `origem !== 'online'` ou sem consultas (`src/app/api/pagamentos/[id]/cobranca/route.ts:38-40`) → `donoConfere = auth.papel === 'psicologa' || consultas.some(c => c.pacienteId === auth.pacienteId)` (:42-43) → **mesmo 404 genérico** quando não é dono (:45), sem vazar existência; nenhuma chamada ao gateway antes da autorização. Todas as demais rotas de pagamento são `requireAuth(request,'psicologa')`; o paciente lê o status só via `paciente/me/consultas:13-41`, que força `pacienteId: auth.pacienteId`. Confirmado pelo revisor (auditoria Fase 5b, eixo a). E2E contra build de produção: dono → 200, outro paciente → 404, anônimo → 401, paciente em `POST /api/pagamentos/online` → 403.

### R-C6 · Cliente se declara pago (era C2) — RESOLVIDO (Fase 5b) — verificação no Asaas pendente
- **Era:** `PUT /api/pagamento-checkout` recebia `{ paymentId, consultaId }` do cliente e marcava a consulta como paga se o `payment.get` dissesse `approved`, sem conferir `external_reference` — um `paymentId` aprovado de R$ 1, de qualquer transação, quitava qualquer consulta; a escrita ainda ia para `src/data/consultas.json`.
- **Resolução:** a rota foi removida. Hoje **nenhuma** rota aceita `paymentId` ou `status` vindo do cliente. O único ponto que grava status é `aplicarStatusExterno` (`src/lib/pagamentos/conciliacao.ts:20`), chamado (i) pelos dois webhooks e (ii) pela reconciliação — sempre com um `StatusExterno` produzido por `adapter.consultarStatus`, isto é, `payment.get` (MP) ou `GET /payments/{id}` (Asaas). O corpo do webhook **nunca** é fonte de verdade: no MP (`src/app/api/webhooks/mercadopago/route.ts:28-37`) o Pagamento próprio é resolvido por `Pagamento.pagamentoExternoId @unique` ou pelo `external_reference` devolvido **pelo MP**, e evento sem correspondência responde `200` sem gravar; no Asaas (`webhooks/asaas/route.ts:25-39`) o Pagamento é resolvido pelo `referenciaExterna` que **nós** gravamos e o `externalReference` do evento é conferido antes de qualquer escrita. `conciliacao.ts:66-74` recusa confirmar quando `valorPago < Pagamento.valor`. Confirmado pelo revisor (auditoria Fase 5b, eixo b).
- **Verificado com dados reais (2026-09-25):** pagamento PIX real criado no sandbox do MP com `external_reference` = nosso `pagamentoId`; webhook assinado com a **chave secreta real do painel** entregue via túnel público → 200, e o servidor **consultou o MP** e gravou `pagamentoExternoId: 1352644281` + `statusExterno: "pending"` (não confiou no corpo). Webhook com segredo errado → 401; evento de pagamento que não é nosso → 200 **sem gravar**; reentrega do mesmo evento → `duplicado: true` com **1 único** `EventoPagamento`. Núcleo de conciliação 7/7, incluindo "R$ 1 numa cobrança de R$ 200 não confirma".
- **Verificação pendente (não bloqueia o status, bloqueia o go-live):** um pagamento **aprovado** ponta a ponta (o sandbox desta conta recusa cartão com `excludes_by_rule` e o checkout hospedado não abre — configuração da conta de teste, não do código) e o fluxo **Asaas** inteiro, sem credenciais até aqui. Ver checklist da Fase 6.

### R-C4 · Valor da cobrança vinha do cliente (era C3) — RESOLVIDO (Fase 5a)
- **Era:** `valor` era lido do body (`const { valor = 150.00 } = body`) e enviado ao MercadoPago como `transaction_amount`; `src/components/CheckoutTransparente.tsx` mandava `valor: 150.00` e exibia R$ 150,00 fixo. Combinado com C2, o cliente pagava R$ 1 e a consulta era marcada como paga.
- **Resolução:** o valor passou a ser **sempre** derivado do banco. `Configuracao.valorPadraoSessao` é a fonte única (`src/lib/pagamentos/valor-padrao.ts`, `src/lib/pagamentos/cobranca.ts:13-17`) e as quatro rotas que falam com o MP a consultam no servidor: `src/app/api/pagamento/route.ts:21`, `src/app/api/pagamento-checkout/route.ts:44` (POST cartão) e `:162` (GET PIX), `src/app/api/pagamento-direto/route.ts:43`. O body não participa mais do cálculo; `grep -rn "150" src/app/api/pagamento* src/components/CheckoutTransparente.tsx` → zero. No cliente, `CheckoutTransparente` deixou de enviar `valor` e apenas **lê** `data.valor` para exibição/parcelas. No fluxo manual, o valor default é a soma de `Consulta.valor ?? Configuracao.valorPadraoSessao` calculada dentro da transação (`src/app/api/pagamentos/manual/route.ts:126-131`); um `valor` de pacote/desconto só é aceito no body porque a rota é `requireAuth(request, 'psicologa')` (`:31`), validado por `valorValido` (`:15-17`, teto `PAGAMENTO_VALOR_MAX`). `PATCH /api/consultas/[id]/valor` (também `'psicologa'`, `:22`) é o único caminho para preço por consulta e recusa consulta já paga (409, `:46-48`). Confirmado pelo revisor (auditoria Fase 5a, eixos a/b/e). E2E de produção 25/25. Commit `86ba8a2`.
- **Ressalva para a Fase 5b:** o valor enviado ao gateway deve continuar vindo do banco, e passar a usar o **valor efetivo da consulta** (`Consulta.valor ?? valorPadraoSessao`), não o padrão global — ver M25. Nenhum `transaction_amount` pode voltar a derivar do body.
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

### R-A5 · Webhook de pagamento sem assinatura (era A4) — RESOLVIDO (Fase 5b) — Asaas não exercitado
- **Era:** `notification_url` apontava para `/api/pagamento/webhook`, inexistente; o esboço `PUT /api/pagamento` não validava `x-signature` e só fazia `console.log`.
- **Resolução:** dois webhooks `POST` dedicados, ambos `export const dynamic = 'force-dynamic'`, que validam autenticidade **antes de qualquer leitura de banco ou chamada ao gateway**:
  - MercadoPago (`src/lib/pagamentos/gateways/mercadopago.ts:106-148`): exige `x-signature`, `x-request-id` e `data.id`; monta `id:${data.id};request-id:${x-request-id};ts:${ts};`, HMAC-SHA256 com `MP_WEBHOOK_SECRET`, compara com `crypto.timingSafeEqual` após conferir comprimento e rejeita `ts` fora de ±10 min (anti-replay). `MP_WEBHOOK_SECRET` ausente → `null` → **401, fail-closed**.
  - Asaas (`src/lib/pagamentos/gateways/asaas.ts:123-144`): header `asaas-access-token` comparado com `timingSafeEqual` + comprimento; token ausente → 401, mesmo comportamento fail-closed.
  Depois da validação, ambos buscam o status **real** no gateway e delegam a `aplicarStatusExterno`, idempotente e transacional. `notification_url`/`callback` apontam para `/api/webhooks/{mercadopago,asaas}`, montados por `baseUrlPublica()` (sem fallback — ver R-M12). Confirmado pelo revisor (auditoria Fase 5b, eixo c).
- **Verificado com dados reais (2026-09-25):** com a chave secreta real do painel e túnel público, assinatura válida → 200 e status buscado no MP; assinatura inválida → 401; sem assinatura → 401; replay com `ts` de 1 h → 401.
- **Verificação pendente:** webhook do **Asaas** só revisado por código (sem credenciais). Registrar os dois webhooks nos painéis e repetir na Fase 6.
- **Ressalvas LOW:** I18 (chave de dedupe do MP) e I19 (`data.id` lido só da query string).

### R-A6 · Dados de cartão trafegam pelo servidor (PCI) (era A5) — RESOLVIDO (Fase 5b)
- **Era:** `src/app/api/pagamento-direto/route.ts` recebia número, CVV e validade em texto e os enviava ao MP, colocando o servidor no escopo PCI-DSS.
- **Resolução:** a rota foi **removida**, assim como `src/components/CheckoutTransparente.tsx`, que tokenizava cartão no navegador. O modelo 5b é **exclusivamente hospedado**: geramos uma preference (Checkout Pro) ou um link do Asaas e o paciente digita os dados **no domínio do gateway**. Nenhum PAN/CVV/token entra na aplicação: `grep -rn "cardNumber|securityCode|card_number|cvv|token" src/app/api src/lib/pagamentos` → zero. O único campo de pagamento online que chega ao paciente é `cobranca.linkCheckout` (`src/lib/pagamentos/cobranca.ts:85`). Confirmado pelo revisor (auditoria Fase 5b, eixos a/f).

### R-A7 · Erro bruto do MercadoPago ecoado ao cliente (era A6) — RESOLVIDO (Fase 5b)
- **Era:** `details: error.cause || error.message` devolvia ao navegador a resposta de erro do MP, que pode conter `payer` (CPF, e-mail) e detalhes internos.
- **Resolução:** as duas rotas não existem mais. Toda falha de gateway em `POST /api/pagamentos/online` responde `502 { error: 'Não foi possível gerar a cobrança agora' }` (`src/app/api/pagamentos/online/route.ts:206-216`), com `console.error` de mensagem fixa; os demais `catch` respondem `{ error: 'Erro interno do servidor' }`. Os webhooks nunca ecoam nada do gateway. E2E: gateway sem credencial → **502 genérico**, sem revelar o nome da env.

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

### R-M9 · PII em query string (era M6) — RESOLVIDO (Fase 5b)
- **Era:** `GET /api/pagamento-checkout?consultaId=&email=&nome=` colocava e-mail e nome do paciente na URL (logs de servidor/proxy).
- **Resolução:** rota e componente removidos. Nas rotas novas, os dados do pagador vêm do banco dentro da transação (`src/app/api/pagamentos/online/route.ts:98,134,176`), nunca da URL. As únicas query strings do fluxo carregam o **nosso** `pagamentoId` opaco (`/pagamento/{sucesso,pendente,falha}?p=<uuid>` e `?data.id=` do MP), que sozinho não autoriza nada (R-C5). M3 (token de acesso na URL) continua ACEITO e é item distinto.

### R-M10 · Objeto bruto do MP devolvido ao cliente (era M7) — RESOLVIDO (Fase 5b)
- **Era:** `payment: response` expunha ao navegador o payload completo do MP (`payer.identification`, `card.first_six_digits`/`last_four_digits`, ids internos).
- **Resolução:** a resposta ao cliente é o `CobrancaOnlineDto` montado campo a campo (`pagamentos/online/route.ts:189-203`, `pagamentos/[id]/cobranca/route.ts:69-83`): `pagamentoId, gateway, status, valor, linkCheckout, expiraEm, pagoEm, criadoEm, consultas[]`. **Não** inclui `referenciaExterna`, `pagamentoExternoId`, `statusExterno` nem objeto do gateway. O payload dos webhooks é sanitizado antes de virar `EventoPagamento.payload`: MP `{type, action, dataId}`, Asaas `{event, paymentId, status}` — sem `payer`, `card` ou `identification` (verificado no banco após o webhook real). E2E: resposta da geração de cobrança sem ids de gateway.

### M8 · Cabeçalhos de segurança HTTP ausentes — ABERTO
- **Risco:** `next.config.ts` não define `headers()` — sem `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`. O SDK JS do MP e o iframe do Google Maps exigem CSP explícita.
- **Onde:** `next.config.ts`.
- **Fase:** 6 (deploy) — HSTS e CSP (com `sdk.mercadopago.com`, `www.google.com/maps`).

### M9 · Build ignora erros de tipo e lint — ABERTO
- **Risco:** `typescript.ignoreBuildErrors` e `eslint.ignoreDuringBuilds` deixam código quebrado ir a produção (hoje `tsc`/`lint` passam limpos — a flag só esconde regressões futuras).
- **Onde:** `next.config.ts` linhas 7 e 12.
- **Fase:** 6 — remover as duas flags antes do primeiro deploy do sistema novo.

### R-M11 · Persistência em JSON no servidor de produção (era M10) — RESOLVIDO (Fase 5b)
- **Era:** `pagamento-checkout` e `pagamento-direto` liam/escreviam `src/data/consultas.json` com `fs`, fora de transação e sem relação com a tabela `consulta` do Prisma.
- **Resolução:** as duas rotas foram removidas. `grep -rn "from 'fs'|node:fs|src/data" src/` → apenas `src/lib/documentos/armazenamento.ts:3-4` (documentos clínicos, por design). Todo o fluxo de pagamento é Prisma/PostgreSQL. **Higiene restante (não bloqueante):** `src/data/*.json` continuam commitados sem consumidor — apagar do repositório (linha no checklist da Fase 6).

### M11 · CSRF — ACEITO com mitigação estrutural
- **Risco:** API baseada em cookie de sessão. Mitigação: `sameSite=lax` (bloqueia envio do cookie em POST cross-site), rotas mutáveis aceitam só `application/json` (formulário HTML cross-site não envia JSON). Sem token CSRF dedicado.
- **Onde:** `src/lib/auth/cookie.ts`.
- **Reavaliar** se algum endpoint passar a aceitar `form-urlencoded` ou se `sameSite` mudar.

- **Nota Documentos clínicos:** `POST /api/documentos` aceita `multipart/form-data` (um `<form>` cross-site consegue enviar) — o gatilho de reavaliação disparou. A mitigação restante é `sameSite=lax` (bloqueia o cookie em POST cross-site em todos os navegadores atuais); PATCH/DELETE seguem só JSON. Permanece ACEITO. Hardening barato e recomendado: no POST de upload, responder 403 se `Sec-Fetch-Site: cross-site` ou `Origin` presente e diferente da própria origem.
### R-M12 · Fallback `http://localhost:3000` para `NEXT_PUBLIC_URL` (era M12) — RESOLVIDO (Fase 5b)
- **Era:** se a env faltasse, `back_urls`/`notification_url` apontavam para localhost e o webhook nunca chegava.
- **Resolução:** `baseUrlPublica()` (`src/lib/pagamentos/gateways/config.ts:15-27`) usa `envObrigatoria('NEXT_PUBLIC_URL')`, valida com `new URL()` e, em `NODE_ENV=production`, **exige https** — qualquer desvio lança `ErroConfiguracaoGateway`, que vira 502 genérico (fail-closed). `grep -rn "localhost:3000" src/` → zero.

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
### M22 · Migration 1:N sem backfill e com coluna NOT NULL sem default — ABERTO *(novo na Fase 5a)*
- **Risco:** `prisma/migrations/20260921233948_pagamento_1n_manual/migration.sql` faz `ALTER TABLE "pagamento" DROP COLUMN "consulta_id"` e `ADD COLUMN "origem" ... NOT NULL` **sem default e sem backfill**. Em um banco com linhas em `pagamento`, `prisma migrate deploy` **aborta**; e se a coluna ganhar um default só para destravar, o vínculo pagamento→consulta anterior é perdido, fazendo consultas já quitadas reaparecerem em "em aberto" — risco de cobrar duas vezes.
- **Onde:** `prisma/migrations/20260921233948_pagamento_1n_manual/migration.sql` linhas 5, 34-36, 44-47.
- **Mitigação atual:** `pagamento` está vazia em desenvolvimento.
- **Fase:** 6 (deploy) — antes do primeiro `migrate deploy` em produção, confirmar `SELECT count(*) FROM pagamento` = 0; se houver linhas, escrever migration de backfill (`UPDATE consulta SET pagamento_id = p.id FROM pagamento p WHERE p.consulta_id = consulta.id;` + `origem` nas linhas existentes) antes do `DROP COLUMN`.

### M23 · Estorno valida o estado fora da transação — ABERTO *(novo na Fase 5a)*
- **Risco:** `POST /api/pagamentos/[id]/estornar` lê `origem`/`status` com um `findUnique` fora da transação e só depois abre a transação (sem `Serializable`). Dois estornos simultâneos passam ambos pela guarda: os dois respondem 200, `estornadoEm` é sobrescrito e a observação de estorno pode ser duplicada ou perdida. Impacto é de trilha de auditoria, não de dinheiro (as consultas ficam desvinculadas em ambos os casos).
- **Onde:** `src/app/api/pagamentos/[id]/estornar/route.ts` linhas 37-46 e 52-59.
- **Fase:** 5b — `tx.pagamento.updateMany({ where: { id, origem: 'manual', status: 'pago' }, ... })` dentro da transação, 409 quando `count === 0`, `Serializable` + P2034, como em `pagamentos/manual`.

### R-M13 · `PATCH /api/consultas/[id]/valor` — checagem de "já paga" fora de transação (era M24) — RESOLVIDO (Fase 5b)
- **Era:** `findUnique` fora de transação e `update` sem repetir a condição; um `POST /api/pagamentos/manual` concorrente fechava o pagamento entre as duas queries.
- **Resolução:** `src/app/api/consultas/[id]/valor/route.ts:42-55` passou a `updateMany({ where: { id, pagamentoId: null }, data: { valor } })`; `count === 0` distingue inexistente (404) de já cobrada (409) com um `findUnique` depois do fato. A condição é atômica no banco — não há mais janela entre checar e gravar.

### R-M14 · Fluxo online cobrava o valor padrão e ignorava consulta já paga (era M25) — RESOLVIDO (Fase 5b)
- **Era:** as rotas do MP usavam só `Configuracao.valorPadraoSessao`, sem ler `Consulta.valor` nem checar `Consulta.pagamentoId`.
- **Resolução:** `POST /api/pagamentos/online` calcula, **dentro de transação Serializable**, `soma(Consulta.valor ?? Configuracao.valorPadraoSessao)` (`:127-132`), grava o valor cobrado em `Pagamento.valor` (:141) e é esse valor que vai ao gateway (:172-177). Consulta já cobrada/paga → 409 `JA_PAGA` (`:112-115`, reforçado por `updateMany({ where: { pagamentoId: null } })` com `count` conferido e P2034); cancelada/não compareceu → 409 `NAO_COBRAVEL`; consultas de pacientes diferentes → 400. O body **não** tem campo `valor`. E2E: body com `valor: 1` ignorado, cobrança gerada com R$ 150 (valor personalizado da consulta).

### M26 · Cobrança online não paga prende a consulta — ABERTO *(novo na Fase 5b)*
- **Risco:** uma consulta com cobrança online `pendente`/`expirado` fica com `Consulta.pagamentoId != null` indefinidamente e não tem saída: some de `GET /api/pagamentos/em-aberto` (filtro `pagamentoId: null`), `POST /api/pagamentos/manual` e `POST /api/pagamentos/online` respondem 409 `JA_PAGA`, e `POST /api/pagamentos/[id]/estornar` recusa por `origem !== 'manual' || status !== 'pago'`. Não existe rota para cancelar/expirar cobrança online. Consequência prática: paciente que não pagou o link e depois pagou em dinheiro **não pode ser registrado**, e a consulta desaparece do Financeiro — receita perdida e estado inconsistente, não manipulação pelo cliente.
- **Onde:** `src/app/api/pagamentos/online/route.ts:112-115`; `src/app/api/pagamentos/[id]/estornar/route.ts:44-46`; `src/app/api/pagamentos/em-aberto/route.ts:36-37`.
- **Fase:** 5b/6 — `POST /api/pagamentos/[id]/cancelar` (psicóloga) para `origem: 'online'` e `status in ('pendente','expirado','falhou')`, com `updateMany` condicional + `consulta.updateMany({ pagamentoId: null })` na mesma transação Serializable; e/ou listar cobranças online não pagas na tela "em aberto" com badge própria.

### M27 · Janela "cobrança viva com Pagamento marcado `falhou`" — ABERTO *(novo na Fase 5b)*
- **Risco:** se `gerarCobranca` lançar **depois** de o gateway já ter criado a cobrança (timeout na resposta) ou se o `update` seguinte falhar, o catch marca o Pagamento como `falhou` e **desvincula as consultas** (`src/app/api/pagamentos/online/route.ts:206-216`), mas o link continua válido no gateway com `external_reference` = nosso `pagamentoId`. Se o paciente pagar esse link, o webhook resolve o Pagamento e `aplicarStatusExterno` promove `falhou → pago` (o guarda só bloqueia a saída de `pago`) **sem nenhuma consulta vinculada**: dinheiro recebido, consulta continua "em aberto" e pode ser cobrada de novo.
- **Onde:** `src/app/api/pagamentos/online/route.ts:172-216`; `src/lib/pagamentos/conciliacao.ts:76-86`.
- **Mitigação atual:** o evento fica registrado em `EventoPagamento`, permitindo conciliação manual; a janela exige falha de rede/banco exatamente entre a criação no gateway e a gravação.
- **Fase:** 5b/6 — recusar a transição para `pago` quando o Pagamento está `falhou`/`cancelado` e sem consultas vinculadas (gravar o evento e alertar, em vez de confirmar); e/ou só marcar `falhou` quando `referenciaExterna` continuar nula.

### INFORMATIVOS (LOW, não contam no Resumo) — Fase 5b
- **I18 · Dedupe do MP por `x-request-id`** (`src/lib/pagamentos/gateways/mercadopago.ts:143`): o MP tende a emitir um novo `x-request-id` a cada reentrega, então o dedupe por `EventoPagamento.notificacaoExternaId @unique` cobre o reenvio idêntico (testado), não necessariamente a reentrega real. Sem risco de dupla confirmação (`pago` terminal + `updateMany` condicional); o efeito é linha extra em `EventoPagamento`. Melhoria: usar `data.id + action`.
- **I19 · `data.id` lido só da query string** (`gateways/mercadopago.ts:115`): notificação que traga o id apenas no corpo é rejeitada com 401 e depende da reconciliação. Disponibilidade, não segurança.
- **I20 · P2002 genérico tratado como "duplicado"** (`src/lib/pagamentos/conciliacao.ts:111-115`): colisão real de `Pagamento.pagamentoExternoId` seria silenciada como reentrega. Distinguir por `error.meta.target`.
- **I21 · `buscarReferenciaPropria` não afirma a invariante de origem** (`src/app/api/webhooks/mercadopago/route.ts:74`): resolve o Pagamento por `external_reference` sem filtrar `origem: 'online'`/`gateway: 'mercadopago'`. Não explorável hoje; filtro barato.
- **I22 · Reconciliação sob demanda disparável pelo paciente:** o dono de uma cobrança pode forçar consulta ao gateway a cada 60 s (`conciliacao.ts:120,140-144`). Amplificação limitada ao próprio pagamento.
- **I23 · Webhooks públicos sem rate limit próprio:** mitigado por a validação de assinatura/token ser a primeira operação, antes de banco ou gateway — flood inválido custa só HMAC. Limite no proxy junto com A1.
- **I24 · `sandbox_init_point` com credencial de teste** (`gateways/mercadopago.ts:66-72`): com `MP_ACCESS_TOKEN` começando em `TEST-`, o link devolvido é o de sandbox; em produção (`APP_USR-`) é sempre `init_point`. A escolha deriva da credencial, nunca de input.

### INFORMATIVOS (LOW, não contam no Resumo) — Fase 5a
- **I12 · Pagamento `pendente` ligado à consulta é ambíguo — RESOLVIDO (Fase 5b):** `CobrancaConsulta.situacao` ganhou o estado `aguardando` (`src/types/pagamento.ts`), definido em `montarCobranca` como "tem `Pagamento` `origem: 'online'` com `status: 'pendente'`" (`src/lib/pagamentos/cobranca.ts:68-85`), com `linkCheckout` exposto **apenas** nesse estado; UI mostra "Aguardando pagamento" + botão Pagar. Ressalva nova: M26. *(texto original abaixo)*  `montarCobranca` só considera `status === 'pago'` (`src/lib/pagamentos/cobranca.ts:59-68`), enquanto `GET /api/pagamentos/em-aberto` filtra `pagamentoId: null` e `POST /api/pagamentos/manual` recusa qualquer `pagamentoId != null` com `JA_PAGA`. Uma consulta com pagamento online **pendente** some da lista de em aberto, continua exibindo "em aberto" e não aceita registro manual. Definir a semântica na 5b.
- **I13 · `cobranca.pagamentoId` e `valorPersonalizado` chegam ao paciente** (`src/lib/agenda/consultas.ts:106-125`). Nenhuma rota permite ao paciente usar esse id; omitir no DTO do paciente é higiene de superfície.
- **I14 · Fallback silencioso para R$ 200 e função duplicada:** `obterValorPadraoSessao` existe em `src/lib/pagamentos/valor-padrao.ts:6` e `src/lib/pagamentos/cobranca.ts:13`, ambas devolvendo 200 se `Configuracao(id=1)` não existir. Unificar e responder 500 (ausência de configuração é erro de operação).
- **I15 · P2034 mapeado como `JA_PAGA`** (`src/app/api/pagamentos/manual/route.ts:183-185`): falha de serialização por contenção devolve mensagem incorreta.
- **I16 · `recebidoEm` com dois formatos:** documentado como `YYYY-MM-DD` mas cai para `pagoEm.toISOString()` quando nulo (`src/lib/pagamentos/cobranca.ts:74-75`).
- **I17 · `onDelete: SetNull` em `Consulta.pagamentoId`** (`prisma/schema.prisma:318`): apagar um `Pagamento` desvincularia as consultas silenciosamente. Invariante a registrar: pagamento nunca é deletado, só estornado.

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

## Pagamento (Fase 5a) — modelo e controles

A Fase 5a implantou **apenas o pagamento MANUAL** (a psicóloga registra o que recebeu por PIX, dinheiro, maquininha ou outro) e a fundação de modelo para o fluxo online da 5b. O relacionamento `Pagamento ↔ Consulta` deixou de ser **1:1** (`Pagamento.consultaId @unique`) e passou a **1:N** por FK do lado da consulta (`Consulta.pagamentoId`, `onDelete: SetNull`, migration `20260921233948_pagamento_1n_manual`): **um** pagamento cobre **uma ou várias** consultas (pacote/quitação), e a FK continua garantindo no banco que uma consulta tem **no máximo um** pagamento. Novos elementos: enums `OrigemPagamento { manual, online }`, `GatewayPagamento { mercadopago, asaas }`, `MetodoPagamento` + `dinheiro`/`maquininha`, `PagamentoStatus` + `estornado`; `Consulta.valor Decimal?`; `Pagamento.recebidoEm @db.Date` e `estornadoEm`; `Configuracao.gatewayPadrao`. Rotas novas, **todas** `requireAuth(request, 'psicologa')`: `POST /api/pagamentos/manual`, `POST /api/pagamentos/[id]/estornar`, `GET /api/pagamentos`, `GET /api/pagamentos/em-aberto`, `GET /api/configuracao`, `PATCH /api/consultas/[id]/valor`. O paciente **só lê** o status (`cobranca` embutida no DTO das próprias consultas). Auditado em 2026-09-25 (`code-reviewer-security`), com E2E Playwright 25/25 contra **build de produção**. Commit `86ba8a2`.

**Idempotência na aplicação:** o `@unique` da relação 1:1 era o que impedia dois pagamentos para a mesma consulta. Com 1:N essa garantia passou a ser da aplicação: o registro manual roda em transação **Serializable** e atualiza as consultas com `updateMany({ where: { id: { in: consultaIds }, pagamentoId: null } })`, exigindo `count === consultaIds.length`; se qualquer consulta já tiver sido paga por uma requisição concorrente, a transação é revertida e a resposta é `409 JA_PAGA` (P2034 idem). A FK `Consulta.pagamentoId` permanece como rede de segurança no banco.

| Controle | Status | Evidência |
|---|---|---|
| (a) Nenhum valor de cobrança vem do cliente | **CONFIRMADO** | `Configuracao.valorPadraoSessao` como fonte única (`src/lib/pagamentos/valor-padrao.ts`, `cobranca.ts:13-17`), consultada por `api/pagamento/route.ts:21`, `pagamento-checkout/route.ts:44` e `:162`, `pagamento-direto/route.ts:43`; no manual, default = soma de `Consulta.valor ?? padrão` **dentro** da transação (`pagamentos/manual/route.ts:126-131`). `valor` no body só existe em rotas `'psicologa'`, com teto `PAGAMENTO_VALOR_MAX`. `grep "150"`: zero. Fecha C3 (→ R-C4). Ressalva: M25. |
| (b) Marcar pago é exclusivo da psicóloga | **CONFIRMADO** | `requireAuth(request, 'psicologa')` em `pagamentos/manual:31`, `pagamentos/[id]/estornar:16`, `pagamentos/route.ts:14`, `em-aberto:15`, `consultas/[id]/valor:22`, `configuracao:9`. Papel resolvido no banco a cada request (`src/lib/auth/guard.ts:16-27`). E2E: paciente recebe 403 nas seis rotas. |
| (c) Paciente vê só o status das próprias consultas | **CONFIRMADO** | `paciente/me/consultas:13-41` e `consultas/route.ts:53-66` forçam `pacienteId: auth.pacienteId` (o `?pacienteId=` só existe no ramo psicóloga). `SELECT_COBRANCA` (`cobranca.ts:20-32`) traz do `Pagamento` só `id, status, metodo, recebidoEm, pagoEm` — sem `geradoPorId`, `mp*`, `linkCobranca`, `observacao`. Ressalva LOW: I13. |
| (d) 1:N não abriu brecha de pagar duas vezes | **CONFIRMADO com ressalvas** | `pagamentos/manual/route.ts:101,159` (Serializable), `:148-155` (`updateMany` com `pagamentoId: null` + `count` conferido → 409 JA_PAGA), `:183-185` (P2034). FK `Consulta.pagamentoId` como rede de segurança. Estorno devolve as consultas a "em aberto". Ressalvas: M22, M23, M24, I12, I17. |
| (e) Sem mass assignment | **CONFIRMADO** | `data` montado campo a campo com `geradoPorId: auth.usuarioId` da sessão (`manual:135-146`); zero spread de body; validação campo a campo com limites (50 consultas, teto de valor, `observacao` ≤ 500, `motivo` ≤ 300); listagens com `take` 200/500; `catch` genérico; nenhum `console.*`. |

**Fuso (America/Sao_Paulo):** `recebidoEm` é `@db.Date` gravado como `T00:00:00.000Z` e relido com getters UTC — round-trip estável; `pagoEm` usa offset fixo `-03:00`; "data não futura" compara com o dia local.

**Relação com itens existentes:** R-C4 fecha C3. C1, C2 e A4 **não foram tocados** pela 5a e seguem ABERTOS para a Fase 5b, junto com A5, A6, M6, M7, M10 e M12. Novos: M22, M23, M24, M25 e os informativos I12-I17.

---

## Pagamento online (Fase 5b) — gateways, webhook e conciliação

A Fase 5b substituiu **todo** o pagamento online legado por um modelo de **checkout hospedado** (MercadoPago Checkout Pro e link de pagamento Asaas): a aplicação nunca vê dados de cartão, nunca recebe status do cliente e nunca calcula valor a partir do body. Foram **removidos** `src/app/api/pagamento/route.ts`, `pagamento-checkout/route.ts`, `pagamento-direto/route.ts`, `mercadopago/route.ts`, `src/components/CheckoutTransparente.tsx` e `src/lib/pagamentos/valor-padrao.ts` — o que fecha C1, C2, A4, A5, A6, M6, M7, M10 e M12.

**Arquitetura de adaptadores.** `src/lib/pagamentos/gateways/tipos.ts` define a interface `GatewayPagamentoAdapter` (`gerarCobranca`, `consultarStatus`, `validarWebhook`) e os tipos normalizados `StatusExterno`/`CobrancaCriada`/`EventoWebhook`; `mercadopago.ts` e `asaas.ts` implementam; `index.ts` resolve pelo enum `GatewayPagamento`. Todos começam com `import 'server-only'`. `config.ts` centraliza a leitura de env: `envObrigatoria()` **nunca** faz fallback e `baseUrlPublica()` exige `NEXT_PUBLIC_URL` válida (https em produção). O gateway efetivo vem de `Configuracao.gatewayPadrao`, sobrescrito opcionalmente pelo body — é o **único** parâmetro de pagamento que o cliente influencia, e só a psicóloga pode enviá-lo.

**Modelo** (migration `20260925120000_pagamento_online_gateways`): os campos `mp*` deram lugar a genéricos — `gateway`, `referenciaExterna @unique` (id da COBRANÇA), `pagamentoExternoId @unique` (id do PAGAMENTO aprovado; âncora de idempotência), `statusExterno`, `statusExternoDetalhe`, `linkCheckout`, `expiraEm`, `ultimaReconciliacaoEm`, com índice `(status, ultimaReconciliacaoEm)`. `EventoPagamento` ganhou `gateway` e `notificacaoExternaId @unique` (dedupe) e guarda payload **sanitizado**.

**Fluxo.** (1) Psicóloga seleciona consultas em aberto do mesmo paciente e chama `POST /api/pagamentos/online`. (2) Em transação **Serializable**: valida existência, mesmo paciente, status cobrável e `pagamentoId: null`; calcula `soma(Consulta.valor ?? Configuracao.valorPadraoSessao)`; cria o `Pagamento` e vincula as consultas com `updateMany` condicional. (3) **Fora** da transação chama o gateway; em falha, o Pagamento vira `falhou`, as consultas são desvinculadas e a resposta é `502` genérico (ressalva: M27). (4) O paciente recebe o link (WhatsApp pela psicóloga ou botão "Pagar" na área dele) e paga **no domínio do gateway**. (5) O gateway notifica `POST /api/webhooks/{mercadopago,asaas}`: assinatura validada → status **buscado no gateway** → `aplicarStatusExterno`. (6) Como rede de segurança, `GET /api/pagamentos/[id]/cobranca` reconcilia sob demanda (no máximo 1×/60 s por pagamento).

**Idempotência e concorrência.** `aplicarStatusExterno` roda em transação Serializable: dedupe por `notificacaoExternaId`; `pago` é **terminal**; escrita por `updateMany({ where: { id, status: { not: 'pago' } } })` com `count === 0` interpretado como concorrência benigna; `P2002` → duplicado; `P2034` tratado nas rotas. Valor menor que o devido nunca confirma.

| Eixo | Status | Evidência |
|---|---|---|
| (a) IDOR — id do cliente só com dono conferido | **CONFIRMADO** | `pagamentos/[id]/cobranca/route.ts:13-46` (401 anônimo → 404 idêntico para inexistente/não-online/não-dono); demais rotas `'psicologa'`; rotas legadas removidas (grep zero). Fecha C1 (→ R-C5). |
| (b) Status só por webhook validado + `external_reference` | **CONFIRMADO** | Nenhuma rota aceita `paymentId`/`status` do cliente; `webhooks/mercadopago/route.ts:28-37`, `webhooks/asaas/route.ts:25-39`; `conciliacao.ts:66-74` recusa subpagamento. Fecha C2 (→ R-C6). |
| (c) Autenticidade do webhook antes de gravar | **CONFIRMADO (Asaas só por código)** | HMAC-SHA256 + `timingSafeEqual` + janela ±10 min (`gateways/mercadopago.ts:106-148`); `asaas-access-token` timing-safe (`gateways/asaas.ts:123-144`); segredo ausente → 401 fail-closed. Fecha A4 (→ R-A5). |
| (d) Valor sempre do banco, gravado em `Pagamento.valor` | **CONFIRMADO** | `pagamentos/online/route.ts:127-141` em transação Serializable; body sem campo `valor`; já cobrada → 409. Fecha M25 (→ R-M14), mantém R-C4. |
| (e) Idempotência (reentrega, concorrência, terminalidade) | **CONFIRMADO com ressalvas** | `conciliacao.ts:29-38, 46-62, 76-89, 111-115`. Ressalvas: I18, I20. |
| (f) Segredos e vazamento | **CONFIRMADO** | Credenciais só em `src/lib/pagamentos/gateways/*` e `api/webhooks/*`; zero `NEXT_PUBLIC_*` de credencial; DTO sem ids de gateway; payload sanitizado; 502 genérico; `console.error` sem ids. Fecha A5, A6, M6, M7, M12. |

**Cobertura de teste (2026-09-25).** E2E 22/22 contra **build de produção** com `MP_ACCESS_TOKEN` de teste real (preference efetivamente criada) e 7/7 no núcleo de conciliação. **Com dados reais do MercadoPago**, via túnel público e a chave secreta do painel: pagamento PIX real criado no sandbox com `external_reference` = nosso `pagamentoId`; webhook assinado → 200 e status buscado no MP (`pagamentoExternoId` e `statusExterno` gravados); segredo errado → 401; evento alheio → 200 sem gravar; reentrega → `duplicado` com 1 único evento. **Não exercitado:** pagamento **aprovado** ponta a ponta (o sandbox desta conta recusa cartão com `excludes_by_rule` e o checkout hospedado não abre — configuração da conta de teste) e **o Asaas inteiro** (sem credenciais). Por isso R-C6 e R-A5 registram verificação pendente, e o checklist da Fase 6 exige repetir o teste com os dois gateways antes de habilitá-los para paciente real.

**Relação com itens existentes:** fechados nesta fase C1 (→ R-C5), C2 (→ R-C6), A4 (→ R-A5), A5 (→ R-A6), A6 (→ R-A7), M6 (→ R-M9), M7 (→ R-M10), M10 (→ R-M11), M12 (→ R-M12), M24 (→ R-M13), M25 (→ R-M14), I12. Seguem ABERTOS e **não foram tocados**: M23, M22, A1/A2/A3. Novos: M26, M27, I18-I24.

---

## Verificação de deploy (Fase 6) — checklist operacional

Complementa os itens acima; marcar cada linha no dia do deploy:

- [ ] Nenhum CRÍTICO/ALTO ABERTO neste arquivo.
- [ ] `NODE_ENV=production`; HTTPS com redirecionamento; HSTS (M8).
- [ ] Envs de produção distintas das de dev (A2); `.env*` fora do repo; `PSICOLOGA_SENHA_HASH` gerado com senha forte.
- [ ] Credenciais de **produção** dos dois gateways: `MP_ACCESS_TOKEN` (`APP_USR-…`) e `ASAAS_API_KEY` + `ASAAS_API_URL=https://api.asaas.com/v3`; credenciais de teste rotacionadas/revogadas (A3).
- [ ] `MP_WEBHOOK_SECRET` (painel MP → Webhooks → chave secreta) e `ASAAS_WEBHOOK_TOKEN` configurados — sem eles o webhook responde 401 a **tudo** (fail-closed, R-A5).
- [ ] URLs de webhook registradas nos dois painéis: `https://<domínio>/api/webhooks/mercadopago` e `https://<domínio>/api/webhooks/asaas` (só eventos de pagamento).
- [ ] `NEXT_PUBLIC_URL` com o **https real** do domínio (sem barra final): em produção a geração de cobrança falha se faltar ou não for https (R-M12).
- [ ] Teste ponta a ponta **com pagamento real de baixo valor em cada gateway**: cobrança gerada → paga no checkout hospedado → webhook aceito → `Pagamento.status = 'pago'` → consulta sai de "aguardando".
- [ ] Reentrega manual do mesmo evento pelo painel do gateway não duplica confirmação nem evento.
- [ ] Proxy com limite de taxa em `/api/webhooks/*` (I23).
- [ ] `src/data/*.json` removidos do repositório (sem consumidor desde a Fase 5b — R-M11).
- [ ] Procedimento documentado para cobrança online não paga enquanto M26 estiver aberto (como liberar a consulta para registro manual).
- [ ] PostgreSQL do VPS: acesso só local ou por rede privada, TLS se remoto, usuário da aplicação sem superuser, backups automáticos testados (restauração).
- [ ] `next.config.ts` sem `ignoreBuildErrors`/`ignoreDuringBuilds` (M9); `tsc` e `lint` limpos.
- [ ] `src/data/*.json` sem dado real (`consultas.json`, `notificacoes.json` fictícios ou vazios).
- [ ] Rota de anonimização LGPD existente e testada (C5).
- [ ] Rate limiting ativo no login (A1).
- [ ] `pagamento` vazia antes do `migrate deploy`, ou migration de backfill de `consulta.pagamento_id` aplicada (M22).
- [ ] `DOCUMENTOS_DIR` com caminho absoluto, fora da web root e do repositório; nenhum alias/location do proxy apontando para ela (A8).
- [ ] `DOCUMENTOS_DIR` com `chown` do usuário do app e `chmod 700`; disco/volume criptografado (A8).
- [ ] `DOCUMENTOS_DIR` incluída no backup criptografado, na mesma janela do `pg_dump` (A7).
- [ ] Restauração testada: banco + pasta em ambiente limpo, download de um documento OK (A7).
- [ ] `client_max_body_size` no proxy ≥ `DOCUMENTOS_MAX_MB` + folga (M19).
- [ ] Rotina de reconciliação de órfãos em `DOCUMENTOS_DIR` disponível e executada após anonimizações (M20/C5).
