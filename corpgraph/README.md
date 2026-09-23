# CorpGraph

CorpGraph is a local corporate OSINT pipeline, read-only API, and React/Cytoscape explorer.
It collects source-attributed Wikidata corporate records, extracts SEC Exhibit 21 subsidiary
disclosures when an identifying SEC User-Agent is configured, resolves duplicate companies,
loads Neo4j, and serves cached graph queries through FastAPI and Redis. This is a development
MVP, not a completed production release; see [the completion audit](docs/STATUS.md).

The service lives in this directory intentionally: the parent repository contains the existing
World Money application, whose dependencies and runtime remain unchanged.

## Quick start

```bash
cd corpgraph
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
pytest
```

SEC asks automated clients to identify themselves. Set a real organization and email before
making requests:

```bash
export SEC_USER_AGENT='Your Organization your-email@example.com'
corpgraph-sec --cik 1318605 --output data/tesla.json
```

Resolve duplicate companies before loading:

```bash
corpgraph-resolve \
  --input data/tesla.json \
  --output data/tesla-resolved.json \
  --threshold 0.85
```

Start Neo4j and load the result:

```bash
export NEO4J_PASSWORD='choose-a-local-password'
docker compose up -d neo4j
corpgraph-load data/tesla-resolved.json
```

Collect the bounded default public graph from Wikidata and load it idempotently:

```bash
corpgraph-wikidata --depth 2 --max-entities 500 \
  --output data/wikidata-public.json
```

The collector uses the official Action API sequentially at two requests per second, preserves
the Wikidata item URL, CC0 license, collection time, and source on every record, and flags facts
for primary-source verification. Pass `--root Q312` repeatedly to choose roots. The optional
`--replace-wikidata` flag replaces only nodes whose `source` is `wikidata`; it does not remove
demo, benchmark, or SEC records. Override `WIKIMEDIA_USER_AGENT` with your application contact
when deploying under another owner.

Neo4j Browser is available at <http://localhost:7474>. The Bolt endpoint is
`bolt://localhost:7687`.

## REST API

Start Neo4j and Redis, then launch the API:

```bash
export NEO4J_PASSWORD='corpgraph-local'
docker compose up -d
uvicorn corpgraph.api.main:app --reload --host 127.0.0.1 --port 8000
```

OpenAPI documentation is available at <http://127.0.0.1:8000/docs>.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Neo4j readiness |
| `GET` | `/ready` | Neo4j and Redis readiness |
| `GET` | `/metrics` | Prometheus HTTP counters and duration summaries |
| `GET` | `/api/stats` | Graph node and relationship counts |
| `GET` | `/api/search?q=Tesla&limit=5` | Indexed company search |
| `GET` | `/api/company/{entity_id}` | Company details |
| `GET` | `/api/company/{entity_id}/relationships` | Bounded network traversal |

Company details are cached for one hour, search results for 15 minutes, and network responses
for 30 minutes. Network depth is limited to five and API queries use parameterized Cypher.
Network paths include intermediate nodes and directed edge endpoints. Counts represent unique
returned nodes/edges, not the size of the complete connected component. Results are bounded
by a path limit; high-degree graphs can still be expensive. There is no public raw-Cypher endpoint.

## Explorer

Create the deterministic fictional investigation dataset, then start the explorer (Node.js 22+):

```bash
corpgraph-seed-demo --replace-demo
```

This command replaces only records carrying `demo_seed=true`. It creates 510 companies, 60
officers, and 740 ownership, subsidiary, board, supplier, and co-patent relationships. It does
not represent real companies or filings and is safe to rerun.

```bash
cd corpgraph/frontend
npm ci
npm run dev -- --port 5174
```

Open <http://127.0.0.1:5174>. Search names, aliases, or registrations; select a result; filter by
depth, relationship, or risk; click nodes and links for intelligence details; and export the
returned network as JSON or PNG. The development server proxies API requests to port 8000.

`npm run build` creates a static bundle in `frontend/dist`. Deployment must provide a same-origin
reverse proxy for `/api`; the Vite development proxy is not part of the production bundle.

