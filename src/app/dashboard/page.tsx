import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
async function UserInfo() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="space-y-4">
      <p>Logged in as {session.user.name ?? session.user.email}</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="underline">Sign out</button>
      </form>
    </div>
  );
}
export default function DashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<p>Loading...</p>}>
        <UserInfo />
      </Suspense>
    </main>
  );
}