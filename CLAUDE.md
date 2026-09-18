# psi-maria-cristina — guia para o Claude Code

Site de uma psicóloga (agendamento, pagamento, área restrita). Este arquivo descreve **o que existe de fato** no repositório, não o ideal. Onde o estado real diverge do esperado, está marcado como *dívida conhecida*.

## Stack real (package.json)

| Camada | O que é usado |
|---|---|
| Framework | Next.js `^15.5.9`, **App Router** (`src/app`), TypeScript `^5` (`strict: true`), Turbopack em `dev` e `build` |
| React | `19.1.0` |
| UI | `bootstrap ^5.3.8` (CSS global), `react-bootstrap ^2.10.10`, `bootstrap-icons ^1.13.1` |
| Pagamento | `mercadopago ^2.9.0` (SDK Node, só no servidor) + SDK JS `https://sdk.mercadopago.com/js/v2` (só no cliente) |
| Auth | `bcrypt ^6.0.0` (instalado, **ainda não usado em nenhum arquivo**), `uuid ^13.0.0` (usado para ids de paciente/consulta/horário) |
| Persistência | **Não há banco de dados.** Arquivos JSON em `src/data/` lidos/escritos com `fs` (`readFileSync`/`writeFileSync`) dentro dos route handlers |
| Lint | ESLint 9 flat config (`eslint.config.mjs`, `next/core-web-vitals` + `next/typescript`), com `no-explicit-any`, `no-unused-vars` e `no-img-element` desligados |
| Path alias | `@/*` → `./src/*` |

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.

> **Atenção:** `next.config.ts` tem `eslint.ignoreDuringBuilds: true` e `typescript.ignoreBuildErrors: true`. O build **passa mesmo com erros de tipo e lint**. Para validar uma mudança use explicitamente `npx tsc --noEmit` e `npm run lint`.

## Estrutura real

```
src/
  app/
    layout.tsx                  Server Component. Importa globals.css, bootstrap.min.css e bootstrap-icons.css. Metadata/OpenGraph.
    page.tsx                    'use client'. Home (header sticky/fixed, CTA para /agendamento e WhatsApp).
    globals.css                 Variáveis CSS (--primary-color etc.) e reset.
    page.module.css             Sobra do template; NÃO é importado por ninguém.
    agendamento/page.tsx        'use client'. Wizard de 3 passos; no submit abre wa.me (WhatsApp). A chamada a /api/agendamento está COMENTADA.
    area-restrita/page.tsx      2.934 linhas, 100% COMENTADAS (login + dashboard da psicóloga + área do paciente). A rota hoje não renderiza nada.
    login/page.tsx              VAZIO (placeholder)
    pagamento/sucesso/page.tsx  VAZIO
    pagamento/pendente/page.tsx VAZIO
    pagamento/falha/page.tsx    VAZIO
    api/                        (ver "Rotas de API")
  components/
    Calendario.tsx              'use client'
    CalendarioAgendamento.tsx   'use client'. Usa react-bootstrap Button e Table. fetch /api/disponibilidade e /api/horarios.
    CheckoutTransparente.tsx    Sem diretiva (usa hooks; só funciona importado de um Client Component). Carrega SDK JS do MP, PIX + cartão via /api/pagamento-checkout.
    GerenciadorConsultas.tsx    'use client'. fetch /api/consultas/[id] (PUT/DELETE) e /api/consultas (rota que NÃO existe).
    ModalConfirmacao.tsx        'use client'
    NotificacaoProvider.tsx     'use client'. Context de toasts (useNotificacao). Não confundir com src/data/notificacoes.json.
    Loading.tsx                 Spinner com inline style.
    LoginForm.tsx               VAZIO
  contexts/
    AuthContext.tsx             VAZIO (não existe contexto de auth funcional)
  data/                         "banco": config.json, pacientes.json, consultas.json, faturas.json, horarios-disponiveis.json, notificacoes.json
  types/index.ts                Paciente, HorarioDisponivel, Consulta, ConfigSite, Notificacao
  utils/cartoesTesteMercadoPago.js  Cartões e CPF de teste do MP (sandbox)
  home-images/                  Fotos usadas na home
public/                         maria-cristina-logo.png, CristinaVestido.jpeg, CristinaLivro.jpeg, svgs do template
```

### Rotas de API (`src/app/api`)

