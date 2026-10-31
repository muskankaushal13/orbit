import { useSyncExternalStore } from "react";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
let status: SaveStatus = "idle";
let pending = 0;
let hadError = false;
const subs = new Set<() => void>();
function emit(s: SaveStatus) {
  status = s;
  subs.forEach((f) => f());
}
// Wraps a network call so the UI can show Saving / Saved / Save failed.
export async function tracked(
  run: () => Promise<Response>,
  opts?: { allow404?: boolean },
) {
  pending++;
  emit("saving");
  let ok = false;
  try {
    const r = await run();
    ok = r.ok || (!!opts?.allow404 && r.status === 404);
  } catch {
    ok = false;
  }
  pending--;
  if (!ok) hadError = true;
  if (pending === 0) {
    emit(hadError ? "error" : "saved");
    hadError = false;
  }
}
export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => status,
    () => "idle" as SaveStatus,
  );
}