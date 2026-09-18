# PLANO de reconstrução — psi-maria-cristina

Levantamento feito em 2026-09-17 sobre o commit `429e4bd`. Nenhum arquivo de código foi alterado. Fontes: código ativo, o código comentado de `src/app/area-restrita/page.tsx` (2.934 linhas) e de `src/app/agendamento/page.tsx`, histórico git, arquivos de `src/data/`.

Legenda usada ao longo do documento:
- **[fato]** — está no código, ativo ou comentado.
- **[inferência]** — deduzido de nomes, placeholders ou contexto; pode estar errado.
- **[ambíguo]** — o código diz duas coisas diferentes; a decisão é sua.
- **[dívida]** — pré-existente, conhecida, a corrigir (não a preservar).

---

## 0. Resumo executivo

O repositório contém **dois produtos sobrepostos**:

1. **Protótipo 1** (commit `7d57efe`, set/2025): fluxo completo *agendamento → API → credenciais → área restrita → pagamento MercadoPago*, com dashboard da psicóloga. Funcionava contra JSONs locais.
2. **Pivô WhatsApp** (commit `776ff49`, jan/2026): a página pública de agendamento passou a abrir `wa.me` com os dados do formulário; **no mesmo commit** a área restrita inteira e a chamada a `/api/agendamento` foram comentadas, e o link para `/area-restrita` na home também. O protótipo 1 ficou "adormecido", não removido.

Os placeholders (`login/page.tsx`, `LoginForm.tsx`, `AuthContext.tsx`, `api/auth/login`, `api/auth/validate`, `api/mercadopago`, `pagamento/{sucesso,pendente,falha}`) **nunca tiveram conteúdo** em nenhum commit — são intenção de refatoração, não código perdido.

Fato estrutural decisivo: o site está publicado na **Vercel** (`.vercel` no `.gitignore`, URL `psi-maria-cristina.vercel.app` nos metadados). Em serverless da Vercel o filesystem é efêmero/somente-leitura fora de `/tmp`: **todo `writeFileSync` em `src/data/*.json` (agendamento, horários, notificações, status de pagamento) não persiste em produção.** O protótipo 1 só funcionava em `localhost`. Isso torna a decisão D1 (storage) pré-requisito de tudo.

---

## 1. Intenção legada

### 1.1 Fluxo pretendido (reconstruído) [fato, a partir do código comentado]

```
Visitante ──/agendamento──► escolhe data/hora (CalendarioAgendamento → GET /api/disponibilidade, GET /api/horarios?data=&disponiveis=true)
           ──► preenche dados (nome, email, telefone, nascimento, CPF, responsável se menor)
           ──► POST /api/agendamento { paciente, data, hora }
                 servidor: cria/acha paciente por email, cria consulta (agendada/pendente), cria notificação,
                           [opcional] cria Preference MP se metodoPagamento vier no body
                 resposta: { consulta, paciente, acessoAreaRestrita: { email, senha: id.slice(-8) }, pagamento }
           ──► passo 3 da página mostra "ID da consulta", email e SENHA em texto puro + link para /area-restrita

Paciente ──/area-restrita──► login (tipo=paciente, email, senha=id.slice(-8)) → POST /api/area-restrita
           ──► abas: Próximas Consultas | Histórico | Pagamentos | Nova Consulta
                 Pagamentos → "Pagar Agora" → <CheckoutTransparente> (PIX ou cartão) → /api/pagamento-checkout
                 Nova Consulta → POST /api/agendamento reutilizando os dados do paciente logado

Psicóloga ──/area-restrita──► login (tipo=psicologa, credenciais fixas) → POST /api/area-restrita
           ──► abas: Dashboard | Consultas | Pacientes | Horários | Calendário
```

### 1.2 Agendamento público — o que a página fazia antes do pivô [fato]

- `handleSubmit` validava o formulário e fazia `POST /api/agendamento` com `{ paciente: formData, data, hora }`; em `response.ok` guardava o resultado em `agendamentoRealizado` e ia para `step 3`.
- **Passo 3 ainda existe no código ativo** (linhas ~562–620), mas é inalcançável: exibe data, hora, nome, **ID da consulta**, aviso "o pagamento deve ser realizado na área do paciente" e as **credenciais de acesso (email + senha em texto puro)** com link para `/area-restrita`.
- O pivô adicionou ao formulário os campos `tipo` (Presencial/Online), `motivo` (select) e `observacoes` — que **não existem** em `Paciente`/`Consulta` (`src/types`) nem no body aceito por `/api/agendamento`. Se a API voltar, esses campos ou entram no modelo ou se perdem.
- O `metodoPagamento` que `/api/agendamento` aceita (para criar Preference) **nunca foi enviado por nenhuma tela** — nem a pública nem a "Nova Consulta" da área do paciente.

### 1.3 Área restrita — o que fazia [fato, código comentado]

**Login (raiz da página).** Formulário com `select tipo` (paciente/psicóloga), email, senha → `POST /api/area-restrita`. Estado logado só em `useState` (`isLoggedIn`, `userType`, `userData`); F5 desloga. `NotificacaoProvider` envolve tudo.

