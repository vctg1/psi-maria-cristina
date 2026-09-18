# Sistema de design — "consultório acolhedor"

Arquivo de tokens: `src/app/tema.css` (importado uma vez em `src/app/layout.tsx`, depois do Bootstrap). Fontes: injetadas por `next/font` no `layout.tsx` como `--font-display` e `--font-corpo`.

**Regra:** nenhuma tela define cor, fonte ou espaçamento fora de `tema.css`. Componentes usam classes `pmc-*`, utilitários Bootstrap e variantes (`btn-primary`, `card`, `alert-*`) — que já herdam o tema pela ponte `--bs-*`. Mudar um token muda o site todo.

## Conceito

Entrar no site deve parecer entrar no consultório: luz quente, madeira clara, uma planta, silêncio. Paz de espírito para um público adulto — caloroso sem ser infantil, sério sem ser clínico. Psicologia sem clichê: nada de cérebro estilizado ou divã; a referência é **respiro** — formas de pedra polida, ondas suaves, grão de papel, sálvia como único verde.

Uma tensão assumida: "creme + serifa + terracota" virou fórmula de design gerado automaticamente. A paleta é decisão do dono e fica; o antídoto está na **execução**: assimetria (a foto num blob, não centrada), separadores em onda em vez de faixas retas, uma serifa com eixo *soft* em vez da display de sempre, um só acento e muito silêncio em volta.

## Paleta

| Token | Hex | Papel | Contraste |
|---|---|---|---|
| `--pmc-fundo` | `#FAF6F0` | página (off-white quente) | — |
| `--pmc-areia` | `#F1E8DC` | seções alternadas, cards | texto 10.7:1 |
| `--pmc-bege` | `#E4D6C3` | bordas, divisores | — |
| `--pmc-argila-clara` | `#D9BFA8` | manchas decorativas | nunca texto |
| `--pmc-texto` | `#3B2F2A` | texto principal (marrom-carvão, não preto) | 12:1 sobre fundo |
| `--pmc-texto-2` | `#6B5B53` | secundário, legendas | 6:1 |
| `--pmc-terracota` | `#A65A40` | **acento único**: botões, ícones | branco sobre ele 5:1; como texto 4.65:1 |
| `--pmc-terracota-escura` | `#8A4A34` | hover, links no texto | 6.3:1 |
| `--pmc-terracota-suave` | `#E7C5B4` | chips, ilustração | — |
| `--pmc-salvia` / `-escura` / `-suave` | `#8C9A84` / `#5E6E58` / `#DCE2D6` | natureza suave, sucesso | escura 5:1 |
| `--pmc-terra-escura` | `#3B2F2A` | rodapé e blocos de ênfase | texto-inv 10.7:1 |
| estados | aviso `#8A6A2F`, erro `#9A3B2E`, info `#5F7A83` | semânticos, separados do acento | ≥ 4.6:1 |

Todos os pares texto/fundo acima cumprem WCAG AA (4.5:1) para texto normal. Tons médios quentes (`argila-clara`, `terracota-suave`, `salvia`) são **só preenchimento** — nunca parágrafo.

## Tipografia

- **Display — Fraunces** (Google Fonts, variável; eixos `opsz` e `SOFT` altos). Serifa "macia": tem calor humano e maturidade sem a rigidez editorial das displays comuns. Peso **500** — 700 endurece. Títulos com `text-wrap: balance`, tracking −0.01em.
- **Corpo — Nunito Sans** (variável). Humanista, terminais suaves, excelente em tamanhos pequenos; sem a cara "de sistema" da Inter. Corpo **17 px / 1.65** — o visitante muitas vezes lê no celular, num momento frágil.
- Escala: 13 · 15 · **17** · 20 · 25 · 32 · 44 → 56 (h1 fluido). Medida de texto 62ch. Rótulos em caixa alta com tracking 0.08em, só onde encodam estrutura.

## Espaço, forma, sombra

- Base 4 px; ritmo vertical em múltiplos de 8; `--pmc-secao-y` fluido (3–6 rem); gutter mínimo 16 px em qualquer largura.
- Raios: 8 / 14 / 24 / pill. **Forma orgânica** = `border-radius` com dois raios por eixo (`--pmc-raio-organico`) — "pedra polida", usada na moldura da foto, nos ícones e nas manchas.
- Sombras em marrom quente translúcido (`rgba(59,47,42,…)`), nunca preto — sombra fria denuncia o "clínico".
- Textura: grão de papel gerado por SVG `feTurbulence` (data URI, sem asset externo), opacidade 6%.
- Separador de seções: onda SVG inline (`.pmc-onda`) em vez de borda reta.
- Movimento: 180 ms, só em hover de botão; desligado em `prefers-reduced-motion`.

## Ilustração e imagem

- Fotos reais da psicóloga (já existentes em `public/`) dentro de `.pmc-blob`, com uma `.pmc-mancha` deslocada atrás — profundidade sem moldura dura.
- Ícones: `bootstrap-icons` (já no projeto) dentro de `.pmc-icone` (disco orgânico). Sem cérebros, sem divã.
- Nenhuma imagem de terceiros. Formas e texturas são geradas em CSS/SVG.

## Ponte com o Bootstrap

`tema.css` redefine as variáveis públicas do Bootstrap (`--bs-body-*`, `--bs-primary`, `--bs-link-*`, `--bs-border-radius`, e as `--bs-btn-*`/`--bs-card-*`/`--bs-alert-*` por componente). Assim `react-bootstrap` continua sendo a biblioteca de componentes e herda o tema sem `!important` nem classes duplicadas. Se algo no Bootstrap parecer "fora do tema", a correção é um token/variável em `tema.css`, não um estilo na tela.

## Classes utilitárias do tema

`.pmc-container` · `.pmc-secao` (`--areia`, `--escura`) · `.pmc-onda` · `.pmc-blob` · `.pmc-mancha` (`--salvia`, `--areia`) · `.pmc-acima` · `.pmc-rotulo` · `.pmc-chip` · `.pmc-icone` (`--salvia`) · `.pmc-header` · `.card--areia`.

## Status

- Etapa 1 (esta): tokens + home (`src/app/page.tsx`) como tela de referência.
- Etapa 2 (após aprovação): login, área da psicóloga, cadastro, primeiro acesso, agendamento — só com estas classes e tokens.
