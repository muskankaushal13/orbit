import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cards, links } from "@/db/schema";
import { requireWorkspaceOwner } from "@/lib/workspace-access";
const createSchema = z
  .object({
    fromCard: z.uuid(),
    toCard: z.uuid(),
    label: z.string().max(100).optional(),
  })
  .refine((v) => v.fromCard !== v.toCard, { message: "Cannot link a card to itself" });
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await requireWorkspaceOwner(id);
  if (g.error) return g.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  const { fromCard, toCard, label } = parsed.data;
  // both cards must belong to THIS workspace
  const found = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.workspaceId, id), inArray(cards.id, [fromCard, toCard])));
  if (found.length !== 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [existing] = await db
    .select()
    .from(links)
    .where(and(eq(links.workspaceId, id), eq(links.fromCard, fromCard), eq(links.toCard, toCard)));
  if (existing) return NextResponse.json(existing);
  const [row] = await db
    .insert(links)
    .values({ workspaceId: id, fromCard, toCard, label })
    .returning();
  return NextResponse.json(row, { status: 201 });
}