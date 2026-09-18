# PROPOSTA de schema — PostgreSQL + Prisma 7 (revisão 2)

Status: **proposta revisada para aprovação final**. Nada foi aplicado: sem migration, sem `prisma`, sem alteração em `src/`.

Revisão 2 incorpora as decisões sobre D1–D8 e Q1–Q13 (§9 lista o que mudou). Fontes: `src/types/index.ts` (pós-T0.4), `src/data/*.json`, rotas de `src/app/api`, e o bloco legado comentado de `src/app/area-restrita/page.tsx`. **Modela-se a intenção original** (agendamento real com cadastro, área restrita, cobrança), não o estado degradado ativo (só-WhatsApp, login escondido, escrita em JSON) — esse estado foi um contorno para o Vercel e não é referência.

Legenda: **[regra]** regra de negócio decidida · **[legado]** existe no código/JSON · **[proposta]** decisão minha, sujeita a aprovação · **[?]** pergunta ainda aberta (§8).

Diretriz geral aplicada em tudo: **o que o Prisma não faz nativamente é resolvido na API** (transações, validações), nunca com SQL cru ou adaptação manual no banco.

---

## 0. Visão geral

```
Usuario (email, senhaHash?, papel) ─1:1─ Paciente ─1:N─ Consulta ─1:1─ Pagamento ─1:N─ EventoPagamento
   └─1:N─ TokenAcesso (primeiro acesso / redefinição)

HorarioAtendimento (dia da semana + "HH:MM", um a um)  ─┐
ExcecaoDisponibilidade (data [+ hora] indisponível)     ─┴─► livres = horários − exceções − consultas que ocupam  (aplicação)

Configuracao (linha única: valor padrão, duração informativa, antecedência de cancelamento)
Notificacao (in-app para a psicóloga) [legado, opcional — Q8]
```

---

## 1. Entidades

### 1.1 `Usuario` — credencial e papel

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | Projeto já usa uuid v4 [legado]. |
| `email` | `String @unique` | Login por email. Único **entre todos os papéis** — elimina o `select tipo` do login legado. Visitante que se cadastra com email já existente recebe "você já tem conta, faça login". |
| `senhaHash` | `String?` | bcrypt custo ≥ 10. **Nullable** = ainda não definiu senha (paciente cadastrado pela psicóloga, aguardando primeiro acesso). |
| `papel` | `enum Papel { psicologa, paciente }` | JWT carrega `{ sub, papel }`. |
| `ativo` | `Boolean @default(true)` | Desativar sem apagar histórico. |
| `ultimoLoginEm` | `DateTime?` | Psicóloga vê quem nunca acessou. |
| `criadoEm` / `atualizadoEm` | `DateTime` | |

A psicóloga é **uma linha** com `papel = psicologa`, criada por seed a partir de env (`PSICOLOGA_EMAIL`, `PSICOLOGA_SENHA_HASH`) — substitui `admin123` [dívida].

### 1.2 `Paciente` — perfil cadastral

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | Chave de `Consulta` (compatível com `consultas.json`). |
| `usuarioId` | `String @unique` → `Usuario` | 1:1, `onDelete: Restrict`. |
| `nome` | `String` | [legado] |
| `telefone` | `String` | Dígitos com DDI; é o número dos `wa.me` [legado]. |
| `dataNascimento` | `DateTime @db.Date` | [legado]; menoridade derivada na app. |
| `cpf` | `String? @unique` | [legado] obrigatório → **[proposta]** opcional. Com Checkout Pro o MP coleta CPF na página dele; o campo só se justifica para cadastro/recibo. [?] Q4. |
| `responsavel` / `telefoneResponsavel` | `String?` | [legado] menores. |
| `origemCadastro` | `enum OrigemCadastro { psicologa, autocadastro }` | **[proposta]** distingue paciente criado pela psicóloga (sem senha, vai por token) do visitante que se cadastrou no agendamento (§5). |
| `observacoesCadastro` | `String?` | Notas administrativas da psicóloga (não clínicas). |
| `avatarUrl` | `String?` | [regra] Só a URL; binário em object storage externo (R2/Vercel Blob). Upload/exclusão são rota de servidor. `null` = iniciais. Não existia [legado]. |
| `criadoEm` / `atualizadoEm` | `DateTime` | |

**Externos (não modelados):** object storage do avatar; link do Meet; WhatsApp (`wa.me` com texto pré-preenchido, manual); lembrete do dia seguinte (tela + botão `wa.me`).

### 1.3 `TokenAcesso` — primeiro acesso e redefinição

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `usuarioId` | `String` → `Usuario` (`Cascade`) | |
| `tokenHash` | `String @unique` | SHA-256 do token; o bruto só vive no link. |
| `finalidade` | `enum FinalidadeToken { primeiro_acesso, redefinicao_senha }` | Um mecanismo para os dois. |
| `expiraEm` | `DateTime` | 7 dias / 1 h [proposta]. |
| `usadoEm` | `DateTime?` | Uso único. |
| `criadoEm` | `DateTime` | |

### 1.4 `HorarioAtendimento` — horários recorrentes, um a um [regra D3]

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `diaSemana` | `enum DiaSemana` (§6) | |
| `hora` | `String @db.VarChar(5)` `"HH:MM"` | **Um horário cadastrado é um horário agendável.** A psicóloga cadastra `08:00` e `08:30` se quiser; o sistema não subdivide, não calcula fim, não impede sobreposição. Formato idêntico ao legado. |
| `ativo` | `Boolean @default(true)` | Desligar sem apagar [legado]. |
| `criadoEm` / `atualizadoEm` | `DateTime` | |

