# Orbit

A spatial workspace for placement prep: infinite canvas, AI agents that act on it, and an MCP server so Claude can edit it.

> Status: in development. Demo GIF, live link and full docs coming in v1.0.0.

## Planned features
- Infinite canvas with zoom levels (topics, notes, code)
- 3 agents: Planner, Mock Interviewer, Resume
- MCP server (`list_cards`, `create_card`, `link_cards`, `search_workspace`)
- GitHub, LeetCode and Google Calendar integrations
- Real-time collaboration

## Setup
```bash
pnpm install
cp .env.example .env     # fill in the values
pnpm drizzle-kit push    # create tables
pnpm dev
```

## Docs
See [`docs/`](./docs): PLAN, ARCHITECTURE, DATABASE, API, AGENTS, MCP, TESTING, DEBUGGING.

## Why not Miro / Notion / Obsidian?
_(fill this in after the competitor research)_