**Área do Paciente (`AreaPaciente`)** — recebe `userData = { paciente, consultas }`:
| Aba | Comportamento |
|---|---|
| Próximas Consultas | filtra `status ∈ {agendada, confirmada}` e `data >= hoje`; cada item é um `<GerenciadorConsultas mostrarPaciente={false} onPagarConsulta>` (remarcar / cancelar / pagar). Vazio → botões "Nova Consulta (Rápida)" e link para `/agendamento`. |
| Histórico | `status ∈ {realizada, cancelada, nao_compareceu}` ou data passada; mostra status, pagamento, "Valor: R$ 150,00" fixo e `relatorio` se houver. |
| Pagamentos | lista **todas** as consultas; `pendente` → "Vencimento: {data}" + botão **Pagar Agora** (abre `CheckoutTransparente`); `pago` → "Pago em {criadaEm}" (usa a data de criação da consulta, não `pagamentoData`). Rodapé: "PIX – aprovação instantânea", "Cartão – até 12x". |
| Nova Consulta | componente `NovaConsulta`: passo 1 `CalendarioAgendamento`, passo 2 confirmação ("pagamento na aba Pagamentos", "link da consulta próximo ao horário"), `POST /api/agendamento` reaproveitando os dados do paciente logado; passo 3 sucesso com "Ir para Pagamentos". |
| "Recarregar dados" | refaz o `POST` de login com `senha: id.slice(-8)` (não havia endpoint de leitura por paciente). |

**Área da Psicóloga (`AreaPsicologa`)** — recebe `userData = { tipo, nome }`:
| Aba | Comportamento |
|---|---|
| Dashboard | `GET /api/area-restrita?action=dashboard` → cards (consultas hoje, próximos 7 dias, total de pacientes, notificações não lidas); lista "Consultas de Hoje" com `<GerenciadorConsultas mostrarPaciente>`; notificações recentes com "marcar lida"/"marcar todas" via `PATCH`. |
| Consultas | `GET ?action=consultas` (consulta + paciente embutido). Botões **Editar** (modal: status, pagamento, linkMeet, observacoes, relatorio → `PUT /api/area-restrita {consultaId, updates}`) e **Iniciar** (gera `https://meet.google.com/<string aleatória>` — **não é um Meet real**) e "Abrir Meet". |
| Pacientes | `GET ?action=pacientes` lista; "Ver Detalhes" → `GET ?action=pacientes&id=` mostra nome, email, telefone, **CPF**, nascimento, responsável e todas as consultas com observações/relatório. |
| Horários | `GET /api/horarios`; criar único (`data+hora`) ou recorrente (`diaSemana+hora`); **modo rápido**: "09:00, 10:00, 14:00" → N `POST` em paralelo; deletar via `DELETE /api/horarios?id=`. Agrupa por `unico-<data>` / `recorrente-<diaSemana>`. |
| Calendário | `<Calendario>` com dias que têm consulta e dias com horário único ativo; clicar no dia lista as consultas (hora, nome, status, pagamento). |

**Componentes de apoio que a área restrita usa e que continuam ativos e íntegros:** `GerenciadorConsultas` (mudar status, cancelar, remarcar), `CalendarioAgendamento`, `Calendario`, `ModalConfirmacao` (`useModalConfirmacao`), `NotificacaoProvider`, `CheckoutTransparente`.

### 1.4 Placeholders — o que deveriam preencher [inferência]

Todos com 0 bytes desde `7d57efe`. A intenção só pode ser deduzida do nome e da posição:

| Placeholder | Intenção provável | Observação |
|---|---|---|
| `src/app/login/page.tsx` + `src/components/LoginForm.tsx` | Extrair o formulário de login da página `area-restrita` para uma rota própria `/login`, com o form como componente reutilizável. | O login legado vive embutido em `area-restrita/page.tsx`. Ter `/login` separado implica redirecionar `/area-restrita` quando não autenticado. |
| `src/contexts/AuthContext.tsx` | Substituir os `useState` locais (`isLoggedIn`, `userType`, `userData`) por um contexto global que sobreviva à navegação entre `/login`, `/area-restrita` e `/agendamento`. | Sozinho não sobrevive a F5 — precisa de sessão no servidor (D2). |
| `src/app/api/auth/login/route.ts` | Mover o `POST` de login para fora de `area-restrita/route.ts` (que hoje mistura login + CRUD). Aqui é onde `bcrypt` (instalado, não usado) entraria. | |
| `src/app/api/auth/validate/route.ts` | "Estou logado? quem sou?" — endpoint que o `AuthContext` chamaria ao montar para restaurar a sessão. | Implica que a intenção era **sessão persistente** (cookie/token), não só estado React. |
| `src/app/api/mercadopago/route.ts` | Ambíguo: ou o **webhook** que `pagamento/route.ts` referencia como `/api/pagamento/webhook`, ou uma consolidação das três rotas de pagamento. | Ver §2. |
| `src/app/pagamento/{sucesso,pendente,falha}/page.tsx` | Páginas de retorno do **Checkout Pro** (`back_urls`). | Contradiz o código: as `back_urls` em `pagamento/route.ts` apontam para `/area-restrita?pagamento=sucesso\|falhou\|pendente`, e a área restrita **nunca lê** `searchParams.pagamento`. |

### 1.5 Ambiguidades e contradições [ambíguo] — decida você