| Rota | Métodos | O que faz de verdade |
|---|---|---|
| `agendamento/route.ts` | POST | Valida paciente, cria/acha paciente por email (uuid), cria consulta (`status: 'agendada'`, `pagamento: 'pendente'`), cria notificação, opcionalmente chama `/api/pagamento` via `fetch` interno. **Retorna `acessoAreaRestrita: { email, senha: id.slice(-8) }`.** |
| `area-restrita/route.ts` | POST, GET, PUT, PATCH | POST = **login** (ver Auth). GET `?action=dashboard / consultas / pacientes[&id] / notificacoes`. PUT atualiza consulta. PATCH marca notificação lida. **Nenhum método verifica quem chama.** |
| `auth/login/route.ts` | — | VAZIO |
| `auth/validate/route.ts` | — | VAZIO |
| `consultas/[id]/route.ts` | PUT, DELETE | Atualiza status / remove consulta. Usa `params` síncrono (padrão Next 14; no Next 15 `params` é Promise — *dívida conhecida*). |
| `disponibilidade/route.ts` | GET | `?ano=&mes=` → dias com horário livre. |
| `horarios/route.ts` | GET, POST, DELETE | CRUD de `horarios-disponiveis.json`; GET `?data=&disponiveis=true`. |
| `pagamento/route.ts` | POST, PUT | POST cria **Preference** (Checkout Pro) com `back_urls` → `/area-restrita?pagamento=...` e `notification_url` → `/api/pagamento/webhook` (**rota que não existe**). PUT é um esboço de webhook que só faz `console.log`. |
| `pagamento-checkout/route.ts` | POST, GET, PUT | POST cria **Payment** com token de cartão (ou PIX). GET gera PIX (QR base64 + copia-e-cola). PUT consulta status por `paymentId` e, se `approved`, marca consulta como `pago`. |
| `pagamento-direto/route.ts` | POST | Cria Payment enviando **número/CVV do cartão crus** para o MP (sem tokenização). Mascara no log. |
| `mercadopago/route.ts` | — | VAZIO |

## Server vs Client Components — como o projeto faz

- Padrão real: **tudo que tem `useState`/`useEffect`/eventos começa com `'use client';` na linha 1** (`page.tsx`, `agendamento/page.tsx`, quase todos os `components/*`). O único Server Component é `layout.tsx`.
- Não há `server-only`, Server Actions, `cookies()`/`headers()`, middleware nem `loading.tsx`/`error.tsx`. Toda comunicação cliente→servidor é `fetch('/api/...')` a partir de Client Components.
- Route handlers usam `NextRequest`/`NextResponse` de `next/server`, leem query via `new URL(request.url).searchParams`, body via `request.json()`, e respondem `NextResponse.json({...}, { status })`. Erros: `{ error: 'mensagem' }` com 400/401/404/409/500. Cada rota repete seus próprios helpers `getX()/saveX()` com `join(process.cwd(), 'src/data/...')`.
- Regra para código novo: componente com estado/efeitos/evento → `'use client'` explícito na primeira linha (mesmo que hoje `CheckoutTransparente` não tenha). Página que só compõe componentes pode ficar Server Component. Nunca importe `fs`, `mercadopago`, `bcrypt` ou `src/data/*.json` de um arquivo que tenha `'use client'`.

## Padrão de UI (Bootstrap / react-bootstrap)

- Bootstrap CSS e bootstrap-icons são importados **uma vez** em `layout.tsx`. Não reimportar.
- Componentes react-bootstrap são importados por caminho (`import Button from 'react-bootstrap/Button'`, `import Table from 'react-bootstrap/Table'`) ou nomeado (`import { Button } from 'react-bootstrap'`). Hoje só `Button` e `Table` são usados.
- Ícones: `<i className="bi bi-whatsapp" />` (bootstrap-icons).
- O layout existente é majoritariamente **inline `style={{}}`** + hook próprio de responsividade (`window.innerWidth` → `isMobile`/`isTablet`) + variáveis de `globals.css`. Isso é legado; **código novo** deve usar componentes react-bootstrap (`Container`, `Row`, `Col`, `Card`, `Form`, `Modal`, `Alert`, `Spinner`, `Navbar`…) e classes utilitárias Bootstrap (`d-flex`, `mb-3`, `text-center`, breakpoints `col-md-*`) em vez de inline style para layout/responsividade.
- **Não** usar Tailwind, styled-components, CSS Modules avulsos nem `<style jsx>` em código novo (`page.module.css` está órfão; `<style jsx>` aparece em `Loading`/`NotificacaoProvider`, mas não é padrão — o projeto não tem styled-jsx configurado).
- Texto da UI em **português (pt-BR)**; datas com `toLocaleDateString('pt-BR')`; use `+ 'T12:00:00'` ao converter `YYYY-MM-DD` para `Date` (padrão já adotado para evitar problema de fuso).

