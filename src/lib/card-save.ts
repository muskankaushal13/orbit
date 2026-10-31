import { tracked } from "./save-status";
type Patch = Record<string, unknown>;
type Entry = { ws: string; id: string; patch: Patch; timer: ReturnType<typeof setTimeout> };
const pending = new Map<string, Entry>();
const headers = { "Content-Type": "application/json" };
function send(ws: string, id: string, patch: Patch, keepalive = false) {
  return tracked(() =>
    fetch(`/api/workspaces/${ws}/cards/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
      keepalive,
    }),
  );
}
// Debounced, per-card. Several edits inside the delay merge into ONE request.
export function saveCard(ws: string, id: string, patch: Patch, delay = 500) {
  const key = `${ws}/${id}`;
  const cur = pending.get(key);
  if (cur) clearTimeout(cur.timer);
  const merged = { ...(cur?.patch ?? {}), ...patch };
  const timer = setTimeout(() => {
    pending.delete(key);
    void send(ws, id, merged);
  }, delay);
  pending.set(key, { ws, id, patch: merged, timer });
}
// Used when a card is deleted so a late PATCH is not sent for it.
export function cancelSave(ws: string, id: string) {
  const key = `${ws}/${id}`;
  const cur = pending.get(key);
  if (cur) {
    clearTimeout(cur.timer);
    pending.delete(key);
  }
}
// Called when the tab closes: send everything still waiting.
export function flushAll() {
  for (const cur of pending.values()) {
    clearTimeout(cur.timer);
    void send(cur.ws, cur.id, cur.patch, true);
  }
  pending.clear();
}