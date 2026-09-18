# NOTES — sistema multi-agente (hub-and-spoke, 2 níveis)

Notas operacionais para usar os subagentes de `.claude/agents/` neste repositório. As regras de projeto estão em `CLAUDE.md`; aqui é o "como operar".

## 1. Topologia

```
            sessão principal do Claude Code  ← ORQUESTRADOR (hub)
           /            |             |              \
  frontend-dev       api-dev   payment-integration   code-reviewer-security
   (sonnet)          (sonnet)       (sonnet)              (opus, read-only)
```

- **O orquestrador é a sessão principal**, não um arquivo em `.claude/agents/`. Motivo: no Claude Code um subagente não tem a ferramenta `Agent`, portanto não consegue delegar. Só a sessão principal faz fan-out. Isso garante os 2 níveis por construção — nenhum spoke chama outro spoke.
- O modelo do orquestrador é o modelo da sessão (`/model`). Para tarefas que envolvem decomposição, use o mais capaz disponível (Opus). Os spokes têm o modelo fixado no frontmatter (`model: sonnet` para os três de implementação, `model: opus` para o revisor).
- Nenhum dos quatro agentes faz trabalho puramente mecânico, então nenhum usa `haiku`. Se surgir um (ex.: "adicionar campo X em todos os registros de `consultas.json`", "renomear ícone em 20 componentes"), crie um agente dedicado com `model: haiku` e escopo de 1 arquivo/1 padrão.

## 2. Contrato de saída (por que ele existe)

Só a **mensagem final** de um subagente volta para o orquestrador. Tudo que o subagente leu, tentou, editou e desfez no meio do caminho fica no contexto dele e some. Por isso cada agente termina **apenas** com:

```
status: SUCCESS | FAILED
modified_files: [...]
summary_or_errors: ...
```

Consequências práticas:
- Se o bloco final não vier nesse formato, trate como `FAILED` e peça de novo (ou use `SendMessage` para o mesmo agente pedir "reemita só o bloco de saída").
- O orquestrador **não** vê o diff que o subagente fez; ele vê `modified_files` e então roda `git diff -- <arquivos>` se precisar julgar. Isso é intencional — mantém o contexto do hub pequeno.
- `summary_or_errors` é curto em sucesso e detalhado em falha. Não peça ao subagente "explique tudo o que fez"; isso anula a economia.

## 3. Delegação automática vs. explícita

**Automática.** O Claude Code decide sozinho invocar um subagente com base no campo `description` do frontmatter quando a tarefa "parece" com ele. As descriptions foram escritas curtas e específicas de propósito: elas entram no contexto da sessão principal em toda mensagem; o system prompt completo só é carregado quando o agente roda. Se você digitar "crie a página de sucesso do pagamento com Bootstrap", é provável que ele acione `payment-integration` (ou `frontend-dev`) sem você pedir.

**Explícita.** Nomeie o agente na mensagem: "use o subagente `api-dev` para…", "delegue ao `code-reviewer-security`". Isso vence a heurística. Use explícita quando:
- a tarefa cruza domínios e você quer controlar a ordem (ex.: "primeiro `api-dev` cria `POST /api/auth/login`, depois `frontend-dev` liga o `LoginForm`");
- quer rodar o revisor sobre algo que o orquestrador fez sozinho;
- quer forçar paralelo: "rode `frontend-dev` e `payment-integration` em paralelo, cada um com seu escopo".

**Quando não delegar.** Ajuste de 1 arquivo, 1 domínio, sem tocar em `src/app/api`, auth, pagamento ou dados de paciente: o orquestrador faz direto. Cada spawn começa frio (relê arquivos, refaz raciocínio) — é a parte cara. O `code-reviewer-security` continua obrigatório se a mudança encostar em qualquer um daqueles quatro pontos.

**Gerenciar agentes.** `/agents` lista, cria e edita os subagentes (projeto em `.claude/agents/`, pessoais em `~/.claude/agents/`). Os do projeto têm precedência sobre os pessoais de mesmo nome.

## 4. Receita padrão de uma tarefa (fan-out and synthesize)

