# Prompt de handoff — Repositório de Analytics Financeiro (ETL + DW)

> **Como usar:** copie todo o conteúdo da seção **「PROMPT PARA A IA」** abaixo e cole como primeira mensagem no novo repositório de analytics/ETL. Anexe este arquivo e, se possível, um export JSON de `rj-notas-saved-exports` e `rj-notas-invoices` do navegador da Rosania.

---

## PROMPT PARA A IA

Você está me ajudando a criar um **projeto paralelo de análise de dados financeiros** (data warehouse analítico + ETL). Este projeto é **separado** do app gerador de recibos (`studio-rm`), mas será **alimentado por ele** e futuramente por um app similar do meu padrasto.

### Objetivo do projeto

1. Criar um **modelo analítico** (star schema ou equivalente) para recibos/notas de pagamento.
2. Ter **uma família de tabelas por emissor** (pessoa/negócio), começando pela **Rosania (minha mãe)**.
3. Implementar **ingestão inicial** dos recibos da Rosania.
4. Preparar **views SQL** para dashboards futuros (frontend virá depois).
5. Expor um **endpoint de ingestão** que o botão **Salvar** do app `studio-rm` chamará após gerar JPEG/PDF.

Não preciso de frontend de dashboard agora. Foco: **schema, migrations, ETL, API de ingestão, views analíticas**.

---

### Contexto do sistema fonte — `studio-rm` (Rosania)

App Next.js 15, client-side, que gera **notas de pagamento** para modelagem/costura.

**Fluxo relevante:**
- Usuário edita um recibo no **Editor** (dados estruturados em `Invoice`).
- Ao clicar **Salvar** (botão amarelo), o app:
  1. Renderiza o preview em 600px off-screen
  2. Gera **JPEG** ou **PDF** (conforme configuração `saveFormat`)
  3. Salva em `localStorage` (`rj-notas-saved-exports`) para exibir em **Minhas Notas**
  4. **(A implementar neste ETL)** deve também **POSTar um payload analítico** para este repositório

**Importante:** existem **dois níveis de dados**:
| Camada | Onde vive hoje | Uso analítico |
|--------|----------------|---------------|
| **Rascunho estruturado** | `rj-notas-invoices` → `Invoice[]` | Fonte principal para fatos e dimensões |
| **Artefato final** | `rj-notas-saved-exports` → `SavedExport[]` | Metadado de export + blob (JPEG/PDF base64) |

Para analytics financeiros, **`Invoice` + `items` é a fonte de verdade numérica**. `SavedExport` registra *quando* e *como* foi formalizado o recibo.

---

### Separação por emissor (multi-tenant lógico)

Teremos **recibos de duas origens** com schemas parecidos:

| `source_system` | Emissor | Tabelas analíticas (sugestão) |
|-----------------|---------|-------------------------------|
| `studio-rm-rosania` | Rosania Moreira Aragão / Rosania Modelista | `rosania_*` |
| `studio-rm-padrasto` | (app futuro, estrutura similar) | `padrasto_*` |

**Regra:** não misturar dados na mesma tabela fato sem coluna `source_system`. Para v1, crie **apenas o pipeline Rosania** (`rosania_*`), mas deixe o código ETL extensível para o segundo emissor.

---

### Modelo de dados de entrada — Rosania

#### `Invoice` (recibo estruturado)

```typescript
interface Invoice {
  id: string;                    // UUID — PK do rascunho
  invoiceNumber: string;         // UUID — "Ref." exibida no recibo
  clientName: string;            // obrigatório
  service?: string;              // "Tipo de Serviço" no cabeçalho
  issueDate: string;             // ISO date "yyyy-MM-dd"
  companyName: string;
  showEmitter: boolean;
  emitterDocumentType: 'cpf' | 'cnpj' | null;
  deliveryFee: number;           // >= 0
  adjustment: number;            // positivo = acréscimo, negativo = desconto
  pricePerMeter: number;         // legado, default 0
  items: InvoiceItem[];          // >= 1
}

interface InvoiceItem {
  id: string;
  ref?: string;
  type: string;                  // coluna "Tipo" (dropdown)
  description: string;         // coluna "Descrição" (dropdown)
  total: number;                 // "Valor Final" da linha — campo principal
  quantity: number;              // legado (UI oculta)
  unitPrice: number;             // legado
  isRisk: boolean;               // legado
}
```

#### Emissor (lookup estático no app, deve ser denormalizado na ingestão)

| `emitterDocumentType` | Nome | Documento |
|-----------------------|------|-----------|
| `cpf` | Rosania Moreira Aragao | 857.154.093-49 |
| `cnpj` | Rosania Modelista | 64.539.517/0001-36 |

Só aparece no recibo se `showEmitter === true`.

#### Campos derivados (calcular no ETL, não vêm do app)

