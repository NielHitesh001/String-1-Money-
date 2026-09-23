# ADR-001: Isolate CorpGraph as a Python service

**Status:** Accepted  
**Date:** 2026-09-23

## Context

The repository already hosts the World Money React/Node application and has unrelated local
changes. The CorpGraph documents prescribe Python ingestion, Neo4j, FastAPI, and a later React
graph explorer. Replacing root dependencies would couple two products and risk regressions.

## Decision

Build CorpGraph under `corpgraph/` as an independently packaged Python service with its own
Compose file and tests. Its first vertical slice is SEC 10-K Exhibit 21 to validated JSON to
idempotent Neo4j upsert. The existing dashboard can consume a future FastAPI contract without
sharing runtime dependencies.

## Options considered

| Option | Complexity | Isolation | Reuse |
| --- | --- | --- | --- |
| Independent service directory | Low | High | API-level |
| Merge Python packages at repository root | Medium | Low | File-level |
| Rewrite ingestion in Node.js | Medium | Medium | Runtime-level |

The independent service keeps the specification's Python ecosystem and avoids modifying the
existing application's dependency and deployment boundaries.

## Consequences

- CorpGraph commands run from `corpgraph/`.
- CI has an additional isolated Python job.
- The parent Compose file is unchanged; local graph infrastructure uses the nested Compose file.
- A network API, rather than direct imports, will be the future integration boundary.