`@@unique([diaSemana, hora])` — nativo do Prisma; impede cadastrar "terça 14:00" duas vezes (o legado permitia duplicata pelo "modo rápido").

Coincide com o `HorarioDisponivel { tipo: 'recorrente', diaSemana, hora }` do legado: os **44 seeds migram 1:1** (§7-D3).

### 1.5 `ExcecaoDisponibilidade` — datas indisponíveis

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `data` | `DateTime @db.Date` | Feriado, viagem [regra]. |
| `hora` | `String? @db.VarChar(5)` | `null` = dia inteiro; `"14:00"` = só aquele horário. Sem faixa: exceção é por horário, coerente com §1.4. |
| `motivo` | `String?` | Só a psicóloga vê. |
| `criadoEm` | `DateTime` | |

`@@unique([data, hora])` — no Postgres `null` não colide com `null`, então duas exceções "dia inteiro" na mesma data passariam; a app checa antes de inserir (diretriz: resolver na API).

**Livres** = `HorarioAtendimento` ativos do `diaSemana` da data − `ExcecaoDisponibilidade` da data (inteira ou daquele `hora`) − `Consulta` com `status ∈ CONSULTA_STATUS_OCUPA_HORARIO` naquele `inicio`. Tudo em aplicação; para o calendário mensal, uma query por mês.

### 1.6 `Consulta` — a sessão

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `pacienteId` | `String` → `Paciente` (`Restrict`) | |
| `inicio` | `DateTime` (timestamptz) | [regra D5] Instante = data + `hora` do horário escolhido, no fuso `America/Sao_Paulo`. Sem `duracaoMin`: a duração é informação exibida (`Configuracao.duracaoSessaoMin`), não cálculo [regra Q2]. |
| `status` | `enum ConsultaStatus` (§2) | Canônico da T0.4. |
| `modalidade` | `enum Modalidade { presencial, online }?` | [legado] `tipo` do formulário. |
| `motivo` | `String?` | [legado] select do formulário. |
| `observacoes` | `String?` | [legado] nome canônico (T0.4). [?] Q6. |
| `relatorio` | `String?` | [legado] anotações clínicas — **sensível**; só rota de psicóloga. |
| `criadaPor` | `enum AtorConsulta { paciente, psicologa }` | Quem agendou. |
| `confirmadaEm` | `DateTime?` | [regra] |
| `encerradaEm` | `DateTime?` | Marcação de `realizada` **ou** `nao_compareceu`. [?] Q7. |
| `canceladaEm` / `canceladaPor` / `motivoCancelamento` | `DateTime?` / `AtorConsulta?` / `String?` | [regra] quem e quando. |
| `criadaEm` / `atualizadaEm` | `DateTime` | |

Índices: `@@index([pacienteId, inicio])`, `@@index([inicio, status])`.

**Sem coluna de trava de horário** [regra D8]. A garantia de "uma consulta ativa por `inicio`" é feita na API, dentro de uma transação Prisma (§1.6.1). Sai `linkMeet` (externo), sai `pagamento`/`pagamentoId`/`pagamentoData` (→ `Pagamento`).

Transições (validação na app):

```
agendada ──confirma (psicóloga)──► confirmada ──após ocorrer (psicóloga)──► realizada | nao_compareceu
   │                                   │
   └──────── cancela ──────────────────┴──► cancelada   (paciente até `antecedenciaCancelamentoHoras` antes; psicóloga sempre)
```

`realizada`, `nao_compareceu`, `cancelada` são terminais. `CONSULTA_STATUS_OCUPA_HORARIO = ['agendada','confirmada']` (constante já existente) é o único lugar que diz o que ocupa horário.

#### 1.6.1 Criação da consulta — verificação de horário na API [regra D1 + D8]

Sem reserva temporária, sem estado "segurado" [regra]. O horário só vira `Consulta` quando cadastro/login termina. Tudo dentro de **uma** transação interativa do Prisma, com isolamento `Serializable` (opção nativa: `prisma.$transaction(fn, { isolationLevel: 'Serializable' })`):

```
tx:
  1. paciente = (cadastro novo → create Usuario+Paciente) | (login → Paciente da sessão)
  2. horario  = HorarioAtendimento ativo com (diaSemana(inicio), hora(inicio))      → senão 409 "horário indisponível"
  3. excecao  = ExcecaoDisponibilidade com data(inicio) e (hora null ou = hora)      → se existir, 409
  4. ocupada  = Consulta com inicio = X e status in CONSULTA_STATUS_OCUPA_HORARIO    → se existir, 409
  5. create Consulta { status: agendada, criadaPor }
```

Dois visitantes no mesmo horário: sob `Serializable` o Postgres detecta a dependência entre as duas transações; a segunda falha com erro de serialização (Prisma `P2034`), a API converte em 409 "horário indisponível" — sem retry, porque o horário de fato já foi. Quem completou o cadastro primeiro leva [regra]. Nada de SQL cru, nada de constraint parcial.

