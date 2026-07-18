# Etapa C1 — Desenho Técnico (Resultado por Competência / base `accrual`) — **Rev. 3 (aprovado, pré-código)**

**Status:** APROVADO com ajustes finais. Pronto para virar prompt de escopo fechado do Claude Code. **Nenhuma linha de código depende disto ainda.**
**Base:** Rev. 3 do `reconhecimento-economico-competencia-v1.md` + decisões do Marcelo de 2026-07-13 (Rev.2) + ajustes finais de 2026-07-13 (esta Rev.3).

**Decisões finais fechadas (Rev.3):** (1) `documentRecognizedAmount` de venda ecom = bruto/`sale_gross`. (2) `resultImpactAmount` = soma assinada dos itens `affectsResult`. (3) `expectedSettlementAmount` = líquido esperado quando determinável. (4) Renegociado fora de settled/open. (5) **Sem hook na C1** — hook fica para C2 (domínio + testes só). (6) Frete deduz `expectedSettlementAmount` **apenas** quando `shippingCost` representar dedução/custo que reduz o repasse. (7) Transferência positiva: limitação aceita, **T-TR obrigatório**. (8) `settlementStatus` ganha `'untracked'` para documento sem título rastreável. (9) Todos os títulos cancelados → **revisão** (`unknown_review`), não `cancelado` — não há sinal de cancelamento em nível de documento no schema atual.
**Ancorado no código real** (HEAD `37abf3d`, suíte 103/103): `semanticResult.ts`, `resultMapping.ts`, `extract.ts` (`buildFinancialComposition`, `classifyEventType`, tipos `FinancialEvent`/`FinancialCompositionItem`), `types/financial.ts` (`FinancialDocument`/`Title`/`Movement`).

**Decisão de arquitetura desta rodada:** **Opção A aprovada** — decomposição paralela em `buildAccrualComposition`, **sem tocar `extract.ts`**. O teste de consistência entre bases (**T-CB**) é obrigatório. A Opção A **não** é fonte permanente de verdade: após a base Econômica ser validada em uso, reavaliamos extrair um helper compartilhado (C2/C3).

**Regra de ouro:** o motor Realizado sai **byte a byte idêntico**. Todo parâmetro novo é opcional; ausente → comportamento atual. `routeItem` e `resultMapping` **intocados** — natureza econômica com fonte única.

---

## 1. Escopo de arquivos (final)

### Criar (4)
| Arquivo | Papel |
|---|---|
| `src/domain/finance/accrualComposition.ts` | `buildAccrualComposition(...)` — 2º construtor de eventos, fonte = documentos. Produz `FinancialEvent[]` + `metaByDocumentId`. |
| `src/domain/finance/recognitionMeta.ts` | Tipos `RecognitionMeta`, `ResultBasis`, `CompetenceDateSource`, `AccrualExclusionReason` + helper puro `computeRecognitionMeta(doc, titlesDoDoc)`. |
| `src/test/accrualComposition.test.ts` | Testes do construtor (itens por tipo, meta de liquidação, sinais, elegibilidade, exclusão). |
| `src/test/accrualResult.test.ts` | Ponta a ponta `buildAccrualComposition → calculateSemanticResult({basis:'accrual'})`, T-CB, prova de identidade do Realizado, generalização comércio/serviço/híbrido. |

### Alterar (1)
| Arquivo | Alteração |
|---|---|
| `src/domain/finance/semanticResult.ts` | (a) alargar `meta.basis` para `ResultBasis`; (b) `options: CalculateResultOptions`; (c) filtro de período com `asOfDate`; (d) anexar `recognitionMeta?` a `ResultContributor`/`ExcludedItem`; (e) exclusão por `accrualExclusionReason`; (f) `label`/`microcopy`/`costMethod`/`marginApproximated`/`asOfDate` por base. Todo caminho novo guardado por `basis === 'accrual'` ou parâmetro ausente. |

**Escopo total: 5 arquivos.**

### NÃO tocar (explícito)
`extract.ts` · `resultMapping.ts` · `routeItem` · `buildFinancialComposition` · Extrato · **Dashboard** · **DREPage** · schema/banco · nenhum teste existente.

---