```
subtotal          = SUM(items.total)
adjustment_kind   = adjustment < 0 ? 'discount' : 'increase'
adjustment_amount = ABS(adjustment)
grand_total       = subtotal + delivery_fee + adjustment
item_count        = COUNT(items)
```

#### `SavedExport` (metadado do Salvar)

```typescript
interface SavedExport {
  id: string;
  invoiceId: string;       // FK → Invoice.id
  clientName: string;
  invoiceNumber: string;
  format: 'jpeg' | 'pdf';
  data: string;            // data URI base64 — NÃO enviar para DW; ir para object storage
  createdAt: string;       // ISO timestamp
}
```

---

### Contrato de API de ingestão (a ser chamado pelo botão Salvar)

**Endpoint sugerido:** `POST /api/v1/ingest/rosania/receipt`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <INGEST_API_KEY>
X-Idempotency-Key: <export.id ou invoice.id + createdAt>
```

**Body (payload analítico — sem o blob base64):**

```json
{
  "source_system": "studio-rm-rosania",
  "event_type": "receipt.saved",
  "event_id": "uuid-do-saved-export",
  "event_at": "2026-06-20T15:30:00.000Z",
  "export": {
    "id": "uuid-export",
    "format": "jpeg",
    "file_mime_type": "image/jpeg"
  },
  "receipt": {
    "id": "uuid-rascunho",
    "invoice_number": "uuid-ref",
    "client_name": "Maria Silva",
    "service_type": "Modelagem",
    "issue_date": "2026-06-20",
    "company_name": "Sua Empresa",
    "show_emitter": true,
    "emitter": {
      "document_type": "cpf",
      "legal_name": "Rosania Moreira Aragao",
      "document_number": "857.154.093-49"
    },
    "delivery_fee": 0,
    "adjustment": -15.5,
    "adjustment_kind": "discount",
    "lines": [
      {
        "line_id": "item-1",
        "line_order": 1,
        "ref": "2",
        "tipo": "Acabamento",
        "descricao": "Vestido",
        "line_total": 100.0
      }
    ],
    "totals": {
      "subtotal": 100.0,
      "delivery_fee": 0,
      "adjustment": -15.5,
      "grand_total": 84.5,
      "item_count": 1
    }
  }
}
```

**Respostas:**
- `201` — ingestão aceita (nova)
- `200` — idempotente (já existia)
- `400` — payload inválido (retornar erros Zod/campos)
- `401` — API key inválida

**Regras:**
- `event_id` deve ser único (deduplicação).
- Blob (`data` base64) **opcional** em endpoint separado `POST /api/v1/ingest/rosania/receipt/:event_id/file` ou upload para S3 com URL pré-assinada — **não colocar base64 na tabela fato analítica**.
- ETL deve ser **idempotente** (reprocessar o mesmo `event_id` não duplica linhas).

---

### Schema analítico sugerido — Rosania (PostgreSQL)

Prefixo: `rosania_` (views: `v_rosania_*`)

#### Tabelas de ingestão (staging / raw)

```sql
rosania_ingest_events (
  event_id        TEXT PRIMARY KEY,
  source_system   TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  event_at        TIMESTAMPTZ NOT NULL,
  payload_json    JSONB NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'pending'  -- pending|processed|failed
)
```

#### Tabelas analíticas (curated)

```sql
rosania_fact_receipts (
  receipt_id            TEXT PRIMARY KEY,  -- Invoice.id
  invoice_number        TEXT NOT NULL,
  issue_date            DATE NOT NULL,
  client_name           TEXT NOT NULL,
  service_type          TEXT,
  company_name          TEXT,
  show_emitter          BOOLEAN,
  emitter_document_type TEXT,
  emitter_legal_name    TEXT,
  emitter_document      TEXT,
  subtotal              NUMERIC(12,2),
  delivery_fee          NUMERIC(12,2),
  adjustment            NUMERIC(12,2),
  adjustment_kind       TEXT CHECK (adjustment_kind IN ('increase','discount')),
  grand_total           NUMERIC(12,2),
  item_count            INT,
  first_saved_at        TIMESTAMPTZ,
  last_saved_at         TIMESTAMPTZ,
  save_count            INT DEFAULT 0,
  updated_at            TIMESTAMPTZ
)

rosania_fact_receipt_lines (
  line_id       TEXT PRIMARY KEY,
  receipt_id    TEXT REFERENCES rosania_fact_receipts(receipt_id),
  line_order    INT,
  ref           TEXT,
  tipo          TEXT,
  descricao     TEXT,
  line_total    NUMERIC(12,2)
)