### 1.7 `Pagamento` — cobrança pós-consulta, entidade própria 1:1 [regra D7], Checkout Pro [regra Q11]

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `consultaId` | `String @unique` → `Consulta` (`Restrict`) | **1:1** — impede segunda cobrança para a mesma consulta (constraint nativa). |
| `valor` | `Decimal @db.Decimal(10,2)` | Editável [regra]; default `Configuracao.valorPadraoSessao` (200). Nunca vem do cliente. |
| `status` | `enum PagamentoStatus { pendente, pago, falhou, expirado }` | [regra Q9] 4 valores; mapeamento em §4. |
| `metodo` | `enum MetodoPagamento { pix, boleto, cartao, outro }?` | Preenchido a partir de `payment_type_id` do MP quando o pagamento existir. |
| `mpPreferenceId` | `String? @unique` | Preference do Checkout Pro — nasce ao gerar a cobrança. |
| `linkCobranca` | `String?` | `init_point` da preference — é o que a psicóloga manda por `wa.me`. |
| `mpPaymentId` | `String? @unique` | **Âncora de idempotência** (§4). Só existe depois que o paciente paga (o MP cria o payment na hora do checkout). String: ids do MP são inteiros grandes. |
| `mpStatus` / `mpStatusDetail` | `String?` | Cópia crua do último estado do MP, para diagnóstico. |
| `expiraEm` | `DateTime?` | `expiration_date_to` da preference (link vence). |
| `pagoEm` | `DateTime?` | `date_approved` do MP, não a hora do webhook. |
| `ultimaReconciliacaoEm` | `DateTime?` | Throttle do fallback. |
| `geradoPorId` | `String?` → `Usuario` | Rastreabilidade (hoje sempre a psicóloga). |
| `observacao` | `String?` | "Desconto pacote 4 sessões". |
| `criadoEm` / `atualizadoEm` | `DateTime` | |

**Nota de implementação (rota, não schema)** — ao criar a preference: `external_reference = consulta.id` (é o que liga o webhook à cobrança), `notification_url = ${NEXT_PUBLIC_URL}/api/pagamento/webhook`, `back_urls` → `/pagamento/{sucesso,pendente,falha}?cobranca=<pagamento.id>`, `auto_return: 'approved'`, e, **replicando o gestor-imoveis**, `payment_methods.excluded_payment_types = [{ id: 'bank_transfer' }, { id: 'ticket' }, { id: 'account_money' }]`. ⚠ Ver **Q14**: na taxonomia do MP, `bank_transfer` = PIX e `ticket` = boleto — com essa exclusão sobra **só cartão**, o que contradiz "PIX, boleto e cartão". Registrei como mandado; a lista final precisa da sua confirmação.

### 1.8 `EventoPagamento` — trilha de webhooks/reconciliações

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `pagamentoId` | `String?` → `Pagamento` (`SetNull`) | `null` se o webhook não casou com nada (guardado para investigar). |
| `origem` | `enum OrigemEvento { webhook, reconciliacao, manual }` | |
| `mpNotificationId` | `String? @unique` | `id` da notificação / `x-request-id` — **dedupe de retentativas** do MP. |
| `mpPaymentId` | `String?` | Busca mesmo sem `pagamentoId`. |
| `statusAnterior` / `statusNovo` | `PagamentoStatus?` | Histórico. |
| `payload` | `Json?` | Resposta do `payment.get`, sanitizada (sem `card`, sem `payer.identification`). |
| `recebidoEm` | `DateTime` | |

### 1.9 `Configuracao` — linha única

| Campo | Tipo | Por quê |
|---|---|---|
| `id` | `Int @id @default(1)` | Singleton. |
| `valorPadraoSessao` | `Decimal(10,2) @default(200)` | [regra] Substitui `config.json.valorConsulta = 150` e o `150` hardcoded. |
| `duracaoSessaoMin` | `Int @default(50)` | [regra Q2] **Informativo**: exibido ao paciente ("sessões de 50 min"). Não alimenta nenhum cálculo de slot. |
| `antecedenciaCancelamentoHoras` | `Int @default(24)` | A regra "1 dia antes" é validação de app [regra]; o número fica configurável. |
| `atualizadoEm` | `DateTime` | |

O resto de `config.json` (nome, sobre, especialidades, contato, `dadosPagamento`) é conteúdo de site — fora do banco (§7-D10).

### 1.10 `Notificacao` — in-app para a psicóloga [legado, opcional — Q8]

`id`, `tipo { novo_agendamento, cancelamento, pagamento_recebido }`, `titulo`, `mensagem`, `consultaId?` (`SetNull`), `lida`, `criadaEm`. `lembrete` do legado sai (é tela + `wa.me`).

---

## 2. Enums

```prisma
enum Papel            { psicologa  paciente }
enum FinalidadeToken  { primeiro_acesso  redefinicao_senha }
enum OrigemCadastro   { psicologa  autocadastro }
enum DiaSemana        { segunda  terca  quarta  quinta  sexta  sabado  domingo }   // §6

/// EXATAMENTE o canônico da T0.4 (src/types/index.ts CONSULTA_STATUS), mesma ordem, minúsculas.
enum ConsultaStatus   { agendada  confirmada  realizada  cancelada  nao_compareceu }

enum AtorConsulta     { paciente  psicologa }
enum Modalidade       { presencial  online }

/// 4 estados [regra Q9]. Mapeamento MP → aqui na §4.
enum PagamentoStatus  { pendente  pago  falhou  expirado }

enum MetodoPagamento  { pix  boleto  cartao  outro }
enum OrigemEvento     { webhook  reconciliacao  manual }
enum TipoNotificacao  { novo_agendamento  cancelamento  pagamento_recebido }
```

Sem `cancelado`/`estornado` em `PagamentoStatus`: cancelar uma cobrança pendente = a psicóloga apaga o `Pagamento` (ou a preference expira → `expirado`); estorno é feito no painel do MP e, se chegar por webhook, é registrado em `EventoPagamento` com `payload` mas **não** muda `status` (fica `pago`) — ver §4.

---

## 3. `schema.prisma` — PROPOSTA (não aplicado)