1. Orquestrador lê só o necessário (`CLAUDE.md` já está no contexto) e escreve, para cada subtarefa: objetivo, arquivos no escopo, contrato (rota/tipo/props), critério de pronto.
2. Dispara os spokes independentes **em paralelo** (uma única mensagem com várias chamadas `Agent`). Dependentes vão em sequência, passando o `summary_or_errors` do anterior como contrato.
3. Recebe os blocos, consolida `modified_files`, roda `npx tsc --noEmit` e `npm run lint` (o build do projeto ignora erros — essa é a única checagem real).
4. Dispara `code-reviewer-security` com a lista consolidada + resumo de intenção + consumidores. `verdict: BLOCKED` → devolve os findings `CRITICAL/HIGH` ao agente de domínio (via `SendMessage`, para reaproveitar o contexto dele) e repete o passo 4.
5. Só então relata ao usuário: o que mudou, variáveis de ambiente novas, dívidas que ficaram.

Exemplo — "implementar login real com bcrypt":
- `api-dev` → `POST /api/auth/login` (bcrypt.compare, cookie httpOnly), `GET /api/auth/validate`, helper de sessão reutilizado em `area-restrita` GET/PUT/PATCH; reporta env `PSICOLOGA_SENHA_HASH`.
- em paralelo `frontend-dev` → `LoginForm.tsx` + `app/login/page.tsx` com react-bootstrap, consumindo o contrato acima (passado pelo orquestrador).
- depois `code-reviewer-security` sobre tudo.

## 5. Continuar um subagente em vez de criar outro

Um subagente que terminou pode ser retomado com `SendMessage` (nome ou id do agente) e mantém o contexto que já construiu. Use isso para: "corrija os findings X e Y do revisor", "reemita a saída no formato", "agora adicione o caso Z". Um novo `Agent` com o mesmo tipo começa do zero e paga tudo de novo.

## 6. Foreground vs. background — e acompanhar pelo celular (Remote Control)

Por padrão os subagentes rodam **em background**: a sessão principal continua livre, você recebe uma notificação quando o agente termina, e enquanto isso só vê que "há uma tarefa rodando" (`/tasks` lista as tarefas em andamento). O orquestrador nunca deve inventar o resultado de um agente que ainda não voltou.

Para **acompanhar ao vivo** uma subtarefa (ver cada leitura/edição/comando do subagente conforme acontece), peça para rodar **in the foreground**:

> "Rode o `payment-integration` **em foreground** para implementar o webhook; quero acompanhar."

Isso faz o orquestrador chamar `Agent` com `run_in_background: false`: a sessão principal fica bloqueada aguardando, e a atividade do subagente aparece na transcrição da sessão conforme acontece. Use foreground quando a próxima ação depende do resultado e você quer poder interromper cedo (ex.: o agente começou a editar arquivo fora do escopo). Na CLI, uma tarefa em foreground pode ser mandada para background com **Ctrl+B** se você mudar de ideia.

**Remote Control (celular).** Na sessão do Claude Code do PC, rode `/remote-control` (ou inicie com `claude remote-control`). Depois, no app do Claude no celular, abra *Code* → a sessão aparece na lista; dali você lê a transcrição, envia mensagens e aprova permissões. O que você vê no celular é exatamente a transcrição da sessão principal — portanto:
- subagente em **foreground** → você vê a atividade dele fluindo no celular em tempo real;
- subagente em **background** → você vê só o "iniciado" e, depois, a notificação de conclusão + o bloco `status/modified_files/summary_or_errors` que o orquestrador relata.

Regra prática para custo: background para tudo que é paralelo e previsível (os três devs em uma tarefa grande); foreground para o `code-reviewer-security` quando você quiser ler os findings na hora, ou para um dev fazendo algo delicado que você quer supervisionar.

## 7. Checklist rápido de custo/qualidade

- Passe ao spoke **só** os caminhos e contratos da subtarefa; nunca "leia o projeto e descubra".
- Prefira `SendMessage` a novo spawn para iterações no mesmo escopo.
- Paralelize o que é independente numa única mensagem.
- Revisor `opus` só uma vez por tarefa, sobre a lista consolidada — não por arquivo.
- Se um spoke devolver prosa em vez do bloco, corrija o hábito na hora (peça só o bloco); o formato é o que mantém o hub barato.
- Nada de `haiku` para código que toca auth/pagamento/dados de paciente.
