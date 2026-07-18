# Reconhecimento Econômico — Resultado por Competência V1

**Status:** proposta de desenho para crítica (Marcelo + orquestradores). Nenhuma linha de código depende disto ainda.
**Autor:** orquestrador (Claude/Cowork), 2026-07-11. **Rev. 3** (2026-07-12) — changelog na seção 8.
**Pré-leitura:** este doc assume o motor semântico atual (Etapas 1–3 + Leitura do Mês + Dashboard reancorado, suíte 103/103) e o princípio de que **realizado e econômico são duas verdades complementares — uma não substitui a outra**.

**Princípio arquitetural central:** a competência produz uma **segunda composição econômica** que reutiliza `FinancialEvent`, `FinancialCompositionItem`, `routeItem`, `resultMapping`, `calculateSemanticResult`, cascata, drill-down e alertas. **Não existe segundo motor**: natureza econômica tem fonte única de verdade. Se algum reuso se mostrar arquiteturalmente inseguro na implementação, a restrição deve ser explicada antes de codar.

---

## 1. As duas perguntas

| Base | Pergunta que responde | Fonte primária |
|---|---|---|
| **Realizado** (existe hoje) | Considerando o que efetivamente liquidou no período, qual foi o resultado reconhecido? | Movimentos (pagamentos/recebimentos) |
| **Econômico** (este doc) | Quanto a operação produziu economicamente no período, independentemente de pagamento? | Documentos + títulos |

Nome público: **[ Realizado ] [ Econômico ]**, com descrição "Econômico — resultado por competência". "Competência" não é o rótulo principal para o pequeno empresário. *(Decisão fechada — Rev. 3.)*

### 1.1 A distinção que sustenta tudo: fato econômico ≠ liquidação financeira

**"Título previsto/em aberto" NÃO significa "venda econômica prevista".** Significa apenas que a liquidação financeira de um fato econômico **já ocorrido** ainda não aconteceu.

São dois eixos independentes:

- **Fato econômico:** ativo/reconhecido · cancelado/anulado.
- **Liquidação financeira:** em aberto · parcial · liquidado · vencido.

Os status atuais do sistema não precisam ser renomeados agora, mas arquitetura e textos devem respeitar essa separação — "previsto" nunca deve ser usado indistintamente para os dois eixos.

O produto ideal, para uma venda de R$ 3.000 realizada em julho com vencimento em agosto, ainda não recebida:

```
Receita econômica reconhecida (julho): R$ 3.000
A receber:                             R$ 3.000
Recebido até agora:                    R$     0
Impacto no caixa realizado:            R$     0
Impacto previsto no caixa (agosto):    R$ 3.000
Qualidade da informação:               Completa / Parcial / Revisão
```

E em liquidação parcial:

```
Receita econômica reconhecida:   R$ 3.000
Já recebido:                     R$ 1.000
Em aberto:                       R$ 2.000
Caixa realizado:                 R$ 1.000
Caixa previsto:                  R$ 2.000
```

Mostrar simultaneamente econômico, contas a receber, realizado, previsto financeiro e qualidade da informação é parte central da visão Aurys. *(North star — definição de pronto futura.)*

---

## 2. Regra de reconhecimento V1 (a decisão central)

**V1: a data de reconhecimento econômico é o `competenceDate` do documento.** Uma regra só, explícita, controlável pelo usuário.

Racional: qualquer tentativa de inferir reconhecimento por entrega/garantia/emissão de nota criaria heurísticas invisíveis — contra o Princípio 4 (não esconder incerteza). O usuário define a competência no lançamento/importação; o Aurys explica o que fez com ela.

### 2.0 Elegibilidade econômica do documento

**Premissa de escopo da V1:** o Aurys hoje não possui orçamento, forecast, pipeline, pedidos ou contratos futuros como módulo. Logo, **todo documento operacional ativo representa, por premissa, um fato econômico já ocorrido.** Disso decorre a tabela completa:

