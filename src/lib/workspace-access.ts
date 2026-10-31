import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
const notFound = () => ({
  error: NextResponse.json({ error: "Not found" }, { status: 404 }),
});
// Every card/link route calls this first. Non-owners get 404, never 403.
export async function requireWorkspaceOwner(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!z.uuid().safeParse(workspaceId).success) return notFound();
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, session.user.id)));
  if (!row) return notFound();
  return { userId: session.user.id };
}