## 2. Contratos TypeScript (revisados)

```ts
// recognitionMeta.ts
export type ResultBasis = 'realized' | 'accrual';

export type CompetenceDateSource =
  | 'user_defined'      // lançamento manual / usuário confirmou
  | 'imported'          // campo explícito da fonte (ex.: data da venda no relatório ML)
  | 'suggested_default' // importador preencheu por heurística
  | 'unknown_review';   // sem origem confiável → revisão

export type AccrualExclusionReason = 'cancelado' | 'unknown_review';

export interface RecognitionMeta {
  documentId: string;

  // --- Três dimensões econômicas distintas (nunca colapsadas num número só) ---
  documentRecognizedAmount: number;    // valor econômico PRINCIPAL do documento (a "venda"/"despesa" cheia)
  resultImpactAmount: number;          // soma ASSINADA dos itens affectsResult === true (P&L)
  expectedSettlementAmount?: number;   // caixa líquido que o documento espera movimentar (quando determinável)

  // --- Eixo da liquidação (títulos) ---
  documentSettledAmount: number;       // efetivamente liquidado
  documentOpenAmount: number;          // ainda em aberto
  unexplainedDiff?: number;            // divergência documento × títulos (§3.7)

  settlementStatus: 'settled' | 'partial' | 'open' | 'untracked'; // untracked = sem título rastreável (§3.6)
  recognitionBasis: ResultBasis;       // sempre 'accrual' na V1

  // --- Motivo de exclusão vem EXPLÍCITO do construtor (§4.4) ---
  // V1 emite apenas 'unknown_review'. 'cancelado' fica RESERVADO para quando existir
  // sinal de cancelamento em nível de DOCUMENTO (hoje o schema não tem — §4.1).
  accrualExclusionReason?: AccrualExclusionReason;

  dataQuality: {
    competenceDateSource: CompetenceDateSource;
    netOnly?: boolean;                 // identificado só pelo líquido (Rev.3 §2.2)
  };
}
```

```ts
// semanticResult.ts — extensão retrocompatível
export interface CalculateResultOptions {
  confidenceThreshold?: number;                 // já existe
  basis?: ResultBasis;                          // default 'realized'
  metaByDocumentId?: Record<string, RecognitionMeta>;
  asOfDate?: string;                            // 'YYYY-MM-DD'; só consumido no accrual
}

// ResultContributor e ExcludedItem: +1 campo opcional cada
//   recognitionMeta?: RecognitionMeta;

// SemanticResult.meta:
meta: {
  basis: ResultBasis;                           // ⬅ alargado de 'realized'
  periodo: string;
  confidenceThreshold: number;
  totalAffectsCash: number;
  totalAffectsResult: number;
  label: string;
  microcopy: string;
  asOfDate?: string;                            // accrual
  costMethod?: 'purchase_date_proxy';           // accrual, quando há Compra de Mercadorias
  marginApproximated?: boolean;                 // accrual: true se há custo por proxy no período
}
```

```ts
// accrualComposition.ts
export function buildAccrualComposition(
  documents: FinancialDocument[],
  titles: Title[],
  categories: Category[],
  contacts?: Contact[]
): { events: FinancialEvent[]; metaByDocumentId: Record<string, RecognitionMeta> };
```

`calculateSemanticResult` muda de `options?: { confidenceThreshold?: number }` para `options?: CalculateResultOptions` (superset, retrocompatível).

---

## 3. As três dimensões, os sinais e o contrato de títulos (o coração desta revisão)

### 3.1 Regra de ouro dos valores
**Um número nunca representa venda, impacto no resultado e liquidação esperada ao mesmo tempo.** Alinhado ao DNA: venda ≠ recebimento; resultado ≠ caixa; não inventar precisão; não misturar dimensões.

### 3.2 Definição final dos três valores
| Campo | Definição operacional | Fonte |
|---|---|---|
| `documentRecognizedAmount` | valor econômico **principal** do documento: o item-âncora (`sale_gross` para venda; `total` para despesa/receita avulsa) | documento |
| `resultImpactAmount` | **soma assinada** dos itens do `semanticBreakdown` com `affectsResult === true` | itens (documento) |
| `expectedSettlementAmount?` | caixa líquido que o documento **espera** movimentar (venda: bruto − taxas − **frete¹**; despesa: total). Indeterminável ⇒ `undefined` (ex.: `netOnly`) | documento |