1. **Onde o pagamento acontece.** O passo 3 do agendamento público e a `NovaConsulta` dizem "pague na área do paciente" (Checkout Transparente, dentro do site). Mas `/api/agendamento` aceita `metodoPagamento` e cria uma Preference de **Checkout Pro** (redirect para o MP) com `back_urls`. Nenhuma tela envia `metodoPagamento`. Dois desenhos coexistem sem que nenhum esteja completo.
2. **Destino pós-pagamento.** `back_urls` → `/area-restrita?pagamento=…` (nunca lido) vs. páginas `pagamento/{sucesso,pendente,falha}` (vazias).
3. **Rota `/login` vs. login embutido.** O placeholder sugere rota própria; o código funcional tem o login dentro de `/area-restrita`. Se `/login` existir, `/area-restrita` precisa de guarda e redirect.
4. **Enum de status de consulta.** `src/types` tem 5 valores (`agendada | confirmada | cancelada | realizada | nao_compareceu`). `consultas/[id]/route.ts` e `GerenciadorConsultas` aceitam 4 (**sem `confirmada`**). `disponibilidade/route.ts` tem 4 (**sem `nao_compareceu`**) e bloqueia horário para qualquer status ≠ `cancelada`. A área da psicóloga usa `confirmada` no modal e no filtro. Não há definição única.
5. **Campo de observação.** `consultas/[id]` PUT grava `observacao` (singular); o tipo, a área da psicóloga e `area-restrita` PUT usam `observacoes`.
6. **"Iniciar consulta".** Gera um link `meet.google.com/<aleatório>` que não abre reunião nenhuma. Intenção era integração com Google Meet? Ou campo manual (o modal Editar já tem `linkMeet` editável)? Contradição interna.
7. **Remarcação.** `GerenciadorConsultas.remarcarConsulta` faz `DELETE /api/consultas/{id}` e depois `POST /api/consultas` — **rota que não existe** (só há `/api/consultas/[id]`). Em produção a consulta original seria apagada e a nova falharia; o "rollback" também chama a rota inexistente. Não está claro se a intenção era um `POST /api/consultas` novo ou reutilizar `POST /api/agendamento`.
8. **Ids de horário.** `horarios-disponiveis.json` tem 44 horários recorrentes com `id` **numérico** (1–44); o tipo e a rota criam `id` **string** (uuid). `DELETE /api/horarios?id=5` compara `h.id !== "5"` com `5` → nunca remove os seeds.
9. **`disponibilidade` ignora horários `unico`** (só considera `diaSemana`); `horarios?disponiveis=true` considera os dois. O calendário mensal e a lista do dia podem discordar.
10. **Quem cria a senha do paciente.** Legado: derivada do id e exibida na tela de sucesso do agendamento público. Não há fluxo de "definir senha", "esqueci a senha" nem cadastro separado. Se o agendamento continuar via WhatsApp (D3), **não existe momento em que o paciente recebe credencial**.
11. **Campos `tipo`/`motivo`/`observacoes`** do formulário atual: pertencem à consulta, ao paciente, ou só à mensagem de WhatsApp?
12. **`faturas.json`** existe, está vazio e não é referenciado. `config.json` tem `valorConsulta: 150` e `dadosPagamento` (PIX manual, banco) — nunca lidos. Duas fontes possíveis para "valor" e uma sugestão de PIX manual que o código ignora.
13. **Contato**: `config.json` diz `(11) 99999-9999` / `contato@psimariacristina.com`; a home diz `(61) 99539-1540` / `mariacriscassia02@gmail.com`; `pagamento/route.ts` credencia `psicologa@mariacristina.com`. Três identidades.

---

## 2. Pagamento

### 2.1 As rotas, hoje [fato]

| Rota | Métodos | O que faz hoje | Quem chama | Intenção aparente |
|---|---|---|---|---|
| `api/pagamento` | POST | Cria **Preference** (Checkout Pro): item "Consulta Psicológica – {nome}", `unit_price` = `valor` do body, `back_urls` → `/area-restrita?pagamento=…`, `auto_return: approved`, `external_reference = consultaId`, `notification_url` → `/api/pagamento/webhook`. Se `metodoPagamento === 'pix'`, exclui cartão/boleto. Devolve `preferenceId`, `initPoint`, `sandboxInitPoint`. | Só `api/agendamento` (fetch interno, e só se `metodoPagamento` vier — nunca vem). | Fluxo **Checkout Pro** (redirect para o MP). Primeira tentativa, abandonada. |
| `api/pagamento` | PUT | "Webhook": lê `{action, data}`, se `payment.created/updated` faz `console.log`. Não valida assinatura, não consulta o MP, não atualiza nada. | Ninguém (o MP chamaria `POST`, não `PUT`, e em outra URL). | Esboço de webhook. |
| `api/pagamento-checkout` | POST | Cria **Payment** com `token` de cartão (`payment_method_id` = bandeira, `installments`, `issuer_id` opcional) ou PIX. `approved` → grava `pagamento: 'pago'`, `pagamentoId`, `pagamentoData` na consulta. Devolve `payment: response` (objeto MP inteiro). | `CheckoutTransparente.processarPagamento` | **Checkout Transparente – cartão tokenizado.** |
| `api/pagamento-checkout` | GET | Cria Payment PIX (`transaction_amount: 150` fixo) e devolve `qrCode`, `qrCodeBase64`, `pixCopiaECola`, `paymentId`. | `CheckoutTransparente.gerarPixQRCode` | **Checkout Transparente – PIX.** |
| `api/pagamento-checkout` | PUT | `payment.get({ id })`; se `approved` marca a consulta como paga. | `CheckoutTransparente` (polling a cada 3 s por até 10 min) | **Confirmação por polling** — substituto do webhook. É o único mecanismo que fecha o PIX hoje. |
| `api/pagamento-direto` | POST | Cria Payment mandando **número, CVV, validade e titular crus** para o MP (`card: {...}`), detecta bandeira pelo primeiro dígito. Mascara no log. | **Ninguém.** Nenhum componente referencia. | Fallback para quando a tokenização no navegador falhava (o `CheckoutTransparente` tenta `createCardToken`, depois `fields`, depois `createToken` legacy — sinal de que o SDK deu trabalho). Código morto. |
| `api/mercadopago` | — | Vazio. | — | [inferência] webhook (`/api/mercadopago` é o nome usual) **ou** consolidação das três rotas. |

