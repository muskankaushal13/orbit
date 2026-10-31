import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { CARD_TYPES } from "@/lib/card-types";
import { requireWorkspaceOwner } from "@/lib/workspace-access";
const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(20000).optional(),
    type: z.enum(CARD_TYPES).optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
type Ctx = { params: Promise<{ id: string; cardId: string }> };
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
export async function PATCH(req: Request, ctx: Ctx) {
  const { id, cardId } = await ctx.params;
  const g = await requireWorkspaceOwner(id);
  if (g.error) return g.error;
  if (!z.uuid().safeParse(cardId).success) return notFound();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  const [row] = await db
    .update(cards)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), eq(cards.workspaceId, id)))
    .returning();
  if (!row) return notFound();
  return NextResponse.json(row);
}
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, cardId } = await ctx.params;
  const g = await requireWorkspaceOwner(id);
  if (g.error) return g.error;
  if (!z.uuid().safeParse(cardId).success) return notFound();
  const [row] = await db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.workspaceId, id)))
    .returning({ id: cards.id });
  if (!row) return notFound();
  return new NextResponse(null, { status: 204 });
}