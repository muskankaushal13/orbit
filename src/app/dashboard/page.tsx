import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
async function createWorkspace(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const title = String(formData.get("title") ?? "").trim().slice(0, 100) || "Untitled workspace";
  const [row] = await db
    .insert(workspaces)
    .values({ ownerId: session.user.id, title })
    .returning({ id: workspaces.id });
  redirect(`/w/${row.id}`);
}
async function Content() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id))
    .orderBy(desc(workspaces.updatedAt));
  return (
    <div className="mx-auto w-full max-w-xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <p>Logged in as {session.user.name ?? session.user.email}</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="underline">
            Sign out
          </button>
        </form>
      </header>
      <form action={createWorkspace} className="flex gap-2">
        <input
          name="title"
          placeholder="New workspace name"
          className="min-h-11 flex-1 rounded-lg border border-slate-500 bg-transparent px-3"
        />
        <button type="submit" className="min-h-11 rounded-lg border border-slate-500 px-4">
          Create
        </button>
      </form>
      <ul className="space-y-2">
        {rows.length === 0 && <li className="text-slate-400">No workspaces yet.</li>}
        {rows.map((w) => (
          <li key={w.id}>
            <Link
              href={`/w/${w.id}`}
              className="block rounded-lg border border-slate-600 p-4 hover:bg-slate-800/40"
            >
              {w.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
export default function DashboardPage() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<p className="p-8">Loading...</p>}>
        <Content />
      </Suspense>
    </main>
  );
}