## Como a auth funciona HOJE (estado real, não o ideal)

1. Não existe sessão, cookie, JWT nem token. O "login" é um `POST /api/area-restrita` com `{ email, senha, tipo }`:
   - `tipo === 'psicologa'`: compara com credenciais **fixas no código** (`psicologa@mariacristina.com` / `admin123`).
   - `tipo === 'paciente'`: acha o paciente por email em `pacientes.json` e aceita `senha === paciente.id.slice(-8)` (últimos 8 chars do UUID). Essa mesma "senha" é devolvida em texto puro pelo `POST /api/agendamento` (`acessoAreaRestrita`).
   - Em sucesso devolve `{ success, tipo, paciente (objeto inteiro), consultas }`.
2. O "estado logado" vivia apenas em `useState` da página `area-restrita/page.tsx` (`isLoggedIn`, `userType`, `userData`) — página hoje inteiramente comentada. Recarregar a página = deslogar. Para "recarregar dados" a página refazia o POST de login com `id.slice(-8)`.
3. `GET/PUT/PATCH /api/area-restrita`, `/api/horarios` (POST/DELETE) e `/api/consultas/[id]` **não checam autenticação** — qualquer cliente HTTP lê a lista completa de pacientes (nome, email, telefone, CPF, data de nascimento).
4. `bcrypt` está instalado e **não é importado em lugar nenhum**. `api/auth/login`, `api/auth/validate`, `contexts/AuthContext.tsx`, `components/LoginForm.tsx` e `app/login/page.tsx` são arquivos vazios (placeholders de uma refatoração não iniciada).
5. `uuid` (`v4`) é usado para gerar ids em `api/agendamento` e `api/horarios`.

**Regras para qualquer trabalho em auth** (valem a partir de agora, mesmo sem mexer no legado):
- Hash/compare de senha só com `bcrypt` (`bcrypt.hash(senha, 10)` / `bcrypt.compare`) e **só dentro de `src/app/api/**`**. Nunca guardar senha em texto puro em `src/data/*.json`, nunca devolver hash nem senha em resposta JSON.
- Não comparar senha com `===`. Não derivar senha de id.
- Credenciais fixas e tokens só via `process.env`, nunca literais no código.
- Se for criar sessão, faça no servidor (cookie `httpOnly` emitido pelo route handler); o cliente nunca recebe o segredo que valida a sessão.

## Como o MercadoPago está integrado HOJE

- **Servidor** (`mercadopago` SDK Node): `new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })`. Três rotas coexistem (ver tabela): `pagamento` (Preference/Checkout Pro), `pagamento-checkout` (Payment com token de cartão + PIX + verificação de status) e `pagamento-direto` (Payment com dados crus do cartão). `api/mercadopago/route.ts` está vazio.
- **Cliente** (`CheckoutTransparente.tsx`): injeta `<script src="https://sdk.mercadopago.com/js/v2">` e instancia `new window.MercadoPago('<public key>')`. Tokeniza cartão e chama `/api/pagamento-checkout`. PIX: GET gera QR, depois `setInterval` de 3s fazendo PUT para checar status (para em `approved` ou após 10 min).
- Valor da consulta está **hardcoded em 150** nas rotas (existe `valorConsulta` em `src/data/config.json`, não usado por elas).
- Status de pagamento na consulta: `pagamento: 'pendente' | 'pago' | 'cancelado'` + campos extras `pagamentoId`, `pagamentoData` gravados em `consultas.json` quando `response.status === 'approved'`.
- Variáveis de ambiente: `MP_ACCESS_TOKEN` (servidor), `NEXT_PUBLIC_URL` (base para `back_urls`/`notification_url`/fetch interno). `.env*` está no `.gitignore`; não há `.env.example`.

**Dívidas conhecidas (reportar; não "consertar de passagem" sem pedido):**
- `pagamento-checkout` e `pagamento-direto` têm um **access token `TEST-…` literal como fallback** de `process.env.MP_ACCESS_TOKEN`.
- `CheckoutTransparente` tem a **public key `TEST-…` literal** (deveria vir de `NEXT_PUBLIC_MP_PUBLIC_KEY`).
- `notification_url` aponta para `/api/pagamento/webhook`, que não existe; o esboço de webhook é `PUT /api/pagamento` e não atualiza nada nem valida assinatura (`x-signature`).
- `pagamento-direto` transporta número/CVV do cartão pelo nosso servidor (PCI). Preferir sempre tokenização no cliente (`pagamento-checkout`).
- `pagamento-checkout` POST devolve `payment: response` (objeto completo do MP) para o cliente.
- `GerenciadorConsultas` chama `/api/consultas` (POST), que não existe.