### 2.2 `CheckoutTransparente.tsx` [fato]

- Modal com duas abas: **PIX** (default) e **Cartão**. Carrega `https://sdk.mercadopago.com/js/v2` e faz `new window.MercadoPago('TEST-635a…')` — **public key literal** [dívida]; sobrescreve `window.MercadoPago` com a instância.
- PIX: GET → mostra QR + copia-e-cola → polling PUT a cada 3 s → `onPagamentoSucesso()` em `approved`. Se o usuário fechar o modal, o `setInterval` continua rodando até 10 min (não há cleanup no unmount).
- Cartão: valida tamanho/validade, tenta tokenizar por três APIs diferentes do SDK (com muitos `console.log` de dados do cartão — [dívida]: `console.log('Dados do cartão:', cardForm)` loga número e CVV no console do navegador), envia token para `/api/pagamento-checkout` com `valor: 150.00` **vindo do cliente**. Mapeia `status_detail` para mensagens em pt-BR.
- Sem `'use client'` (funciona porque só era importado pela página comentada, que é client).
- `dadosPagador.documento` = CPF do paciente sem máscara; é enviado no body como `identification.number`.

### 2.3 Webhook [fato]

`notification_url` → `${NEXT_PUBLIC_URL}/api/pagamento/webhook` — **não existe**. O MP receberia 404 e desistiria após retentativas. O único fechamento de pagamento que funciona é o polling do cliente (frágil: se o paciente fechar a aba após pagar PIX, a consulta fica `pendente` para sempre). Também: `NEXT_PUBLIC_URL` sem valor cai em `http://localhost:3000`, que o MP não alcança.

### 2.4 Decisões de pagamento que só você pode tomar

**P1 — Qual fluxo é o oficial?**
- (a) **Checkout Transparente** (PIX + cartão dentro do site; `pagamento-checkout` + `CheckoutTransparente`). Prós: UX contínua, PIX com QR na tela, já é o mais completo. Contras: exige PCI-lite (tokenização, nunca dados crus), exige manter o SDK JS, exige webhook ou polling.
- (b) **Checkout Pro** (redirect para o MP; `pagamento` POST + `back_urls`). Prós: zero manuseio de cartão, MP cuida da UI e antifraude, páginas `pagamento/*` ganham sentido. Contras: sai do site; PIX vira tela do MP; ainda precisa de webhook para saber que pagou.
- (c) **Os dois** (PIX transparente na tela + cartão via Pro, ou vice-versa). Custo: dois caminhos para manter.
- (d) **Nenhum / PIX manual** (chave em `config.json.dadosPagamento.pix`, psicóloga confirma à mão na aba Consultas). Coerente com o pivô WhatsApp; elimina o MP.

**P2 — O que fazer com `pagamento-direto`?** É código morto que transporta cartão cru. Remover, ou manter desativado "por via das dúvidas"? (Não há cenário em que o MP recomende esse fluxo para um site pequeno.)

**P3 — Confirmação: webhook, polling, ou ambos?** Com webhook (`POST`, assinatura `x-signature`, `payment.get`, idempotente), a consulta fica `pago` mesmo se o paciente fechar a aba. Só polling é mais simples, mas perde pagamentos. Ambos é o padrão do MP. Se webhook: implementar em `api/mercadopago` (placeholder) ou em `api/pagamento/webhook` (o que a Preference já referencia)?

**P4 — Onde fica o valor?** Hardcoded 150 em 3 lugares + `valor` aceito do body do cliente [dívida] vs. `config.json.valorConsulta`. Fonte única no servidor? E consultas com valor diferente (primeira sessão, pacote) existem?

**P5 — Depois de pagar, para onde vai?** `/area-restrita?pagamento=…` (legado) vs. `/pagamento/{sucesso,pendente,falha}` (placeholders). Depende de P1 (só faz sentido com Checkout Pro) e de D3.

**P6 — Ambiente.** Existe conta MP de produção? Vai ter `MP_ACCESS_TOKEN` de produção na Vercel, e `NEXT_PUBLIC_MP_PUBLIC_KEY`? Hoje só há credenciais de teste, e literais.

---

## 3. Decisões estruturais pendentes (bloqueiam a implementação)

### D1 — Storage de pacientes, consultas, horários e auth

Hoje: `src/data/*.json` + `fs`. **Não funciona na Vercel** (escrita não persiste; deploy sobrescreve). Dados reais de paciente (CPF, telefone) estão **commitados no git** [dívida].