¹ **Frete (decisão 6):** `shippingCost` só é deduzido do `expectedSettlementAmount` quando representar **custo/dedução que reduz o repasse** ao vendedor. Se o frete for repassado/cobrado do cliente (não reduz o líquido do vendedor), **não** deduz. Sinal prático na V1: o `shipping_cost` é tratado como dedução do esperado apenas quando entra como item `outflow` na venda ecom (mesmo critério que já reduz o resultado). Caso o modelo não distinga os dois cenários para um doc, mantém-se a dedução conservadora e marca-se qualidade — sem inventar precisão.

### 3.3 Exemplos (sinais aplicados — §3.4)
```
Venda ML (bruto 3000, taxa 450):
  documentRecognizedAmount =  3000
  resultImpactAmount       =  2550     // 3000 − 450
  expectedSettlementAmount =  2550
  documentSettledAmount    =  2550
  documentOpenAmount       =     0
  unexplainedDiff          =     0

Consultoria sem taxa (3000, a receber, não recebida):
  documentRecognizedAmount =  3000
  resultImpactAmount       =  3000
  expectedSettlementAmount =  3000
  documentSettledAmount    =     0
  documentOpenAmount       =  3000

Despesa 3000 (a pagar, 1000 pago / 2000 aberto):
  documentRecognizedAmount = -3000
  resultImpactAmount       = -3000
  expectedSettlementAmount = -3000
  documentSettledAmount    = -1000
  documentOpenAmount       = -2000
```

### 3.4 Contrato de sinais (explícito, sem ambiguidade)
**Todos os campos monetários do `RecognitionMeta` são ASSINADOS.**
```
Receitas / contas a receber  →  positivo
Despesas / contas a pagar    →  negativo
```
- O sinal de `recognized`/`resultImpact`/`expected` decorre da natureza dos itens (venda +, despesa −), que já vêm assinados do `semanticBreakdown`.
- O sinal de `settled`/`open` decorre do **lado do título** (§3.6): `receber → +`, `pagar → −`.
- Consequência: para um mesmo documento, todos os campos têm o mesmo sinal (venda tudo +, despesa tudo −). Isso mantém a fórmula de divergência consistente independentemente do lado.

### 3.5 Coerência com a cascata
`RecognitionMeta` é **rastreabilidade, não valor de cascata**. A cascata continua somando `item.amount` dos itens roteados. **Nenhum** dos três valores da meta é somado em linha alguma. (Confirma Rev.3 §3.3.5 e decisão do Marcelo item 7.)

### 3.6 Contrato completo de status/lado dos títulos (`computeRecognitionMeta`, puro)
Entrada: `doc` + `titlesDoDoc = titles.filter(t => t.documentId === doc.id)`.

| Questão | Regra V1 |
|---|---|
| **Lado (receber/pagar)** | `title.side` quando presente; senão inferir de `doc.type` (`venda`/`receita`/`receita_avulsa` → receber; `despesa`/`compra` → pagar). |
| **Normalização de sinal** | receber → `+value`; pagar → `−value`. Aplicada a `settled` e `open`. |
| **Liquidado** (`documentSettledAmount`) | soma assinada de títulos `status ∈ {pago, recebido}` (`.value`). |
| **Aberto** (`documentOpenAmount`) | soma assinada de títulos `status ∈ {previsto, atrasado}` (`.value`). |
| **Vencido** | `atrasado` = **aberto** (não liquidado). Vencimento é eixo de calendário, não altera reconhecimento. |
| **Renegociado** | título `renegociado` é **excluído de settled e de open** (cronograma superado). A liquidação real vem dos títulos-substitutos (com status normais). Se não houver substituto, o documento fica `untracked` no eixo da liquidação — mas **continua reconhecido economicamente** (o fato não some); o gap vira alerta em C3. *Escolha conservadora para evitar dupla contagem; ver R3.* |
| **Cancelado** | título `cancelado` excluído de settled/open. **Todos os títulos cancelados ⇒ NÃO assumir documento cancelado** — não há sinal de cancelamento em nível de documento no schema (§4.1). Vai para **revisão** (`unknown_review`), não `cancelado`. |
| **Sem título** | `settled = 0`, `open = 0`, `settlementStatus = 'untracked'`, `unexplainedDiff = undefined`. O documento **continua reconhecido economicamente**; `untracked` é rótulo do eixo de liquidação, não exclusão do resultado. |
| **Parcial** | parte liquidada, parte aberta → `settlementStatus = 'partial'`, ambos preenchidos. |
| **Título × documento divergem** | detectado por `unexplainedDiff` (§3.7) — **não** somamos títulos cegamente; a divergência é explicitada, não absorvida. |