Prisma **7** [regra Q1]: generator `prisma-client` (gera para um `output` dentro de `src/`, ESM), sem `url` no `datasource` — a conexão vai em `prisma.config.ts` (`datasource.url = env('DATABASE_URL')`) e o client usa driver adapter (`@prisma/adapter-pg`). Isso é setup de implementação; confirmar sintaxe exata na doc do Prisma 7 no momento de aplicar. O conteúdo dos modelos não depende disso.

```prisma
// ============================================================================
// PROPOSTA (rev. 2) — psi-maria-cristina — Prisma 7 / PostgreSQL
// Não aplicar sem aprovação. Não gerar migration a partir deste arquivo ainda.
// Convenções: nomes em português; camelCase no client, snake_case no banco (@map).
// Fuso da aplicação: America/Sao_Paulo. Todo DateTime é timestamptz (UTC no banco).
// Regra: o que o Prisma não faz nativamente é resolvido na API (transações), nunca em SQL cru.
// ============================================================================

generator client {
  provider = "prisma-client"          // Prisma 7
  output   = "../src/generated/prisma" // [proposta] fora de node_modules, ignorado no git
}

datasource db {
  provider = "postgresql"
  // url: definida em prisma.config.ts → env("DATABASE_URL") (Prisma 7). Servidor apenas; nunca NEXT_PUBLIC_.
}

// ---------------------------------------------------------------- enums

enum Papel {
  psicologa
  paciente

  @@map("papel")
}

enum FinalidadeToken {
  primeiro_acesso
  redefinicao_senha

  @@map("finalidade_token")
}

enum OrigemCadastro {
  psicologa      // cadastrado pela psicóloga → primeiro acesso por token
  autocadastro   // visitante se cadastrou ao agendar → define senha na hora

  @@map("origem_cadastro")
}

/// Convenção canônica de dia da semana (PROPOSTA-schema.md §6). Sem números.
/// JS: ['domingo','segunda','terca','quarta','quinta','sexta','sabado'][date.getDay()]
enum DiaSemana {
  segunda
  terca
  quarta
  quinta
  sexta
  sabado
  domingo

  @@map("dia_semana")
}

/// Espelha EXATAMENTE src/types/index.ts CONSULTA_STATUS (T0.4).
/// O que ocupa horário é CONSULTA_STATUS_OCUPA_HORARIO, na aplicação — não duplicar aqui.
enum ConsultaStatus {
  agendada
  confirmada
  realizada
  cancelada
  nao_compareceu

  @@map("consulta_status")
}

enum AtorConsulta {
  paciente
  psicologa

  @@map("ator_consulta")
}

enum Modalidade {
  presencial
  online

  @@map("modalidade")
}

/// 4 estados. Mapeamento do MercadoPago na §4 do documento.
enum PagamentoStatus {
  pendente   // cobrança gerada (preference criada), aguardando
  pago       // MP payment approved — fonte de verdade: webhook ou reconciliação
  falhou     // MP payment rejected
  expirado   // preference/payment cancelled por expiração

  @@map("pagamento_status")
}

enum MetodoPagamento {
  pix
  boleto
  cartao
  outro

  @@map("metodo_pagamento")
}

enum OrigemEvento {
  webhook
  reconciliacao
  manual

  @@map("origem_evento")
}

enum TipoNotificacao {
  novo_agendamento
  cancelamento
  pagamento_recebido

  @@map("tipo_notificacao")
}

// ---------------------------------------------------------------- auth

/// Credencial. Uma linha para a psicóloga (seed via env) e uma por paciente.
model Usuario {
  id            String    @id @default(uuid())
  email         String    @unique                 // lowercase; único entre TODOS os papéis
  senhaHash     String?   @map("senha_hash")      // null = primeiro acesso pendente
  papel         Papel
  ativo         Boolean   @default(true)
  ultimoLoginEm DateTime? @map("ultimo_login_em")
  criadoEm      DateTime  @default(now()) @map("criado_em")
  atualizadoEm  DateTime  @updatedAt @map("atualizado_em")

  paciente          Paciente?
  tokensAcesso      TokenAcesso[]
  pagamentosGerados Pagamento[]   @relation("PagamentoGeradoPor")

  @@map("usuario")
}

/// Token de uso único (primeiro acesso / redefinição). Guarda SHA-256; o bruto só vive no link.
model TokenAcesso {
  id         String          @id @default(uuid())
  usuarioId  String          @map("usuario_id")
  tokenHash  String          @unique @map("token_hash")
  finalidade FinalidadeToken
  expiraEm   DateTime        @map("expira_em")
  usadoEm    DateTime?       @map("usado_em")
  criadoEm   DateTime        @default(now()) @map("criado_em")

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId, finalidade])
  @@map("token_acesso")
}

// ---------------------------------------------------------------- paciente

/// Perfil cadastral. Dados pessoais só saem em rota de psicóloga ou para o próprio paciente.
model Paciente {
  id                  String         @id @default(uuid())
  usuarioId           String         @unique @map("usuario_id")
  nome                String
  telefone            String                              // dígitos com DDI; usado em wa.me
  dataNascimento      DateTime       @map("data_nascimento") @db.Date
  cpf                 String?        @unique               // [?] Q4
  responsavel         String?                              // obrigatório na app se menor de 18
  telefoneResponsavel String?        @map("telefone_responsavel")
  origemCadastro      OrigemCadastro @map("origem_cadastro")
  observacoesCadastro String?        @map("observacoes_cadastro")
  avatarUrl           String?        @map("avatar_url")   // URL no object storage; NUNCA binário/base64
  criadoEm            DateTime       @default(now()) @map("criado_em")
  atualizadoEm        DateTime       @updatedAt @map("atualizado_em")

  usuario   Usuario    @relation(fields: [usuarioId], references: [id], onDelete: Restrict)
  consultas Consulta[]

  @@map("paciente")
}

// ---------------------------------------------------------------- disponibilidade

/// Horário de atendimento recorrente, cadastrado UM A UM pela psicóloga.
/// Um registro = um horário agendável. Sem faixa, sem subdivisão automática.
model HorarioAtendimento {
  id           String    @id @default(uuid())
  diaSemana    DiaSemana @map("dia_semana")
  hora         String    @db.VarChar(5)            // "HH:MM"
  ativo        Boolean   @default(true)
  criadoEm     DateTime  @default(now()) @map("criado_em")
  atualizadoEm DateTime  @updatedAt @map("atualizado_em")

  @@unique([diaSemana, hora])
  @@index([diaSemana, ativo])
  @@map("horario_atendimento")
}

/// Data indisponível: dia inteiro (hora null) ou um horário específico.
model ExcecaoDisponibilidade {
  id       String   @id @default(uuid())
  data     DateTime @db.Date
  hora     String?  @db.VarChar(5)                 // null = dia inteiro
  motivo   String?
  criadoEm DateTime @default(now()) @map("criado_em")

  @@unique([data, hora])                           // (null,null) não colide no Postgres → app checa
  @@index([data])
  @@map("excecao_disponibilidade")
}

// ---------------------------------------------------------------- consulta

/// Sessão. Máquina de estados e trava de horário na aplicação (§1.6 / §1.6.1).
model Consulta {
  id                 String         @id @default(uuid())
  pacienteId         String         @map("paciente_id")
  inicio             DateTime                                   // data + hora escolhida, timestamptz
  status             ConsultaStatus @default(agendada)

  modalidade         Modalidade?
  motivo             String?
  observacoes        String?                                     // nome canônico (T0.4) — [?] Q6
  relatorio          String?                                     // SENSÍVEL: só rota de psicóloga
  criadaPor          AtorConsulta   @map("criada_por")

  confirmadaEm       DateTime?      @map("confirmada_em")
  encerradaEm        DateTime?      @map("encerrada_em")        // realizada OU nao_compareceu — [?] Q7
  canceladaEm        DateTime?      @map("cancelada_em")
  canceladaPor       AtorConsulta?  @map("cancelada_por")
  motivoCancelamento String?        @map("motivo_cancelamento")

  criadaEm           DateTime       @default(now()) @map("criada_em")
  atualizadaEm       DateTime       @updatedAt @map("atualizada_em")

  paciente     Paciente      @relation(fields: [pacienteId], references: [id], onDelete: Restrict)
  pagamento    Pagamento?
  notificacoes Notificacao[]

  @@index([pacienteId, inicio])
  @@index([inicio, status])
  @@map("consulta")
}

// ---------------------------------------------------------------- pagamento

/// Cobrança pós-consulta via Checkout Pro (link), 1:1 com Consulta, gerada manualmente pela psicóloga.
/// Fonte de verdade do status: MercadoPago (webhook; fallback reconciliação). Ver §4.
model Pagamento {
  id                    String           @id @default(uuid())
  consultaId            String           @unique @map("consulta_id")   // 1:1 — impede cobrança duplicada
  valor                 Decimal          @db.Decimal(10, 2)            // editável; default Configuracao
  status                PagamentoStatus  @default(pendente)
  metodo                MetodoPagamento?

  mpPreferenceId        String?          @unique @map("mp_preference_id")   // Checkout Pro
  linkCobranca          String?          @map("link_cobranca")              // init_point → wa.me
  mpPaymentId           String?          @unique @map("mp_payment_id")      // âncora de idempotência
  mpStatus              String?          @map("mp_status")                  // cru: approved, rejected…
  mpStatusDetail        String?          @map("mp_status_detail")
  expiraEm              DateTime?        @map("expira_em")
  pagoEm                DateTime?        @map("pago_em")                    // date_approved do MP
  ultimaReconciliacaoEm DateTime?        @map("ultima_reconciliacao_em")

  geradoPorId           String?          @map("gerado_por_id")
  observacao            String?
  criadoEm              DateTime         @default(now()) @map("criado_em")
  atualizadoEm          DateTime         @updatedAt @map("atualizado_em")

  consulta  Consulta          @relation(fields: [consultaId], references: [id], onDelete: Restrict)
  geradoPor Usuario?          @relation("PagamentoGeradoPor", fields: [geradoPorId], references: [id], onDelete: SetNull)
  eventos   EventoPagamento[]

  @@map("pagamento")
}

/// Trilha imutável de webhooks e reconciliações. Dedupe de retentativas por mpNotificationId.
model EventoPagamento {
  id               String           @id @default(uuid())
  pagamentoId      String?          @map("pagamento_id")
  origem           OrigemEvento
  mpNotificationId String?          @unique @map("mp_notification_id")
  mpPaymentId      String?          @map("mp_payment_id")
  statusAnterior   PagamentoStatus? @map("status_anterior")
  statusNovo       PagamentoStatus? @map("status_novo")
  payload          Json?                                      // sanitizado: sem card / payer.identification
  recebidoEm       DateTime         @default(now()) @map("recebido_em")

  pagamento Pagamento? @relation(fields: [pagamentoId], references: [id], onDelete: SetNull)

  @@index([mpPaymentId])
  @@map("evento_pagamento")
}

// ---------------------------------------------------------------- configuração / notificação

/// Linha única (id = 1).
model Configuracao {
  id                            Int      @id @default(1)
  valorPadraoSessao             Decimal  @default(200) @map("valor_padrao_sessao") @db.Decimal(10, 2)
  duracaoSessaoMin              Int      @default(50) @map("duracao_sessao_min")   // INFORMATIVO (exibido), não cálculo
  antecedenciaCancelamentoHoras Int      @default(24) @map("antecedencia_cancelamento_horas")
  atualizadoEm                  DateTime @updatedAt @map("atualizado_em")

  @@map("configuracao")
}

/// In-app para a psicóloga (legado). Opcional — [?] Q8.
model Notificacao {
  id         String          @id @default(uuid())
  tipo       TipoNotificacao
  titulo     String
  mensagem   String
  consultaId String?         @map("consulta_id")
  lida       Boolean         @default(false)
  criadaEm   DateTime        @default(now()) @map("criada_em")

  consulta Consulta? @relation(fields: [consultaId], references: [id], onDelete: SetNull)

  @@index([lida, criadaEm])
  @@map("notificacao")
}
```