| Opção | O que implica | Impacto no resto |
|---|---|---|
| **A. Manter JSON em `src/data/`** | Só funciona em servidor próprio/VPS com disco persistente (não Vercel). Sem concorrência segura (dois agendamentos simultâneos podem sobrescrever um ao outro). Dados sensíveis continuam no repositório a menos que se mova o diretório para fora e se `gitignore`. | Menor esforço de código; maior risco (LGPD, perda de dados). Exige mudar hospedagem ou aceitar que produção é read-only. |
| **B. Banco gerenciado (Postgres — Vercel Postgres/Neon/Supabase — ou Turso/SQLite remoto)** | Criar schema (`pacientes`, `consultas`, `horarios`, `notificacoes`, `pagamentos`), camada de acesso (Prisma/Drizzle/`pg`), migração dos JSONs, variáveis de ambiente. | **Reescreve todos os helpers `getX/saveX` de todas as rotas.** Habilita auth de verdade (senha hash por paciente), transações, e mantém a Vercel. É a mudança mais ampla, mas é pré-requisito de qualquer funcionalidade que grave. |
| **C. Serviço externo BaaS (Supabase/Firebase com auth embutida)** | Além do banco, delega login/sessão ao provedor (resolve D2 junto). | Menos código próprio de auth; acopla ao provedor; a área restrita passa a usar o SDK deles; o MP continua em route handlers. |
| **D. KV/Blob simples (Vercel KV/Blob, Upstash)** | Persistência chave-valor dos mesmos JSONs. | Mantém o formato atual quase intacto, resolve "não persiste", **não** resolve concorrência nem consultas relacionais (filtrar consultas por paciente vira carregar tudo). Adequado só se o volume for pequeno e assim continuar. |

Independente da opção: tirar os dados reais de paciente do git (e do histórico, se for o caso) é item do plano.

### D2 — Modelo de sessão

Hoje: nenhum. Estado em `useState`, F5 desloga, rotas de API abertas.

| Opção | Como funciona | Impacto |
|---|---|---|
| **A. Cookie de sessão assinado, próprio** (`httpOnly`, `sameSite`, emitido por `/api/auth/login`, validado por um helper em cada rota) | Tabela/lista de sessões (ou token assinado com segredo via `jose`/HMAC). `bcrypt` no login. | Sem dependência nova além de `jose` (ou nenhuma, com HMAC do Node). Precisa de D1 para guardar hash de senha e (se stateful) sessões. Você controla tudo. |
| **B. JWT no cookie** (stateless) | Login emite JWT assinado; rotas verificam assinatura. | Sem storage de sessão; logout/revogação são fracos (só expiração). Mesmo esforço que A. |
| **C. next-auth / Auth.js** | Provider Credentials (email+senha com bcrypt) e/ou OAuth (Google). Middleware protege `/area-restrita`. | Dependência nova e configuração; ganha "entrar com Google" para a psicóloga; para paciente com senha, Credentials exige praticamente o mesmo código de A. |
| **D. Auth do BaaS** (se D1 = C) | Supabase Auth etc. | Resolve junto com D1; a psicóloga e o paciente viram usuários do provedor; RLS pode substituir parte das checagens de API. |

Sub-decisões que qualquer opção exige: **dois papéis** (psicóloga vs paciente) e como a psicóloga é cadastrada (seed via env? primeiro usuário? só OAuth com um email permitido?). E o papel do `middleware.ts` (não existe) vs. guarda dentro de cada rota.

### D3 — Agendamento: API real ou WhatsApp?

| Opção | Consequência |
|---|---|
| **A. Manter WhatsApp como único caminho** | A API de agendamento, a área do paciente ("Nova Consulta", "Pagamentos") e o Checkout perdem a razão de existir para o paciente. Sobra: **área da psicóloga** como agenda/CRM interno, alimentada manualmente (ela cadastra a consulta que combinou no WhatsApp). Pagamento vira P1-(d) ou link de cobrança do MP enviado à mão. Não há como o paciente obter credencial (ver 1.5-10). |
| **B. Voltar à API (fluxo do protótipo)** | O paciente agenda no site, recebe credencial, paga online. Exige D1, D2, P1, e decidir se a senha continua sendo entregue na tela (ou por email — não há serviço de email no projeto). Os campos `tipo/motivo/observacoes` precisam entrar no modelo ou sair do formulário. |
| **C. Híbrido: API grava + WhatsApp notifica** | O formulário chama `POST /api/agendamento` **e** abre o `wa.me` com os dados (ou só a psicóloga recebe notificação). O horário fica reservado no sistema; a confirmação humana continua pelo WhatsApp. Exige D1; D2 fica opcional se a área do paciente não voltar. |
| **D. Híbrido invertido: WhatsApp para o paciente, API só para a psicóloga** | Igual A, mas com `POST /api/agendamento` (autenticado como psicóloga) para ela registrar as consultas combinadas. É "A + CRM". |

### D4 — Cadastro e senha do paciente (só se D3 ≠ A)

Como o paciente obtém e troca a senha? Opções: senha exibida na tela uma vez (legado, fraca), senha definida pelo paciente no agendamento, link mágico por email (exige provedor de email — não há), OTP por WhatsApp (exige API do WhatsApp Business — não há). Cada uma muda `POST /api/agendamento` e o `LoginForm`.

### D5 — Link da consulta online

"Iniciar" gera Meet falso. Opções: campo manual que a psicóloga cola (já existe no modal Editar), integração Google Calendar/Meet API (OAuth Google, escopo calendar — esforço relevante), ou remover "Iniciar" e manter só o campo.

### D6 — Hospedagem

Vercel (atual; força D1 ≠ A) vs. VPS/Node com disco (permite D1 = A, mas você administra o servidor, HTTPS, backups).

### D7 — Escopo da área da psicóloga

Tudo do protótipo (5 abas) ou um subconjunto para a v1? Cada aba é uma tarefa no plano; sem esta resposta o plano abaixo assume as 5.