**Regras para qualquer trabalho em pagamento:**
- `MP_ACCESS_TOKEN` só em route handlers; **nunca** em `NEXT_PUBLIC_*`, nunca em Client Component, nunca em log.
- Public key vai em `NEXT_PUBLIC_MP_PUBLIC_KEY` — é o único dado do MP que pode chegar ao cliente.
- Webhook (quando implementado) deve ser `POST`, validar `x-signature`/`x-request-id`, buscar o pagamento por id no MP (não confiar no body) e usar `external_reference` = `consultaId` para atualizar `consultas.json`.
- Respostas ao cliente devolvem só o necessário (`status`, `statusDetail`, `paymentId`, QR), nunca o objeto bruto do MP.

## Fronteira servidor/cliente e dados de paciente — REGRA DURA

- `src/app/api/**` é **a única fronteira de servidor**. Só ali entram `fs`, `mercadopago`, `bcrypt`, `process.env.*` sem prefixo `NEXT_PUBLIC_` e leitura/escrita de `src/data/*.json`.
- `src/data/*.json` contém **dados reais de paciente** (nome, email, telefone, CPF, data de nascimento) e está commitado. Esses arquivos **nunca** são importados por Client Components nem servidos inteiros ao navegador sem necessidade.
- Toda resposta de API que sai para o cliente deve conter **apenas os campos que a tela precisa**. Endpoints que listam pacientes/consultas de todos são exclusivos da psicóloga e precisam de verificação de identidade no servidor antes de responder (hoje não há — qualquer trabalho na área restrita deve incluir isso).
- Segredos (`MP_ACCESS_TOKEN`, senhas, hashes) jamais aparecem em: Client Components, `NEXT_PUBLIC_*`, respostas JSON, `console.log`, commits.
- `NEXT_PUBLIC_*` é público por definição — só URL base e public key do MP.

## Orquestração multi-agente (hub-and-spoke, 2 níveis)

Este projeto usa subagentes definidos em `.claude/agents/`. **A sessão principal do Claude Code é o único orquestrador** (hub). Subagentes (spokes) não delegam entre si — no Claude Code um subagente não pode invocar outro. Detalhes operacionais em `NOTES-multiagent.md`.

Como o orquestrador trabalha — *fan-out and synthesize*:
1. **Decompõe** a tarefa em subtarefas por domínio, cada uma com escopo de arquivos explícito.
2. **Delega** cada subtarefa ao agente certo, passando **só o contexto necessário** (caminhos, contrato da API, tipos de `src/types/index.ts`, trecho relevante deste CLAUDE.md). Nenhum subagente lê o repositório inteiro.
3. Subtarefas independentes rodam **em paralelo**; dependentes (ex.: rota nova → depois UI que a consome) rodam em sequência, passando o contrato da primeira para a segunda.
4. **Sintetiza**: junta os blocos `status / modified_files / summary_or_errors` de cada subagente, resolve conflitos de arquivo e valida (`npx tsc --noEmit`, `npm run lint`).
5. **Portão final obrigatório**: antes de declarar qualquer tarefa concluída, roda `code-reviewer-security` sobre os `modified_files` consolidados. Achados `CRITICAL`/`HIGH` voltam para o agente de domínio corrigir; só então a tarefa termina.

| Agente | Domínio | Modelo |
|---|---|---|
| `frontend-dev` | `src/app/**/page.tsx`, `src/app/layout.tsx`, `src/components/**`, `src/contexts/**` (UI, Bootstrap, Client Components) | sonnet |
| `api-dev` | `src/app/api/**` exceto rotas de pagamento; `src/types/**`; leitura/escrita de `src/data/*.json` | sonnet |
| `payment-integration` | `src/app/api/pagamento*/**`, `src/app/api/mercadopago/**`, `src/components/CheckoutTransparente.tsx`, `src/app/pagamento/**` | sonnet |
| `code-reviewer-security` | somente leitura, audita o diff; portão final | opus |

Contrato de saída de todo subagente (o orquestrador só lê isto):
```
status: SUCCESS | FAILED
modified_files: [caminhos]
summary_or_errors: curto em sucesso; detalhado só em falha
```

Tarefas pequenas (1 arquivo, 1 domínio, sem risco de segurança) o orquestrador pode fazer diretamente sem delegar — mas ainda passa pelo `code-reviewer-security` se tocar em `src/app/api`, auth, pagamento ou dados de paciente.