## Verification

```bash
# From corpgraph with its virtual environment active:
ruff check .
mypy --strict
pytest
# From corpgraph/frontend:
npm run format:check
npm test
npm run build
```

CI runs Python checks and frontend formatting, tests, and strict TypeScript builds. API and
frontend component line coverage are currently 100%; frontend branch coverage is tracked
separately. Browser validation is a manual local integration check, not a CI browser test.

## Local security and data handling

The compose configuration binds database ports to loopback. Existing running containers must
be recreated with `docker compose up -d` to apply that change. Do not expose this development
API directly to the internet. Set `NEO4J_PASSWORD` consistently before initializing Neo4j;
changing the variable does not reset an existing volume's database password. Do not delete
volumes to fix authentication.

Copy `.env.example` to an ignored local `.env` and provide secrets through the deployment
platform. Production mode refuses to start unless `CORPGRAPH_API_KEY` contains at least 32
characters. `/api/*` accepts that key through `X-API-Key` or `Authorization: Bearer`; `/health`
remains unauthenticated for orchestrator probes. Redis enforces an atomic fixed-window limit,
configured with `CORPGRAPH_RATE_LIMIT_PER_MINUTE` (default 120), and responses include remaining
budget headers. Allowed browser origins must be enumerated in `CORPGRAPH_CORS_ORIGINS`; wildcard
origins are rejected.

Never place `CORPGRAPH_API_KEY` in the React bundle. A production browser deployment needs a
same-origin reverse proxy or backend-for-frontend that injects the key server-side and terminates
TLS. `/metrics` deliberately uses normalized route templates, so company identifiers do not become
Prometheus labels; restrict this endpoint to an internal monitoring network at the reverse proxy.
Metrics are process-local, so multi-worker deployments must scrape each worker or use a compatible
collector. Backup/restore validation and deployment-specific secret rotation remain release gates.

## Local production deployment

Set strong `NEO4J_PASSWORD` and `CORPGRAPH_API_KEY` values in your shell or ignored `.env`, then:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --wait
```

Open <http://127.0.0.1:8080>. Caddy serves the compiled explorer, proxies API requests, and injects
the API key server-side. Set `CORPGRAPH_SITE_ADDRESS` to a real DNS name and publish ports 80/443
at the infrastructure layer to enable Caddy's automatic TLS. Keep Neo4j and Redis private.

Create a consistent backup (brief Neo4j downtime):

```bash
./scripts/backup.sh
```

Backups are timestamped, checksummed, ignored by Git, and stored under `backups/`. Restore is
intentionally destructive and requires an explicit confirmation flag:

```bash
./scripts/restore.sh backups/corpgraph-TIMESTAMP.tar.gz --confirm
```

Demo records use `demo_seed` provenance and are not SEC evidence. Cache entries
are disposable; invalidate the affected CorpGraph keys after graph ingestion before relying
on immediately refreshed results.

## Output contract

Each scrape produces one parent company, zero or more subsidiaries, and `HAS_SUBSIDIARY`
relationships. IDs are stable SHA-256-derived identifiers so rerunning the same source is
idempotent. Every entity and relationship retains source URL, accession number, filing date,
and collection timestamp for provenance.

## Current scope

- Wikidata companies, declared subsidiaries, CEOs, and chairpersons with source attribution;
  community-maintained data is not treated as verified evidence.
- SEC Exhibit 21 ingestion is implemented but requires an honest organization/contact User-Agent
  before live collection. OpenCorporates remains unavailable without a permitted credential.
- The fictional demo additionally exercises ownership, suppliers, co-patents, risk flags, and
  board interlocks.
- Entity normalization, fuzzy matching, deterministic clustering, and relationship-ID rewriting.
- Conservative Exhibit 21 parsing. The raw filing URL is retained for manual verification.
- No proxy rotation. SEC fair-access rate limits and an identifying User-Agent are mandatory.

See [`docs/ADR-001-corpgraph-service-boundary.md`](docs/ADR-001-corpgraph-service-boundary.md)
for the initial architecture decision.