| Situação | Tratamento na base econômica |
|---|---|
| Documento operacional ativo + `competenceDate` válida | **Entra** pelo `competenceDate`. |
| Título em aberto / previsto / vencido | **Não altera o reconhecimento** — é apenas estado da liquidação (eixo financeiro). |
| Documento cancelado/anulado | Fora do Resultado (preservado para auditoria). |
| Sem `competenceDate` confiável | Revisão (`foraDoResultado`, motivo próprio) — nunca some em silêncio. |
| `competenceDate` futura | Só aparece quando a competência correspondente chegar (ver 2.5, as-of). |
| Fato cadastrado antecipadamente que não ocorrer | Responsabilidade do usuário: alterar a `competenceDate` ou cancelar/anular o documento. |

**Não criar `recognitionStatus` (recognized/projected/review) agora** — o código atual não exige. **Gatilho futuro registrado:** se o Aurys passar a suportar formalmente recorrências futuras, contratos, pedidos, orçamentos ou receitas/despesas projetadas, um `recognitionStatus` formal será necessário para separar fato ocorrido de projeção. A V1 não constrói suporte antecipado para o que o produto não tem.

### 2.1 O corte explícito: CMV / estoque — FORA da V1

Compra de R$ 10.000 de mercadorias em julho **não é custo de julho** se só R$ 2.000 daquele estoque foram vendidos. CMV de verdade exige controle de estoque, que o Aurys não tem (e não deve fingir ter — Princípio: não virar ERP).

**Decisão V1:** Compra de Mercadorias é reconhecida na competência da compra, e a simplificação é **estruturalmente explícita**:

- Método declarado no contrato do resultado: `meta.costMethod: 'purchase_date_proxy'` (preparado para um futuro `'cmv'` sem quebrar consumidores).
- **Regra do aviso (sem limiar arbitrário):** sempre que houver Compra de Mercadorias no Resultado Econômico com `costMethod = 'purchase_date_proxy'`, o sistema informa que a margem é aproximada. Materialidade/severidade ficam para depois, com dados reais.
- Microcopy: *"A margem usa as compras de mercadorias do período como aproximação de custo. Ela não representa CMV contábil e pode oscilar quando compras e vendas acontecem em meses diferentes."*

Depreciação/amortização: também fora (já decidido no contexto mestre).

### 2.2 Qualidade de dado (herda do realizado)

Quando só há informação líquida bancária, **não se inventa bruto e taxa**:

```
Recebimento identificado: R$ 2.550
Bruto conhecido:          R$ 2.550
Taxa conhecida:           R$ 0
Qualidade:                parcial
```

Microcopy (nas duas bases): *"Identificado pelo valor líquido. Bruto e taxas não puderam ser separados com os dados disponíveis."*

Essa sinalização deve, futuramente, orientar o usuário a importar o relatório detalhado do marketplace (que traz bruto e taxas reais).

### 2.3 Aplicação por tipo de evento

| Evento | Reconhecimento V1 | Observações |
|---|---|---|
| Prestação de serviço | `competenceDate` do documento | Usuário aponta a data da prestação. Contrato/nota/vencimento são irrelevantes para o reconhecimento. |
| Venda marketplace | `competenceDate` do documento | A data da venda pode ser **importada** ou **sugerida como default pelo importador** ao preencher a competência — não é uma segunda regra de reconhecimento. Entrega, garantia e liberação NÃO adiam o reconhecimento — são eventos de caixa. |
| Venda a prazo / parcelada | Integral na `competenceDate` | Parcelas são calendário de caixa, não de resultado. |
| Estorno / devolução | `competenceDate` do estorno | **Não retroage** à venda original (decisão fechada, ver 6.1). |
| Taxas e deduções de venda | Acompanham o documento da venda | Mesma competência da venda a que pertencem. |
| Encargos financeiros | `competenceDate` do documento | |
| Despesa fixa (aluguel etc.) | `competenceDate` | Aluguel de julho pago em agosto pertence a julho — o caso em que a competência brilha. |
| Título renegociado | **Competência original** (decisão fechada, ver 6.2) | Renegociação altera vencimento/cronograma/condições — não altera quando o fato econômico ocorreu. Desconto, juros, multa, perdão ou novo encargo gerados na renegociação são reconhecidos **separadamente**, conforme sua natureza e data econômica. |
| Transferências, retenções, pagamento de cartão | **Fora do resultado nas duas bases** | São movimentações, não fatos econômicos. |

