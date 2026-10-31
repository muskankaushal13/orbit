import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { cards, links, workspaces } from "@/db/schema";
import Canvas from "@/components/canvas/Canvas";
async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!z.uuid().safeParse(id).success) notFound();
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.ownerId, session.user.id)));
  if (!ws) notFound();
  const cardRows = await db
    .select({
      id: cards.id,
      type: cards.type,
      title: cards.title,
      content: cards.content,
      x: cards.x,
      y: cards.y,
    })
    .from(cards)
    .where(eq(cards.workspaceId, id));
  const linkRows = await db
    .select({ id: links.id, fromCard: links.fromCard, toCard: links.toCard })
    .from(links)
    .where(eq(links.workspaceId, id));
  return (
    <div className="relative">
      <Link
        href="/dashboard"
        className="absolute right-4 top-4 z-10 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100"
      >
        &larr; {ws.title}
      </Link>
      <Canvas workspaceId={id} initialCards={cardRows} initialLinks={linkRows} />
    </div>
  );
}
export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-8">Loading canvas...</p>}>
      <Loader params={params} />
    </Suspense>
  );
}