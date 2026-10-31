import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { CARD_TYPES } from "@/lib/card-types";
import { requireWorkspaceOwner } from "@/lib/workspace-access";
const createSchema = z.object({
  type: z.enum(CARD_TYPES).default("note"),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20000).default(""),
  x: z.number().finite(),
  y: z.number().finite(),
});
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await requireWorkspaceOwner(id);
  if (g.error) return g.error;
  const rows = await db.select().from(cards).where(eq(cards.workspaceId, id));
  return NextResponse.json(rows);
}
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
  const [row] = await db
    .insert(cards)
    .values({ workspaceId: id, ...parsed.data })
    .returning();
  return NextResponse.json(row, { status: 201 });
}