**`settlementStatus`** (ordem de decisão, sobre os títulos *rastreáveis* = exclui `cancelado` e `renegociado`):
1. **nenhum título rastreável** → `untracked`;
2. `open == 0` e há liquidado → `settled`;
3. `settled == 0` e há aberto → `open`;
4. senão → `partial`.

### 3.7 `unexplainedDiff` (divergência documento × títulos, sem motor de conciliação)
```
unexplainedDiff = expectedSettlementAmount − (documentSettledAmount + documentOpenAmount)
```
- Só calculado quando `expectedSettlementAmount` é determinável **e** `settlementStatus !== 'untracked'` (sem título rastreável não há o que reconciliar — não é divergência).
- Gravado apenas quando `|diff| ≥ 0,005` (tolerância de arredondamento).
- Exemplos: ML `2550 − (2550+0) = 0`; consultoria `3000 − (0+3000) = 0`; doc de 3000 cujos títulos só somam 2850 → `150` → **alerta acionável na C3**, nunca ajuste silencioso.

---

## 4. `buildAccrualComposition` — algoritmo

Uma passada por documento (não por movimento).

### 4.1 Elegibilidade e motivo explícito de exclusão (decisão item 4)
O **construtor** decide e **carimba** o motivo; o agregador **não adivinha**.
1. `titlesDoDoc = titles.filter(t => t.documentId === doc.id)`.
2. **`competenceDate` vazio/inválido** → `accrualExclusionReason = 'unknown_review'`, `competenceDateSource = 'unknown_review'`, `event.date = doc.createdAt` (fallback só para não sumir).
3. **Todos os títulos `cancelado`** (e havia títulos) → **`accrualExclusionReason = 'unknown_review'`** (revisão), **não** `'cancelado'`. Racional: o schema **não** tem cancelamento em nível de documento (`FinancialDocument` sem `status`/`isActive`/flag de cancelamento — só `TitleStatus` tem `cancelado`), logo "todos os títulos cancelados" é **indício**, não prova, de documento anulado. Na dúvida, revisão (Princípio 4), nunca sumir como cancelado. `event.date = doc.competenceDate || doc.createdAt`.
4. Caso normal → sem `accrualExclusionReason`.

> `AccrualExclusionReason` mantém `'cancelado'` **reservado** para quando existir um sinal de cancelamento de documento (futuro). O construtor V1 **não emite** `'cancelado'`.

O evento é emitido **em todos os casos** (nada some); o agregador (§5.4) lê `accrualExclusionReason` do `metaByDocumentId` e manda os itens para `foraDoResultado` com esse motivo, **sem** chamar `routeItem`.

### 4.2 Data, origem, qualidade
- `event.date = doc.competenceDate` (a diferença central vs. Realizado, que usa `paymentDate`).
- `origin`: `doc.sourceType` presente ⇒ ecommerce (mesma regra do Realizado).
- `competenceDateSource`: manual → `user_defined`; importado → `imported`/`suggested_default` conforme a fonte (derivável de `sourceType`/`importBatchId`, sem schema).
- `netOnly = true` quando só o líquido é conhecido (não inventa bruto/taxa).

### 4.3 `semanticBreakdown` por natureza (valores do DOCUMENTO), reusando `classifyEventType`
`affectsCash = false` em **todos** os itens (caixa é dimensão do Realizado). `affectsResult` e `confidence` idênticos ao Realizado por tipo.

