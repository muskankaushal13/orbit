# Architecture

```
Browser (Next.js + canvas UI)
   | REST / WebSocket
Next.js route handlers -- Auth.js
   |        |         |
Postgres   Redis    Agent service -- Claude API
(Drizzle)  (cache,    |
           pub/sub)   +-- MCP server (same DB)
```

## Decisions (add the "why" as you decide)
| Decision | Choice | Why |
|---|---|---|
| Canvas | React Flow | _fill in_ |
| ORM | Drizzle | _fill in_ |
| DB | Postgres (Neon) | _fill in_ |