### 2.4 Origem e qualidade da `competenceDate`

A data econômica precisa de rastreabilidade de origem. O desenho prevê (sem exigir schema agora):

```
competenceDateSource: 'user_defined' | 'imported' | 'suggested_default' | 'unknown_review'
```

- `user_defined` — o usuário informou/confirmou: qualidade máxima.
- `imported` — veio de campo explícito da fonte (ex.: data da venda no relatório ML).
- `suggested_default` — o importador preencheu por heurística: entra no resultado, mas conta para o indicador de qualidade do período (uma data defaultada tem qualidade diferente de uma confirmada — isso não se esconde).
- `unknown_review` — sem origem confiável: revisão (ver 2.0).

V1 pode derivar essa origem sem migração (lançamento manual = user_defined; importação = imported/suggested_default conforme a fonte); a persistência formal do campo entra se/quando a implementação exigir.

### 2.5 Mês corrente e as-of date

Regra técnica do "até agora":

```
asOfDate = min(hoje, fimDoPeríodo)
```

- Mês passado → período completo.
- Mês atual → até hoje (veredito "está no azul até agora", comparações neutras — mesmo padrão já implementado no realizado).
- Mês futuro → fatos com `competenceDate` futura não são reconhecidos antes da competência chegar.

**Atenção:** isto não cria camada de forecast. A premissa permanece: documento operacional ativo representa fato econômico ocorrido; a `competenceDate` apenas define a qual período o fato pertence.

---

## 3. Arquitetura

### 3.1 O que NÃO muda

- `FinancialCompositionItem`, `routeItem`, `resultMapping`, linhas da cascata, exclusões, alertas: **reuso integral**. A camada de roteamento é agnóstica à base. **Não existe `routeAccrualItem`.**
- O motor realizado continua exatamente como está: sem os parâmetros novos (opcionais), o comportamento é byte a byte o atual.

### 3.2 O que nasce

```
type ResultBasis = 'realized' | 'accrual';   // meta.basis já existe como 'realized'
```

**Um segundo construtor de eventos**, paralelo ao atual:

```
buildAccrualComposition(documents, titles, categories, contacts)
  → { events: FinancialEvent[]; metaByDocumentId: Record<string, RecognitionMeta> }
```

Diferenças em relação ao `buildFinancialComposition` (realizado):

1. Fonte = documentos **elegíveis** (ver 2.0), não movimentos.
2. `event.date` = `competenceDate` (não paymentDate).
3. Valores = valores do documento (gross/fee/freight quando existirem; total quando não).
4. `affectsCash` = false em tudo (caixa é dimensão do realizado/fluxo).

### 3.3 Contrato dos metadados de liquidação (fechado na Rev. 3)

**Separação aprovada:** `FinancialCompositionItem` = semântica econômica (intacto); metadados de liquidação = estrutura própria do Resultado.

**Nível do metadado — documento, não item semântico.** Não existe resposta automática confiável para "quanto do R$ 1.000 liquidado pertence ao `sale_gross` de 3.000 e quanto à `marketplace_fee` de −450". Atribuir liquidação por item seria falsa precisão. Os valores vivem no nível do **documento/evento/título** — salvo se um dia existir regra explícita e comprovável de alocação.