| Tipo (via `classifyEventType`) | Itens (fonte = documento) |
|---|---|
| Venda / venda ecom | `sale_gross` (+`doc.grossAmount ?? doc.totalValue`); se ecom: `marketplace_fee` (−`doc.marketplaceFee`), `shipping_cost` (−`doc.shippingCost`). **Sem** `reserve_*` e **sem** `net_payout` (caixa). |
| Estorno/devolução (`chargeback`) | um item `chargeback`/`refund` assinado por `direction`, na `competenceDate` do estorno (não retroage). |
| Receita manual/avulsa (`revenue`) | `manual_income` (+`doc.totalValue`). |
| Despesa/compra (`expense`) | `manual_expense` (−`doc.totalValue`). Custo Variável vs Despesa Operacional vs Financeiro **continua vindo da categoria dentro do `routeItem`**. |
| Transferência/reserva/repasse (`transfer`/`reserve`/`repasse`) | `internal_transfer`/`reserve_*` — `routeItem` já exclui nas duas bases. |

**`classifyEventType` é reusado como está** (import de `extract.ts`, sem alterá-lo). Isso garante que a decisão de natureza é **a mesma** das duas bases — base da resposta ao item 6 (§7).

### 4.4 `costMethod` / `marginApproximated`
Se houver ao menos um item de Compra de Mercadorias (categoria `custo`/`custo_variavel`) reconhecido no período accrual → `meta.costMethod = 'purchase_date_proxy'` e `meta.marginApproximated = true`. Microcopy do Rev.3 §2.1.

---

## 5. Ligação com `calculateSemanticResult`

### 5.1 SEM hook na C1 (decisão 5)
A C1 é **domínio + testes apenas**. O hook `useSemanticAccrualResult` fica para a **C2**, junto com o toggle da página Resultado. Os testes ponta a ponta chamam a composição diretamente (sem React Query):
```ts
// dentro do teste (não é hook):
const { events, metaByDocumentId } = buildAccrualComposition(
  snapshot.documents, snapshot.titles, snapshot.categories, snapshot.contacts
);
const asOfDate = minISO(todayISO(), endOfMonthISO(monthISO));
const result = calculateSemanticResult(events, snapshot, monthISO, {
  basis: 'accrual', metaByDocumentId, asOfDate,
});
```
Assim a C1 não cria nenhum ponto de consumo (nem hook, nem UI); a superfície é 5 arquivos (§1).

### 5.2 `documentRecognizedAmount` e afins não entram na cascata
Reafirmado: a cascata soma `item.amount`. A meta é anexada por lookup, para drill-down/alertas.

### 5.3 Corte as-of (Rev.3 §2.5, amarrado)
```ts
const inPeriod = (e) => (e.date || '').startsWith(monthISO)
  && (!options?.asOfDate || (e.date || '') <= options.asOfDate);
```
- Realizado: `asOfDate` ausente → filtro **idêntico** ao atual.
- Accrual: `asOfDate = min(hoje, fimDoMês)` → competência futura no mês corrente não é reconhecida ainda. Sem forecast.

### 5.4 Anexar meta e excluir por motivo explícito
No laço existente, para cada item:
1. `meta = options.metaByDocumentId?.[event.documentId]`.
2. Se `basis==='accrual'` e `meta?.accrualExclusionReason` → push para `foraDoResultado` com esse motivo; **não** chama `routeItem`. (`foraDoResultado` continua sendo o único produtor de exclusões — contrato dos alertas.)
3. Senão, roteia por `routeItem` (inalterado) e anexa `recognitionMeta: meta` ao `ResultContributor`/`ExcludedItem`.

---

## 6. Como provar que o Realizado NÃO mudou (inalterado da Rev.1, reforçado)
1. **Estrutural:** todo caminho novo guardado por `basis==='accrual'` / presença de `asOfDate` / `metaByDocumentId`.
2. **Regressão:** suíte inteira (103/103) verde, **sem** tocar nenhum teste existente.
3. **Identidade (teste dedicado):** para um snapshot fixo, `calculateSemanticResult(ev, snap, mês)` e `(…, { basis:'realized' })` retornam **deep-equal**, incluindo `meta`.
4. **Tipo:** `tsc` verde em `DREPage`, `Dashboard`, `resultSeries`, `resultAlerts`, `monthReading` após alargar `meta.basis`.