---

## 4. Idempotência do pagamento (Checkout Pro)

Ciclo: psicóloga marca `realizada` (ou `nao_compareceu`) → clica "gerar cobrança" → `Pagamento(pendente)` + preference no MP → manda `linkCobranca` por `wa.me` → paciente paga na página do MP → MP cria um **payment** e notifica o webhook → status vira `pago`.

**(1) Gerar a cobrança duas vezes.** `Pagamento.consultaId @unique`. Ordem: `create Pagamento(status=pendente, valor)` **antes** de chamar o MP; segundo clique viola o unique → API devolve o existente. Depois `update` com `mpPreferenceId`/`linkCobranca`/`expiraEm`. Se o MP falhar no meio, sobra `pendente` sem preference; "reenviar" preenche o mesmo registro.

**(2) Webhook reentregue.** `EventoPagamento.mpNotificationId @unique`. Handler faz `create` do evento primeiro; violação de unique → responde 200 e para.

**(3) Webhook × reconciliação concorrentes.** Os dois chamam a mesma função:

```
sincronizarPagamento(mpPaymentId, origem):
  1. resp = mercadopago.payment.get(mpPaymentId)             // nunca confiar no body do webhook
  2. pagamento = Pagamento where mpPaymentId
       ?? Pagamento where consultaId = resp.external_reference   // 1º pagamento de uma preference: mpPaymentId ainda null
       ?? → EventoPagamento{pagamentoId:null, payload} ; return 200
  3. novo = mapear(resp)                                        // tabela abaixo
  4. r = prisma.pagamento.updateMany({
         where: { id: pagamento.id, status: { not: novo }, NOT: { status: 'pago' } },   // pago é terminal
         data:  { status: novo, mpPaymentId, mpStatus, mpStatusDetail, metodo, pagoEm: resp.date_approved,
                  ultimaReconciliacaoEm: now() } })
  5. if r.count === 1: EventoPagamento{statusAnterior, statusNovo, origem} (+ Notificacao pagamento_recebido se pago)
     else:             EventoPagamento{origem, payload} sem transição (auditoria) — nenhuma dupla confirmação
```

