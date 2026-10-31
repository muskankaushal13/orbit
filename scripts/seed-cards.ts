import "dotenv/config";
import { db } from "../src/db";
import { cards } from "../src/db/schema";
import { CARD_TYPES } from "../src/lib/card-types";
async function main() {
  const workspaceId = process.argv[2];
  const count = Number(process.argv[3] ?? 200);
  if (!workspaceId) {
    console.error("Usage: pnpm seed:cards <workspaceId> [count]");
    process.exit(1);
  }
  const rows = Array.from({ length: count }, (_, i) => ({
    workspaceId,
    type: CARD_TYPES[i % CARD_TYPES.length],
    title: `Card ${i + 1}`,
    content: `Seed card ${i + 1}`,
    x: (i % 20) * 320,
    y: Math.floor(i / 20) * 220,
  }));
  await db.insert(cards).values(rows);
  console.log(`Inserted ${rows.length} cards into ${workspaceId}`);
  process.exit(0);
}
main();