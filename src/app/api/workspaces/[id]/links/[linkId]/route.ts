import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { links } from "@/db/schema";
import { requireWorkspaceOwner } from "@/lib/workspace-access";
type Ctx = { params: Promise<{ id: string; linkId: string }> };
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, linkId } = await ctx.params;
  const g = await requireWorkspaceOwner(id);
  if (g.error) return g.error;
  if (!z.uuid().safeParse(linkId).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [row] = await db
    .delete(links)
    .where(and(eq(links.id, linkId), eq(links.workspaceId, id)))
    .returning({ id: links.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}