```
interface RecognitionMeta {
  documentId: string;                                  // chave de ligação
  settlementStatus: 'settled' | 'partial' | 'open';   // eixo da liquidação (2 eixos, ver 1.1)
  documentRecognizedAmount: number;                    // valor econômico reconhecido (documento)
  documentSettledAmount: number;                       // efetivamente liquidado
  documentOpenAmount: number;                          // em aberto (títulos)
  unexplainedDiff?: number;                            // liquidado ≠ reconhecido − aberto
  recognitionBasis: ResultBasis;
  dataQuality: {
    competenceDateSource: 'user_defined' | 'imported' | 'suggested_default' | 'unknown_review';
    netOnly?: boolean;                                 // identificado pelo líquido (2.2)
  };
}
```

Respondendo o contrato ponto a ponto:

1. **Onde nasce:** em `buildAccrualComposition`, calculado dos títulos/movimentos de cada documento no momento da composição (uma vez por documento).
2. **Chave de ligação:** `documentId` — o `FinancialEvent` e o `ResultContributor` do motor atual **já carregam `documentId`**; nenhum campo novo no evento ou no item.
3. **Como chega ao agregador:** `calculateSemanticResult(events, snapshot, mesISO, { basis: 'accrual', metaByDocumentId })` — parâmetro **opcional**; ausente (caso realizado), nada muda.
4. **Como chega ao drill-down:** o agregador anexa `recognitionMeta?` ao `ResultContributor` e ao `ExcludedItem` via lookup por `documentId` (campo novo **opcional** nesses dois tipos de saída — que são do Resultado, não do extrato). O Sheet de drill-down lê dali.
5. **Sem duplicação:** o metadado existe uma vez por documento no mapa; contribuintes apenas referenciam. Nenhuma soma usa `RecognitionMeta` (as linhas continuam somando `item.amount`) — ele é rastreabilidade, não valor de cascata.
6. **Sem contaminar o extrato:** `FinancialCompositionItem` e `FinancialEvent` não ganham campos; o Extrato Inteligente não é tocado.

### 3.4 Anti-dupla contagem (regra de ouro)

As duas bases **nunca se somam**. São visões alternativas do mesmo conjunto de documentos. O toggle troca a fonte de eventos; nenhuma tela exibe soma mista. Alertas de *comparação* entre bases são permitidos e desejáveis (ex.: "R$ 3.000 reconhecidos em julho ainda não liquidados").

### 3.5 Riscos conhecidos a testar

- Documento sem `competenceDate` (legado/importação): revisão na base econômica, não some.
- Liquidação divergente (desconto, juros na baixa): a base econômica usa o valor do documento; a diferença fica explícita em `unexplainedDiff` → **alerta acionável** (ver 6.3), não ajuste silencioso e não motor de conciliação novo.
- Liquidação parcial: nunca reduzida a um rótulo — `documentRecognizedAmount`, `documentSettledAmount` e `documentOpenAmount` preservados (o drill-down mostra os três).
- Estorno com competência em mês diferente da venda: correto por desenho (2.3/6.1).
- Mês corrente: as-of date (2.5).

---

## 4. Contrato de UI

Página Resultado ganha o toggle:

```
Resultado    [ Realizado ]  [ Econômico ]
```

Microcopies (uma por base, sempre visíveis):

- **Realizado:** "Resultado reconhecido a partir dos eventos efetivamente liquidados no período. Valores previstos não estão incluídos."
- **Econômico:** "Resultado por competência: reconhecido pela data econômica dos lançamentos, independentemente de pagamento ou recebimento. Custos de mercadoria são reconhecidos na compra (não é CMV contábil)."

Drill-down na base econômica mostra, por contribuinte, o estado de liquidação do documento (liquidado / parcial / em aberto) com os três valores. **Dashboard permanece Realizado na V1** (decisão fechada, ver 6.4); no futuro pode exibir uma comparação curta entre as duas verdades, sem toggle.

---

## 5. Sequência de implementação (quando aprovada)

