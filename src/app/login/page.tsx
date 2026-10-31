import { signIn } from "@/auth";
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-black px-6 py-3 text-white dark:bg-white dark:text-black"
        >
          Continue with GitHub
        </button>
      </form>
    </main>
  );
}