O `updateMany` com `where` condicional é **uma** instrução SQL atômica — Prisma nativo, sem transação explícita nem lock. Entre dois concorrentes, o segundo encontra `status = novo` (ou `pago`) e afeta 0 linhas.

Mapeamento MP → `PagamentoStatus` (4 valores) [regra Q9]:

| MP `status` | `status_detail` | → | Observação |
|---|---|---|---|
| `pending`, `in_process`, `authorized`, `in_mediation` | qualquer | `pendente` | boleto emitido / cartão em análise |
| `approved` | | `pago` | `pagoEm = date_approved` |
| `rejected` | `cc_rejected_*`, etc. | `falhou` | paciente pode tentar de novo **no mesmo link** (a preference continua válida) → um novo payment chega depois; `mpPaymentId` é sobrescrito pelo mais recente que não seja `rejected` anterior a um `approved` — regra: `approved` sempre vence |
| `cancelled` | `expired` ou qualquer | `expirado` | link/boleto venceu; psicóloga gera nova cobrança (apaga a antiga ou edita `expiraEm`) |
| `refunded`, `charged_back` | | **sem mudança** (`pago`) | registrado só em `EventoPagamento.payload`; estorno é tratado no painel do MP. Se quiser refletir no status, é o 5º valor `estornado` que você descartou em Q9 |

Preference sem nenhum payment até `expiraEm` → a reconciliação marca `expirado` localmente (não há webhook para "ninguém pagou").

