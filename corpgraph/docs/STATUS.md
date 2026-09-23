# Completion audit — 2026-09-23

The attached Phase 2/3 instructions define acceptance criteria, not proof that those criteria
have passed. The earlier 115-test handoff was superseded by the checks below. The broader
project is **not finished**. This audit distinguishes implemented code from source-data and
production acceptance.

| Plan component | State | Evidence or remaining gate |
| --- | --- | --- |
| SEC extraction and Neo4j ingestion | Implemented; live-data validation pending | Fixture parser tests pass; no verified 500-company SEC corpus established |
| Wikidata public source | Implemented and live-tested | 419 companies, 92 officers, 529 unique attributed relationships; CC0/source URL/timestamp retained |
| OpenCorporates | Remaining | Permitted credential not available; no unauthenticated workaround used |
| 2.1 normalizer, 2.2 matcher | Implemented and unit tested | 100% module line coverage |
| 2.3 resolver | Implemented; acceptance partial | 96% module coverage; representative 10K benchmark and independently labeled 95% accuracy evaluation remain |
| 3.1 SafeQueryBuilder | Implemented and unit tested | Parameters for values; integer-only traversal bounds; allowlisted relationship types |
| 3.2 async Neo4j client | Implemented and locally tested | 100% module coverage; local Docker connection works |
| 3.3 FastAPI endpoints | Implemented and locally tested | Company, search, network, health, stats; topology and temporal serialization tests; 100% module coverage |
| 3.4 Redis caching | Implemented and locally tested | 100% module coverage; versioned network cache contract |
| Phase 2/3 end-to-end acceptance | Partial | Synthetic graph only; verified corpus, ground-truth resolution accuracy and representative cold search benchmarks remain |
| Phase 4 explorer | Partial | Name/alias/registration search, directed typed graph, rich node/link profiles, risk/depth/type filters, KPI aggregation, JSON/PNG export, and responsive browser acceptance implemented; date filtering, case persistence, and verified-data provenance workflows remain |
| Production security | Implemented; deployment validation pending | Optional local/API-key production mode, Redis atomic rate limit, explicit CORS, ignored environment template |
| Monitoring/readiness | Implemented and live-tested | Prometheus counters/duration summaries with normalized labels; Neo4j+Redis readiness probe |
| Local production stack | Implemented and live-tested | Non-root API image, compiled frontend, Caddy proxy/key injection, TLS-ready site address; loopback deployment healthy on port 8080 |
| Backup/restore | Implemented; backup verified | Consistent stopped-volume archive and SHA-256 verified; guarded destructive restore intentionally not run against the working database |
| Production release | Local target prepared | External DNS/public hosting and secret rotation remain environment-specific |

## Verified in this delivery

- Python: 201 passing tests; 96.59% total line coverage. Monitoring, readiness, security, Redis rate limiting,
  Wikidata collector/loader, enriched API,
  query builder, models, and demo seeder are 100%; entity resolution is 96–100% by module.
- Python: `ruff check .` and strict mypy pass.
- Frontend: seven passing component tests; 100% lines/functions, 97.91% statements, and 87.32% branches. Browser bootstrap is excluded from component coverage.
- Strict TypeScript and Vite production build pass. Dependencies: zero reported npm audit vulnerabilities at validation time.
- Enriched fictional seed: 510 companies, 60 people, and 740 multi-type relationships. Cold local search returned 12 matches in 38.42 ms; an uncached depth-1 network returned 12 nodes/11 links in 68.01 ms. These are single local observations, not load-test percentiles.
- Live bounded Wikidata collection: 419 companies, 92 public officers, 424 unique
  declared-subsidiary records, and 105 unique officer-role records. After the final scoped reload,
  With security middleware active, an uncached Apple search returned in 13.1 ms and its 27-node,
  26-link depth-1 network returned in 23.7 ms. These are single local observations, not load-test
  percentiles.
- Desktop and 390px mobile browser checks passed with a 42-node/46-link depth-2 investigation, rich entity profile, six KPIs, and no console errors. Cytoscape is mocked in unit tests; real rendering was checked separately.
- Earlier synthetic fixture contained incorrect `sec_edgar` provenance. Corrected precisely 501 known benchmark company IDs and 500 known benchmark relationship IDs in one transaction. Six disposable CorpGraph cache entries invalidated. No genuine source records removed.

## Next acceptance work

1. Supply an organization/contact email for `SEC_USER_AGENT`; do not invent an identity. Obtain a permitted OpenCorporates credential locally if that source is required; do not put secrets in chat or Git.
2. Validate the SEC scraper against real filings and independently verify selected Wikidata facts
   against primary corporate or regulatory sources. A public community record is not filing-grade evidence.
3. Add an independently reviewed resolution dataset and representative 10K mixed/duplicate-name benchmark; measure cold and warm search/network latency on the verified corpus.
4. Complete remaining Phase 4 controls and mobile/accessibility checks.
5. Choose a deployment environment, add TLS termination plus monitoring/backups, and run a
   production security/release gate before exposing the service.

Known risks: Python 3.14 local runs emit dependency deprecation warnings (CI uses Python 3.11);
full-text search still accepts Lucene query syntax; deeper path expansion can grow rapidly;
health checks currently cover Neo4j rather than full Redis readiness. The SafeQueryBuilder
validator is defense-in-depth for generated templates, not a sandbox for arbitrary Cypher.

Per the user's escalation protocol, stop for unresolved test failures after one fix attempt,
Neo4j/Redis integration errors, or any benchmark query exceeding 1000 ms. Do not substitute
fixture results for blocked live-data acceptance.