1. **Etapa C1** — `buildAccrualComposition` + `RecognitionMeta` + extensão opcional do `calculateSemanticResult` + testes (espelho da Etapa 1 do realizado: motor isolado, nada consome; realizado provado intacto por regressão).
2. **Etapa C2** — toggle na página Resultado + microcopies + drill-down com estado de liquidação.
3. **Etapa C3** — alertas de comparação entre bases ("reconhecido e não liquidado", "diferença não explicada de R$ X — classifique como desconto, taxa, juros, estorno ou ajuste").
4. Gatilho de prioridade: primeiro usuário com perfil de serviços/prazo, ou fechamento da 3Am evidenciando a dor.

---

## 6. Decisões fechadas (Rev. 3)

1. **Estorno NÃO retroage à venda original.** Venda em julho, devolução em agosto: julho mostra a venda, agosto mostra o estorno. Retroação só como correção explícita de erro histórico, futuramente — nunca padrão.
2. **Título renegociado usa a competência ORIGINAL.** Efeitos financeiros da renegociação (desconto, juros, multa, perdão, encargo) são fatos econômicos próprios, reconhecidos separadamente na sua data.
3. **Liquidação divergente → alerta acionável**, sem novo motor de conciliação. Ex.: reconhecido 3.000, liquidado 2.850, em aberto 0 → "Há R$ 150 de diferença ainda não explicada. Classifique como desconto, taxa, juros, estorno ou ajuste."
4. **Dashboard sem toggle na V1.** Dashboard = Realizado; página Resultado = [Realizado][Econômico].
5. **Nome público = "Econômico"**, descrito como "resultado por competência".
6. **Sem `recognitionStatus` na V1** (premissa: documento ativo = fato ocorrido); gatilho futuro registrado em 2.0.
7. **Metadados de liquidação no nível do documento**, anexados via `documentId`, sem tocar `FinancialCompositionItem`/`FinancialEvent` (contrato em 3.3).
8. **Aviso de CMV sem limiar numérico** na V1 (presença de Compra de Mercadorias + `purchase_date_proxy` basta).

## 7. Questões que permanecem abertas

1. Materialidade/severidade do aviso de margem aproximada (CMV proxy) — definir com dados reais, pós-V1.
2. Textos reais de **reversão** de retenção no extrato ML — ainda não mapeados; até lá, reversões positivas ficam em revisão com sugestão.
3. Momento de persistir `competenceDateSource` formalmente (schema) — decidir na implementação da C1, conforme necessidade real.
4. Formato futuro da "comparação curta entre as duas verdades" no Dashboard (pós-V1).
5. Alocação de liquidação por item semântico — só se um dia existir regra comprovável; fora do horizonte atual.

## 8. Changelog Rev. 2 → Rev. 3

- **Elegibilidade (2.0) reescrita** sob a premissa correta: documento operacional ativo = fato econômico ocorrido; "título previsto" reclassificado como estado de liquidação, não fato previsto; linha de "previsto/projetado" removida; `recognitionStatus` explicitamente adiado com gatilho futuro registrado.
- **Nova seção 1.1**: os dois eixos (fato econômico × liquidação financeira) e a proibição de usar "previsto" para ambos.
- **Contrato técnico dos metadados fechado (3.3)**: nasce no `buildAccrualComposition`, chave = `documentId`, viaja por parâmetro opcional do `calculateSemanticResult`, anexado a `ResultContributor`/`ExcludedItem`, sem tocar extrato; **nível = documento** (sem alocação por item semântico — falsa precisão).
- **CMV**: removido o limiar de 20%; aviso passa a ser por presença do método proxy; nova microcopy.
- **Nova seção 2.5**: as-of date (`min(hoje, fimDoPeríodo)`), sem criar forecast.
- **Questões abertas da Rev. 2 fechadas** (seção 6): estorno sem retroação, renegociado na competência original, divergência via alerta acionável, Dashboard sem toggle, nome público "Econômico".
- **North star ampliado** (1.1): inclui qualidade da informação e o exemplo de liquidação parcial.
- **Princípio arquitetural central** explicitado no cabeçalho: uma composição nova, zero motor paralelo, reuso de todo o roteamento; restrições de reuso devem ser explicadas antes de codar.