**Webhook**: `POST /api/pagamento/webhook`; validar `x-signature` (HMAC-SHA256 com `MP_WEBHOOK_SECRET`, manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`) antes de qualquer gravação; inválida → 401. Responder 200 rápido.

**Fallback (tela de status)**: `GET /api/pagamento/:id/status` → se `status ∉ {pago}` e `ultimaReconciliacaoEm` há > 30 s: buscar payments da preference (`payment.search({ external_reference })`) e sincronizar o mais recente; senão devolver o banco. As páginas `/pagamento/{sucesso,pendente,falha}` (back_urls) chamam esse endpoint com `?cobranca=<id>`.

---

## 5. Fluxos de cadastro, primeiro acesso e agendamento

Há **dois** caminhos para um paciente existir [regra D1 + regra "psicóloga cadastra"]:

**A. Psicóloga cadastra** (`origemCadastro = psicologa`) → `Usuario{senhaHash:null}` + `Paciente` → token `primeiro_acesso` (7 d) → botão `wa.me` com `https://<site>/primeiro-acesso?token=…` → paciente define senha (`POST /api/auth/primeiro-acesso`, transação: `updateMany token where usadoEm null and expiraEm > now` → 0 linhas = 400; `update usuario senhaHash`) → JWT emitido.

**B. Visitante agenda** (`origemCadastro = autocadastro`) — ordem obrigatória [regra D1]:

```
1. /agendamento (anônimo): calendário mensal + horários livres do dia (GET público, derivado — §1.5)
2. escolhe data+hora  → guardado só no estado da página (nada no banco, nada "segurado")
3. "Continuar" → se tem conta: login (email+senha → JWT)
                  se não: formulário de cadastro (nome, email, telefone, nascimento, [cpf], responsável se menor,
                          modalidade, motivo, observações) + SENHA definida aqui       [?] Q15
4. submit → POST /api/agendamento { inicio, dadosCadastro? }  →  transação Serializable da §1.6.1
              cria Usuario+Paciente (se cadastro) e a Consulta{agendada, criadaPor: paciente}
              409 "horário indisponível" se outro completou antes — a página volta ao passo 1 com o calendário atualizado
5. sucesso → já logado (JWT) → tela de confirmação + link para a área do paciente
```

Sem reserva temporária: entre 2 e 4 o horário continua livre para todos. Quem fecha a transação primeiro leva.

**Login**: `POST /api/auth/login { email, senha }` → `senhaHash null` → `403 "defina sua senha pelo link de primeiro acesso"` (mensagem genérica se o email não existe) → `bcrypt.compare` → JWT `{ sub, papel, pacienteId? }` em cookie `httpOnly; secure; sameSite=lax`, expiração 8 h, sem refresh (Q10 aberto). **Esqueci a senha**: token `redefinicao_senha` (1 h) gerado pela psicóloga e enviado por `wa.me` (Q5 aberto).

---

## 6. Convenção canônica de dia da semana

**Enum `DiaSemana { segunda, terca, quarta, quinta, sexta, sabado, domingo }`** — sem número. Elimina na raiz o conflito legado (comentário `0-6` em `src/types/index.ts:18` vs. uso real `1-7`, `1 = segunda`). Conversão única na app:

```ts
const POR_GETDAY = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'] as const;
export const diaSemanaDe = (d: Date) => POR_GETDAY[d.getDay()];   // d já em America/Sao_Paulo
```

Migração dos seeds: `diaSemana 1..6` → `segunda..sabado` (o legado não tem domingo). O comentário `0-6` desaparece quando `src/types` for substituído pelos tipos gerados.

---

## 7. Divergências legado × modelo — estado atual

| # | Legado | Modelo | Estado |
|---|---|---|---|
| D1 | Visitante escolhe horário, preenche dados, `POST /api/agendamento` cria paciente por email e consulta; senha = `id.slice(-8)` exibida. | Mesmo fluxo de **intenção** (visitante → horário → cadastro/login → consulta), mas com senha definida pelo paciente (ou login) e sem `id.slice(-8)`. | **Decidido** (rev. 2). Resta Q15 (senha no autocadastro). |
| D2 | `admin123` literal. | Seed via env. | Decidido. |
| D3 | `HorarioDisponivel` slot a slot (`hora "09:00"`), 44 seeds recorrentes. | `HorarioAtendimento` slot a slot — **idêntico**. Seeds migram 1:1. | **Decidido** (rev. 2). |
| D4 | `tipo: 'unico'` = disponibilidade **extra** numa data avulsa (nenhum seed usa; o formulário legado permitia). | Só exceções de indisponibilidade [regra]. | **Aberto** — precisa "abrir um sábado excepcional"? Se sim, `ExcecaoDisponibilidade.tipo { bloqueio, liberacao }`. |
| D5 | `data + hora` strings. | `inicio DateTime`. | Decidido. |
| D6 | `linkMeet` + Meet falso. | Removido (externo). | Decidido (regra). |
| D7 | Pagamento embutido na consulta, **pré**-consulta, Checkout Transparente. | `Pagamento` entidade própria, **pós**-consulta, Checkout Pro. | Decidido. Resta: o único registro de `consultas.json` (`pagamentoId 1341382779`, teste) migra como `Pagamento{pago}` ou é descartado? |
| D8 | Conflito checado em JSON, sem concorrência. | Transação Prisma `Serializable` na API; sem constraint/índice parcial. | Decidido. |
| D9 | `Notificacao.tipo` com `lembrete`. | `lembrete` sai, `pagamento_recebido` entra. | Aberto junto com Q8. |
| D10 | `config.json` completo. | Só 3 campos em `Configuracao`; resto é conteúdo estático. `dadosPagamento.pix` manual → `MetodoPagamento.outro` + `origem: manual` se ainda existir pagamento por fora. | Aberto (pagamento por fora existe?). |
| D11 | `faturas.json` vazio. | Não modelado. | Descartar. |
| D12 | `tipo/motivo/observacoes` do formulário só iam para o WhatsApp. | `Consulta.modalidade/motivo/observacoes`. | Aberto — manter os três? |
| D13 | `cpf` obrigatório. | Opcional. | Q4. |
| D14 | `ConsultaPagamento` em `src/types`. | `PagamentoStatus` (4 valores). | Decidido. |
| D15 | Status editável livremente no modal. | Transições restritas. | Aberto — precisa de "desfazer" administrativo (`realizada → confirmada`)? |
| D16 | Sem avatar; fotos da psicóloga são conteúdo da home. | `Paciente.avatarUrl`; psicóloga sem avatar. | Decidido (Q13). Possibilidade futura: mover para `Usuario.avatarUrl` único. |
| D17 | Modal "Editar" permitia mudar `pagamento` da consulta à mão. | Status de pagamento só via MP (webhook/reconciliação) ou `origem: manual` para pagamento por fora. | Aberto junto com D10. |

---

## 8. Perguntas ainda abertas

- **Q4 · CPF.** Manter `Paciente.cpf`? Com Checkout Pro o MP coleta na página dele. Se ficar, é só para cadastro/recibo.
- **Q5 · Esqueci a senha.** Aceita o fluxo "psicóloga gera link e manda por `wa.me`" (sem email/SMS)?
- **Q6 · `observacoes` × `relatorio`.** `observacoes` visível ao paciente e `relatorio` privado — confirma?
- **Q7 · `encerradaEm`** (um campo para `realizada`/`nao_compareceu`) ou `realizadaEm` + `naoCompareceuEm`?
- **Q8 · `Notificacao`.** Manter o sino in-app do dashboard legado ou remover?
- **Q10 · Revogação de sessão.** JWT puro (logout = apagar cookie) ou tabela `Sessao`?
- **Q12 · LGPD.** Anonimização de paciente (`anonimizadoEm`, apaga nome/telefone/cpf/avatar, mantém consultas)?
- **Q14 · Exclusões do Checkout Pro.** Você pediu excluir `bank_transfer`, `ticket` e `account_money` "deixando PIX, boleto e cartão". Na taxonomia do MP: `bank_transfer` = **PIX**, `ticket` = **boleto**, `account_money` = saldo em conta MP. Excluir os três deixa **só cartão** (crédito/débito). Qual é a intenção: (a) só cartão — mantém a lista; (b) PIX + boleto + cartão — excluir **só** `account_money`; (c) PIX + cartão — excluir `ticket` e `account_money`. Vou copiar do gestor-imoveis o que você confirmar.
- **Q15 · Senha no autocadastro.** No fluxo B (visitante), o paciente define a senha **no formulário de cadastro** (proposta: sim, evita token e ele já sai logado) ou também recebe token de primeiro acesso por `wa.me`?
- **Q3 · Hospedagem do Postgres** (Neon / Vercel Postgres / Supabase) — não muda o schema; muda `DATABASE_URL`, pooling e `prisma.config.ts`.
- **D4, D7 (registro de teste), D10, D12, D15** — ver §7.

---

## 9. O que mudou da revisão 1 para a 2

| Item | Rev. 1 | Rev. 2 |
|---|---|---|
| Prisma | 6 (`prisma-client-js`, `url` no datasource) | **7** (`prisma-client` + `output`, url em `prisma.config.ts`, driver adapter) |
| Duração | motor de slots (`duracaoSlotMin`, `Consulta.duracaoMin`) | **informativa** (`Configuracao.duracaoSessaoMin` exibida); `Consulta.duracaoMin` removido |
| Disponibilidade | `RegraDisponibilidade` com faixa `horaInicio–horaFim` + `vigenteDe/Ate` | **`HorarioAtendimento` um a um** (`diaSemana + hora`, `@@unique`); exceção por data ou data+hora |
| Agendamento de visitante | eliminado | **restaurado**: horário → cadastro/login → consulta na transação; sem reserva temporária |
| Trava de horário | `Consulta.ocupaSlot String? @unique` | **removida**; transação `Serializable` na API |
| `PagamentoStatus` | 6 valores | **4**: `pendente, pago, falhou, expirado`; refund não muda status |
| Meio de pagamento | PIX direto ou Pro (aberto) | **Checkout Pro**; `qrCodeBase64` removido; `linkCobranca = init_point`; nota de `excluded_payment_types` (Q14) |
| `Paciente` | — | `origemCadastro { psicologa, autocadastro }` |
| `MetodoPagamento` | `pix, cartao, outro` | `pix, boleto, cartao, outro` |

---

## 10. Pendências de implementação (Fase 1) — não é schema

- **UI · botões de login/área restrita no cabeçalho**: escondidos quando o sistema foi degradado para só-WhatsApp (`src/app/page.tsx` ~linha 95 tem o `<Link href="/area-restrita">` comentado). Recolocar no header da home e das páginas internas.
- **UI · agendamento real substitui o fluxo degradado**: `src/app/agendamento/page.tsx` hoje abre `wa.me` no submit e tem a chamada à API comentada; passa a seguir o fluxo B da §5 (horário → cadastro/login → `POST /api/agendamento`). O botão de WhatsApp pode permanecer como canal de contato, não como agendamento.
- **Rota de pagamento**: preference do Checkout Pro com `external_reference = consulta.id`, `notification_url`, `back_urls` para `/pagamento/*?cobranca=`, `auto_return`, e `excluded_payment_types` conforme Q14.
- **`src/types/index.ts`**: substituir `Paciente`/`HorarioDisponivel`/`Consulta`/`Notificacao` pelos tipos gerados do Prisma; manter `CONSULTA_STATUS`/`CONSULTA_STATUS_OCUPA_HORARIO` como fonte da lógica de ocupação (podem ser derivados do enum gerado).
- **Migração de dados**: 44 seeds de `horarios-disponiveis.json` → `HorarioAtendimento` (1:1, `diaSemana` numérico → enum); `pacientes.json` fictício → seed de desenvolvimento; `consultas.json` (1 registro de teste) → decidir em D7.