rosania_fact_exports (
  export_id       TEXT PRIMARY KEY,
  receipt_id      TEXT REFERENCES rosania_fact_receipts(receipt_id),
  format          TEXT CHECK (format IN ('jpeg','pdf')),
  file_url        TEXT,
  exported_at     TIMESTAMPTZ
)
```

#### Views para dashboard (criar na v1)

```sql
v_rosania_revenue_monthly       -- faturamento por mês (grand_total)
v_rosania_revenue_by_client     -- top clientes
v_rosania_revenue_by_tipo       -- por tipo de serviço/linha
v_rosania_revenue_by_descricao  -- por peça/descrição
v_rosania_adjustments_summary   -- acréscimos vs descontos
v_rosania_receipts_recent       -- últimos recibos salvos
```

---

### ETL — o que implementar na v1

1. **Migrations** — schema `rosania_*` acima.
2. **Validador de payload** — Zod/Pydantic espelhando o contrato JSON.
3. **API de ingestão** — `POST /api/v1/ingest/rosania/receipt`.
4. **Worker ETL** — consome `rosania_ingest_events`, normaliza para `fact_*`, marca `processed`.
5. **Script de backfill** — importar JSON exportado do `localStorage`:
   - `rj-notas-invoices` (rascunhos)
   - `rj-notas-saved-exports` (exports, sem obrigar blob no DW)
6. **Views analíticas** listadas acima.
7. **README** — como rodar local, variáveis de ambiente, exemplo de curl.

### Integração futura no `studio-rm` (não implementar aqui, só documentar)

No `handleSaveExport` de `studio-rm/src/app/page.tsx`, após salvar no `localStorage`, adicionar:

```typescript
await fetch(`${ANALYTICS_API_URL}/api/v1/ingest/rosania/receipt`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANALYTICS_API_KEY}`,
    'X-Idempotency-Key': saved.id,
  },
  body: JSON.stringify(buildAnalyticsPayload(currentInvoice, saved)),
});
```

- Falha na API **não deve impedir** o salvamento local (fire-and-forget com log/retry opcional).
- `buildAnalyticsPayload` monta o JSON do contrato acima a partir de `Invoice` + `SavedExport`.

---

### Stack sugerida (ajustável)

- **Banco:** PostgreSQL 16
- **API:** Python FastAPI ou Node Express (sua preferência)
- **Migrations:** Alembic ou Drizzle/Prisma
- **ETL:** scripts Python ou jobs SQL + função PL/pgSQL
- **Deploy:** Docker Compose local; produção flexível

---

### Fora de escopo na v1

- Frontend de dashboard
- Pipeline do padrasto (só deixar arquitetura pronta)
- OCR de JPEG/PDF (dados estruturados já vêm no payload)
- Autenticação de usuário final (só API key servidor-a-servidor)

---

### Entregáveis que espero de você (IA)

1. Estrutura de pastas do repo (`/api`, `/etl`, `/migrations`, `/schemas`, `/scripts/backfill`)
2. DDL completo + migrations
3. Endpoint de ingestão funcionando
4. ETL idempotente staging → curated
5. Script de backfill a partir de JSON exportado
6. Views analíticas
7. Exemplo de payload + testes
8. Instruções para conectar o botão Salvar do `studio-rm`

Comece pela **ingestão Rosania**. Pergunte apenas se houver ambiguidade crítica; caso contrário, implemente com defaults sensatos documentados.

---

## Anexo A — Chaves localStorage do `studio-rm`

| Chave | Conteúdo |
|-------|----------|
| `rj-notas-invoices` | `Invoice[]` rascunhos |
| `rj-notas-saved-exports` | `SavedExport[]` arquivos salvos |
| `rj-notas-save-format` | `'jpeg' \| 'pdf'` |
| `rj-notas-company-name` | string |
| `rj-notas-tipo-list` | string[] dropdown |
| `rj-notas-descricao-list` | string[] dropdown |

## Anexo B — Exemplo mínimo de backfill (invoices)

```json
[
  {
    "id": "a1b2-...",
    "invoiceNumber": "8ebe-...",
    "clientName": "SS",
    "service": "Modelagem",
    "issueDate": "2026-06-20",
    "companyName": "Sua Empresa",
    "showEmitter": true,
    "emitterDocumentType": "cpf",
    "deliveryFee": 0,
    "adjustment": 0,
    "pricePerMeter": 0,
    "items": [
      {
        "id": "item-1",
        "ref": "2",
        "type": "Acabamento",
        "description": "Vestido",
        "total": 100,
        "quantity": 1,
        "unitPrice": 0,
        "isRisk": false
      }
    ]
  }
]
```

## Anexo C — Diagrama de fluxo

```
[studio-rm Editor] → Invoice (estruturado)
        ↓ Salvar
[gera JPEG/PDF] → localStorage (Minhas Notas)
        ↓ POST (futuro)
[API Ingestão] → rosania_ingest_events
        ↓ ETL
[rosania_fact_receipts + lines + exports]
        ↓ views
[Dashboard futuro]
```

---

*Gerado a partir do projeto `studio-rm` — handoff para repositório de analytics financeiro.*