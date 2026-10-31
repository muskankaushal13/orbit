# API
All routes need a login session. Not logged in = 401. Someone else's data = 404 (never 403, so existence is not leaked).
Every route checks that the workspace belongs to the logged-in user (`src/lib/workspace-access.ts`).
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/workspaces` | list / create workspaces |
| GET / PATCH / DELETE | `/api/workspaces/:id` | read / rename or change visibility / delete |
| GET / POST | `/api/workspaces/:id/cards` | list / create cards |
| PATCH / DELETE | `/api/workspaces/:id/cards/:cardId` | edit or move / delete a card |
| POST | `/api/workspaces/:id/links` | link two cards (both must be in this workspace; duplicates return the existing link) |
| DELETE | `/api/workspaces/:id/links/:linkId` | remove a link |
## Validation
zod on every body. Bad input = 400 with `details`.
## Tests
`workspaces.test.ts` and `cards.test.ts` prove cross-user isolation with two test users.