---

## 4. Plano decomposto

Cada tarefa é pensada como **um comando isolado** ao orquestrador, com escopo de arquivos fechado, e passa por `code-reviewer-security` ao final (obrigatório nas que tocam API/auth/pagamento/dados). "Depende de" lista tarefas e decisões. Tarefas marcadas **⟂** podem rodar em paralelo entre si.

### Fase 0 — Higiene e desbloqueio (não depende de nenhuma decisão)

| # | Tarefa | Líder | Depende de |
|---|---|---|---|
| T0.1 | Remover access token `TEST-…` literal de `pagamento-checkout` e `pagamento-direto`; falhar com 500 se `MP_ACCESS_TOKEN` ausente. Criar `.env.example` com `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `NEXT_PUBLIC_URL`. [dívida] | payment-integration | — |
| T0.2 ⟂ | Trocar public key literal em `CheckoutTransparente` por `process.env.NEXT_PUBLIC_MP_PUBLIC_KEY`; adicionar `'use client'`; remover `console.log` de dados de cartão; limpar o `setInterval` no unmount. [dívida] | payment-integration | — |
| T0.3 ⟂ | Tirar dados reais de paciente do repositório: substituir `pacientes.json`/`consultas.json`/`notificacoes.json` por seeds fictícios; adicionar regra no `.gitignore` para o caminho de dados real (o caminho depende de D1, mas o gitignore do atual já vale). Avaliar limpar o histórico git (decisão sua: reescrever histórico ou não). [dívida] | api-dev (arquivos) + você (histórico) | — |
| T0.4 ⟂ | Unificar o enum de `Consulta.status` e o nome `observacoes` em `src/types` e nas rotas `consultas/[id]`, `disponibilidade` e no `GerenciadorConsultas`; migrar `params` para `await params` (Next 15). Resolve 1.5-4 e 1.5-5 — **exige você escolher o enum final** (5 valores com `confirmada`, ou 4). | api-dev, depois frontend-dev para `GerenciadorConsultas` | escolha do enum |
| T0.5 ⟂ | Corrigir `horarios-disponiveis.json` (ids string) e fazer `disponibilidade` considerar horários `unico`. Resolve 1.5-8 e 1.5-9. | api-dev | — |
| T0.6 ⟂ | Decidir e aplicar o destino de `pagamento-direto`: remover a rota (ou deixar retornando 410). | payment-integration | P2 |
| T0.7 | Rodar `npx tsc --noEmit` e `npm run lint` e corrigir o que já está quebrado no código ativo (o build ignora erros; ninguém sabe o estado real). Reportar, não refatorar. | api-dev + frontend-dev (cada um no seu domínio) | — |

### Fase 1 — Fundação de dados (depende de D1; bloqueia tudo que grava)

| # | Tarefa | Líder | Depende de |
|---|---|---|---|
| T1.1 | Criar a camada de acesso a dados única em `src/app/api/_lib/` (ou `src/lib/` marcado `server-only`): funções `getPacientes/getConsultas/getHorarios/getNotificacoes` e `save*`/`create*`/`update*`, com a implementação escolhida em D1 (JSON, Postgres, KV…). Nenhuma rota lê `fs` diretamente depois disto. | api-dev | D1, D6 |
| T1.2 | Se D1 = banco: schema + migrações + script de import dos JSONs (paciente, consulta, horário, notificação, pagamento). | api-dev | T1.1 |
| T1.3 | Migrar `agendamento`, `horarios`, `disponibilidade`, `consultas/[id]`, `area-restrita` (GET/PUT/PATCH) para a camada de T1.1. Uma tarefa por rota se quiser paralelizar. | api-dev | T1.1 |
| T1.4 | Migrar `pagamento-checkout` (e o que sobrar de `pagamento`) para a camada de T1.1 — leitura/escrita de `pagamento`, `pagamentoId`, `pagamentoData`. | payment-integration | T1.1 |
| T1.5 | Adicionar ao modelo de `Paciente` os campos de auth (`senhaHash`, `criadoEm` já existe) e ao de `Consulta` os campos `tipo`/`motivo`/`observacoes` **se** D3 mantiver o formulário atual. | api-dev | D3, D4, T1.1 |

### Fase 2 — Auth e sessão (depende de D2; bloqueia a área restrita)

| # | Tarefa | Líder | Depende de |
|---|---|---|---|
| T2.1 | `POST /api/auth/login`: email + senha + tipo; `bcrypt.compare`; psicóloga a partir de `PSICOLOGA_EMAIL`/`PSICOLOGA_SENHA_HASH` (env) ou de registro no banco; emite sessão conforme D2. Resposta sem `paciente` inteiro (só id, nome, tipo). Remove o `POST` de `area-restrita/route.ts`. [dívida: admin123, `===`] | api-dev | D2, T1.1 |
| T2.2 | `GET /api/auth/validate` (quem sou) + `POST /api/auth/logout`. | api-dev | T2.1 |
| T2.3 | Helper `requireAuth(request, papel)` e aplicação em **todas** as rotas de psicóloga (`area-restrita` GET/PUT/PATCH, `horarios` POST/DELETE, `consultas/[id]`) e nas de paciente (só os próprios dados: filtrar por `pacienteId` da sessão, nunca por `?id=` do cliente). [dívida: rotas abertas] | api-dev | T2.1 |
| T2.4 | Endpoint de leitura por paciente (`GET /api/paciente/me` → consultas do paciente logado) para substituir o "recarregar dados refazendo login". | api-dev | T2.3 |
| T2.5 | Definição/troca de senha do paciente conforme D4 (`POST /api/auth/senha` ou parte do `POST /api/agendamento`). Remover `acessoAreaRestrita.senha` da resposta do agendamento. [dívida: id.slice(-8)] | api-dev | D4, T2.1 |
| T2.6 | (se D2 = C) instalar/configurar next-auth em vez de T2.1–T2.2 — substitui as duas. | api-dev | D2 |
| T2.7 | `src/contexts/AuthContext.tsx` + `useAuth()`: chama `validate` ao montar, expõe `user`, `login()`, `logout()`. | frontend-dev | T2.2 (contrato) |
| T2.8 ⟂ | `src/components/LoginForm.tsx` (react-bootstrap `Form`, tipo/email/senha, erros) + `src/app/login/page.tsx`. | frontend-dev | T2.7 |
| T2.9 | Guarda de rota: `/area-restrita` redireciona para `/login` sem sessão (`middleware.ts` ou checagem no `AuthContext`, conforme D2). | frontend-dev (ou api-dev se middleware) | T2.7 |

### Fase 3 — Agendamento (depende de D3)

| # | Tarefa | Líder | Depende de |
|---|---|---|---|
| T3.1 | Revisar `POST /api/agendamento`: validação, campos novos (T1.5), sem `acessoAreaRestrita.senha`, sem `fetch` interno para `/api/pagamento` (a criação de pagamento passa a ser passo separado, ver Fase 5), notificação. Se D3 = D, exigir sessão de psicóloga. | api-dev | D3, T1.3, T2.3 |
| T3.2 | `agendamento/page.tsx`: reativar a chamada à API conforme D3 (B: só API; C: API + `wa.me`; A/D: manter WhatsApp e remover o passo 3 morto). Migrar o formulário para react-bootstrap `Form` no processo. | frontend-dev | T3.1 (contrato) |
| T3.3 | Criar `POST /api/consultas` (ou redirecionar `GerenciadorConsultas` para `/api/agendamento`) para a remarcação funcionar — resolve 1.5-7. | api-dev, depois frontend-dev | T1.3, escolha em 1.5-7 |

### Fase 4 — Área restrita (depende de Fases 1–2 e D7)

Extrair da página comentada, **uma aba por tarefa**, cada uma virando componente próprio em `src/components/area-restrita/` com react-bootstrap em vez dos inline styles legados. A página `area-restrita/page.tsx` vira só o shell (tabs + guarda).

| # | Tarefa | Líder | Depende de |
|---|---|---|---|
| T4.1 | Shell: `area-restrita/page.tsx` com `useAuth()`, header, `Nav` de abas por papel, `NotificacaoProvider`. Apagar o código comentado. | frontend-dev | T2.7, T2.9 |
| T4.2 ⟂ | Psicóloga · Dashboard (cards, consultas de hoje com `GerenciadorConsultas`, notificações + marcar lida). | frontend-dev | T4.1, T2.3 |
| T4.3 ⟂ | Psicóloga · Consultas (lista, modal Editar com status/pagamento/linkMeet/observacoes/relatorio). "Iniciar" conforme D5. | frontend-dev | T4.1, D5 |
| T4.4 ⟂ | Psicóloga · Pacientes (lista + detalhe). Detalhe mostra CPF só aqui, autenticado. | frontend-dev | T4.1 |
| T4.5 ⟂ | Psicóloga · Horários (único/recorrente, modo rápido, deletar). | frontend-dev | T4.1, T0.5 |
| T4.6 ⟂ | Psicóloga · Calendário (`Calendario` + consultas do dia). | frontend-dev | T4.1 |
| T4.7 ⟂ | Paciente · Próximas consultas + Histórico (usa T2.4). | frontend-dev | T4.1, T2.4, D3 ≠ A |
| T4.8 ⟂ | Paciente · Nova Consulta (reaproveita `CalendarioAgendamento`, chama T3.1 com o paciente da sessão). | frontend-dev | T4.1, T3.1, D3 ≠ A |
| T4.9 | Paciente · Pagamentos (lista + "Pagar Agora" abrindo o checkout escolhido em P1). | frontend-dev | T4.1, Fase 5 |
| T4.10 | Reativar link `/area-restrita` na home. | frontend-dev | T4.1 |

### Fase 5 — Pagamento (depende de P1–P6)

| # | Tarefa | Líder | Depende de |
|---|---|---|---|
| T5.1 | Fonte única de valor no servidor (`config.valorConsulta` ou campo na consulta, conforme P4); rotas ignoram `valor` do body. [dívida] | payment-integration | P4, T1.4 |
| T5.2 | Consolidar rotas conforme P1: (a) manter `pagamento-checkout` como oficial e remover `pagamento`/Preference; (b) manter `pagamento` e remover checkout transparente; (c) ambos com nomes claros. Decidir o destino do placeholder `api/mercadopago`. Respostas sem objeto bruto do MP. [dívida] | payment-integration | P1, P2 |
| T5.3 | Webhook conforme P3: `POST`, valida `x-signature`/`x-request-id` com `MP_WEBHOOK_SECRET`, `payment.get`, atualiza consulta por `external_reference`, idempotente; ajustar `notification_url`. Configurar a URL no painel do MP (você). | payment-integration | P3, T5.2 |
| T5.4 | Exigir sessão nas rotas de pagamento (a consulta paga tem de ser do paciente logado) — `requireAuth` de T2.3. | payment-integration | T2.3, T5.2 |
| T5.5 | `CheckoutTransparente`: react-bootstrap, tokenização única (a que funcionar com o SDK v2 — testar em sandbox), erros visíveis, valor vindo do servidor. Ou substituir por botão que redireciona ao `init_point` se P1 = Pro. | payment-integration | T5.2, T0.2 |
| T5.6 | Páginas `pagamento/{sucesso,pendente,falha}` **ou** remover os placeholders e apontar `back_urls` para a área do paciente, conforme P5. | payment-integration (páginas são do seu escopo) | P5 |
| T5.7 | Teste ponta a ponta em sandbox com `cartoesTesteMercadoPago.js`: PIX aprovado, cartão aprovado (`APRO`), rejeitado (`OTHE`), webhook recebido (usar túnel tipo ngrok — você). | payment-integration + você | T5.3, T5.5 |

### Fase 6 — Fechamento

| # | Tarefa | Líder | Depende de |
|---|---|---|---|
| T6.1 | Revisão de segurança completa do diff acumulado (os quatro eixos). | code-reviewer-security | tudo |
| T6.2 | Deploy: variáveis na Vercel (ou no VPS), banco provisionado, URL do webhook no MP, `NEXT_PUBLIC_URL` real. | você | T6.1 |
| T6.3 | Atualizar `CLAUDE.md` para o novo estado (auth real, storage real, fluxo de pagamento oficial) e remover as seções "dívida conhecida" resolvidas. | orquestrador | T6.2 |
| T6.4 | Limpeza: `page.module.css`, `faturas.json`, svgs do template, `.eslintrc.json` duplicado, `cartoesTesteMercadoPago.js` fora do bundle de produção. | frontend-dev | — |

### Ordem mínima (caminho crítico)

`D1 + D6` → T1.1 → T1.3/T1.4 → `D2` → T2.1 → T2.3 → T2.7 → T4.1 → (abas) — e em paralelo `P1..P3` → T5.2 → T5.3 → T5.5. A Fase 0 pode começar hoje sem nenhuma decisão.

---

## 5. Pré-existente vs. novo

| Item | Estado | Classificação | Tarefa |
|---|---|---|---|
| Credenciais fixas `psicologa@mariacristina.com` / `admin123` | ativo em `area-restrita/route.ts` | **[dívida] corrigir** | T2.1 |
| Senha do paciente = `id.slice(-8)`, devolvida em texto puro por `/api/agendamento` e exibida no passo 3 | ativo (API) / inalcançável (UI) | **[dívida] corrigir** | T2.5, T3.1 |
| Comparação de senha com `===`; `bcrypt` instalado sem uso | ativo | **[dívida] corrigir** | T2.1 |
| Rotas de psicóloga/paciente sem autenticação (lista completa de pacientes com CPF via `GET ?action=pacientes`) | ativo | **[dívida] corrigir** | T2.3 |
| Access token `TEST-…` literal como fallback (2 rotas) | ativo | **[dívida] corrigir** | T0.1 |
| Public key `TEST-…` literal no cliente | ativo | **[dívida] corrigir** | T0.2 |
| `console.log` de número/CVV do cartão no navegador | ativo | **[dívida] corrigir** | T0.2 |
| `pagamento-direto` com cartão cru | ativo, sem chamadores | **[dívida] remover/decidir** | T0.6 |
| `valor` aceito do body do cliente; 150 hardcoded | ativo | **[dívida] corrigir** | T5.1 |
| Objeto bruto do MP devolvido ao cliente | ativo | **[dívida] corrigir** | T5.2 |
| Webhook inexistente / esboço sem assinatura | ativo | **[dívida] corrigir** | T5.3 |
| Dados reais de paciente commitados em `src/data` | ativo | **[dívida] corrigir** | T0.3 |
| Escrita em `src/data/*.json` não persiste na Vercel | ativo | **[dívida] estrutural** | D1, Fase 1 |
| `POST /api/consultas` inexistente (remarcação quebrada) | ativo | bug legado | T3.3 |
| Enum de status e `observacao/observacoes` divergentes | ativo | bug legado | T0.4 |
| Ids numéricos em `horarios-disponiveis.json`; `disponibilidade` ignora `unico` | ativo | bug legado | T0.5 |
| Meet falso em "Iniciar" | comentado | intenção incompleta | D5, T4.3 |
| `params` síncrono em `consultas/[id]` (Next 14) | ativo | incompatibilidade | T0.4 |
| Área restrita comentada, placeholders vazios | — | **novo** (reconstrução) | Fases 2–4 |
| Sessão, guarda de rota, `AuthContext`, `/login` | inexistente | **novo** | Fase 2 |
| Camada de dados / banco | inexistente | **novo** | Fase 1 |

---

## 6. O que preciso de você para destravar (checklist de respostas)

- [ ] **D1** storage · **D6** hospedagem
- [ ] **D2** sessão · **D4** senha do paciente
- [ ] **D3** agendamento (WhatsApp / API / híbrido)
- [ ] **D5** link da consulta · **D7** escopo da área da psicóloga na v1
- [ ] **P1** fluxo oficial · **P2** `pagamento-direto` · **P3** webhook/polling · **P4** valor · **P5** pós-pagamento · **P6** credenciais de produção
- [ ] Enum final de `status` (1.5-4) · destino de `tipo/motivo/observacoes` (1.5-11) · reescrever histórico git para remover CPF (T0.3)?
