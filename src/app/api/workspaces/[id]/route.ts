import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
const idSchema = z.uuid();
const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    visibility: z.enum(["private", "shared", "public"]).optional(),
  })
  .refine((v) => v.title !== undefined || v.visibility !== undefined, {
    message: "Nothing to update",
  });
type Ctx = { params: Promise<{ id: string }> };
async function guard(ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { userId: session.user.id, id };
}
export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (g.error) return g.error;
  const [row] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, g.id), eq(workspaces.ownerId, g.userId)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (g.error) return g.error;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  const [row] = await db
    .update(workspaces)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(workspaces.id, g.id), eq(workspaces.ownerId, g.userId)))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}
export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if (g.error) return g.error;
  const [row] = await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, g.id), eq(workspaces.ownerId, g.userId)))
    .returning({ id: workspaces.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}