Commit só com os 4 verdes **e** revisão do diff real (não só do relatório do executor).

---

## 7. Decisão sobre transferência positiva (item 6 — resposta honesta)

**Fato do código:** `classifyEventType` avalia **palavras-chave da descrição** (`transferência`/`ted`/`pix`/`depósito`/`repasse`/`liberação`/`payout`…) **antes** de cair em `doc.type === 'venda'`. Logo:

- **A C1 barra** a transferência positiva **quando a descrição carrega o termo** → `eventType='transfer'` → `internal_transfer` → excluído do resultado nas duas bases. **Isto será provado por teste** (T-15/T-TR): transferência positiva com descrição de transferência **não** entra em Receita Bruta no accrual.
- **Bloqueador declarado (residual):** uma transferência **tipada `venda` com descrição neutra** (sem termo) cairia em `sale` → `sale_gross` → Receita Bruta. **A C1 não pode fechar esse furo com segurança**, porque:
  1. a raiz é o **persister** gravar transferência como `type:'venda'` (fora do escopo — não tocar `extract.ts`/persister);
  2. o accrual **reusa** `classifyEventType`, então qualquer correção aqui mudaria também o **Realizado** (viola "Realizado idêntico");
  3. corrigir na origem é o item de backlog "transferência positiva cria doc 'venda' no persister".

**Conclusão:** a C1 **não piora** o cenário (herda a mesma proteção e o mesmo furo do Realizado, de forma consistente) e **não deixa passar silenciosamente** o caso com descrição-termo. O caso descrição-neutra fica **explicitamente registrado como bloqueador conhecido**, endereçável só na correção do persister. Fixture cobrindo os dois ramos (com termo → excluído; sem termo → documenta o furo) entra na suíte.

---

## 8. Testes (atualizados)

**Construtor (`accrualComposition.test.ts`)**
T-01 venda serviço → `sale_gross`/`manual_income` na `competenceDate`, `affectsCash=false`.
T-02 venda ecom gross/fee/freight → 3 itens, valores do doc.
T-03 despesa fixa (aluguel jul pago ago) → reconhecida em julho.
T-04 compra de mercadorias → Custo Variável; ativa `costMethod` + `marginApproximated`.
T-05 estorno em mês ≠ venda → não retroage.
T-06 renegociado → competência original; título renegociado fora de settled/open (§3.6).
T-07 sem `competenceDate` → `accrualExclusionReason='unknown_review'`, aparece em `foraDoResultado`.
T-08 todos títulos `cancelado` → `accrualExclusionReason='unknown_review'` (**revisão**, não `cancelado`), preservado.
T-08b sem título / só renegociado → `settlementStatus='untracked'`, `unexplainedDiff=undefined`, **mas o fato econômico entra na cascata** (não é excluído).
T-09 **sinais**: venda tudo +, despesa tudo − (recognized/resultImpact/expected/settled/open) — §3.3/3.4.
T-10 três valores distintos numa venda ML (3000/2550/2550) — não colapsam.
T-11 `RecognitionMeta` liquidação: settled/partial/open + os 3 valores.
T-12 `unexplainedDiff` ≠ 0 (doc 3000, títulos 2850) e `=undefined` sem título.
T-13 `netOnly=true` → sem inventar bruto/taxa; `expectedSettlementAmount=undefined`.

**Agregador / ponta a ponta (`accrualResult.test.ts`)**
T-14 as-of: competência futura no mês corrente não reconhecida; mês passado completo.
T-15 cascata accrual fecha para comércio, serviço e híbrido.
T-16 `tax` só reduz receita com `deducao_imposto` (via accrual).
T-TR **transferência positiva com descrição de transferência → NÃO entra em Receita Bruta** (item 6).
T-17 investimento → fora, motivo próprio.
**T-CB (consistência entre bases, obrigatório):** docs 100% liquidados no mês da competência → **linhas do accrual == linhas do Realizado** (mesma classificação e valores). Protege a Opção A.
T-ID (identidade do Realizado, §6.3): sem options ≡ `{basis:'realized'}` deep-equal.

Alvo: suíte verde + ~22–26 testes novos.

---

## 9. Critérios de aceite (C1) — atualizados
1. 5 arquivos exatamente (§1); `extract.ts`/`resultMapping.ts`/`routeItem`/`buildFinancialComposition`/Extrato/Dashboard/DREPage/schema **intocados**.
2. `buildAccrualComposition`, `computeRecognitionMeta`, tipos — puros e isolados; **sem hook e sem UI na C1** (decisão 5; hook fica para C2). Exercitados só por testes.
3. Três valores econômicos **distintos** implementados conforme §3.2, nunca colapsados; sinais conforme §3.4.
4. Contrato de títulos §3.6 implementado — **sem soma cega**: renegociado/cancelado/sem-título/parcial/divergência tratados explicitamente; `settlementStatus` inclui `'untracked'`.
5. `accrualExclusionReason` carimbado **pelo construtor**; agregador não adivinha (§4.1/§5.4). V1 emite só `'unknown_review'`; todos-cancelados → revisão, não `cancelado`.
6. Transferência positiva: T-TR provando o ramo com-termo + bloqueador residual declarado (§7).
7. `RecognitionMeta` nunca entra na soma da cascata; nenhuma tela mistura bases.
8. `asOfDate = min(hoje, fimDoPeríodo)`; Realizado provado idêntico (§6, 4 verdes + T-ID); `costMethod`/`marginApproximated`/`netOnly` presentes.
9. Suíte inteira verde (103 atuais + novos), T-CB e T-ID inclusos. Sem migration, sem UI.

---

## 10. Pontos abertos — TODOS FECHADOS na Rev.3
1. **`documentRecognizedAmount` de venda ecom = bruto/`sale_gross`.** ✔ Fechado (decisão 1).
2. **Renegociado fora de settled/open.** ✔ Fechado (decisão 4); sem substituto → `untracked`, fato ainda reconhecido.
3. **Hook:** ✔ Fechado — **sem hook na C1**, hook na C2 (decisão 5).
4. **Frete no `expectedSettlementAmount`:** ✔ Fechado — só deduz quando `shippingCost` reduz o repasse (decisão 6, nota ¹ em §3.2).
5. **`untracked` + todos-cancelados→revisão:** ✔ Fechado (decisões 8 e 9).

**Nenhum ponto aberto. O desenho está pronto para virar prompt de código.**

## 11. Changelog

### Rev. 2 → Rev. 3 (aprovado, pré-código)
- 7 decisões do Marcelo confirmadas no cabeçalho; **sem hook na C1** (hook → C2).
- `settlementStatus` ganha **`'untracked'`** (documento sem título rastreável); `unexplainedDiff=undefined` nesse caso; fato econômico **continua reconhecido**.
- Todos os títulos cancelados → **revisão** (`unknown_review`), **não** `cancelado` — confirmado que `FinancialDocument` não tem sinal de cancelamento; `'cancelado'` fica reservado para futuro.
- Frete deduz `expectedSettlementAmount` só quando reduz o repasse (nota ¹, §3.2).
- §10 zerado (nenhum ponto aberto); testes T-08 ajustado + T-08b (untracked).

### Rev. 1 → Rev. 2
- Escopo corrigido para **5 arquivos** (inclui `semanticResult.ts`); lista "não tocar" ampliada (Dashboard/DREPage).
- `RecognitionMeta` reestruturado: **três dimensões econômicas distintas** (`documentRecognizedAmount`, `resultImpactAmount`, `expectedSettlementAmount`) além dos campos de liquidação.
- **Contrato de sinais** explícito (receber/receita +, pagar/despesa −).
- **Contrato completo de status/lado dos títulos** (§3.6) — vencido/renegociado/cancelado/sem-título/parcial/divergência, sem soma cega.
- **`accrualExclusionReason`** carimbado pelo construtor (agregador não adivinha).
- **Transferência positiva** (§7): decisão honesta — proteção por descrição provada em teste + bloqueador residual (descrição-neutra) declarado.
- `unexplainedDiff` re-ancorado em `expectedSettlementAmount` (divergência documento × títulos).
- Testes e critérios de aceite atualizados (T-09 sinais, T-10 três valores, T-TR transferência, T-CB/T-ID mantidos).
