import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { Mock } from "vitest";
import { eq, inArray } from "drizzle-orm";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";
import { db } from "@/db";
import { users, workspaces } from "@/db/schema";
import * as collection from "./route";
import * as item from "./[id]/route";
const mockedAuth = auth as unknown as Mock;
const run = Date.now().toString(36);
const userA = `test-a-${run}`;
const userB = `test-b-${run}`;
let workspaceId = "";
function loginAs(id: string | null) {
  mockedAuth.mockResolvedValue(id ? { user: { id } } : null);
}
function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/workspaces", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function findInDb(id: string) {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  return row;
}
beforeAll(async () => {
  await db.insert(users).values([
    { id: userA, name: "Test A", email: `${userA}@test.local` },
    { id: userB, name: "Test B", email: `${userB}@test.local` },
  ]);
  loginAs(userA);
  const res = await collection.POST(req("POST", { title: "A private workspace" }));
  expect(res.status).toBe(201);
  workspaceId = (await res.json()).id;
});
afterAll(async () => {
  // cascade delete removes any workspaces left behind
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});
describe("authentication required", () => {
  it("GET /api/workspaces returns 401 when logged out", async () => {
    loginAs(null);
    expect((await collection.GET()).status).toBe(401);
  });
  it("POST /api/workspaces returns 401 when logged out", async () => {
    loginAs(null);
    expect((await collection.POST(req("POST", { title: "x" }))).status).toBe(401);
  });
  it("GET /api/workspaces/:id returns 401 when logged out", async () => {
    loginAs(null);
    expect((await item.GET(req("GET"), ctx(workspaceId))).status).toBe(401);
  });
});
describe("owner access", () => {
  it("owner sees the workspace in their list", async () => {
    loginAs(userA);
    const rows = await (await collection.GET()).json();
    expect(rows.map((r: { id: string }) => r.id)).toContain(workspaceId);
  });
  it("owner can read the workspace", async () => {
    loginAs(userA);
    const res = await item.GET(req("GET"), ctx(workspaceId));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(workspaceId);
  });
});
describe("cross-user isolation (user B vs user A's workspace)", () => {
  let originalTitle = "";
  beforeAll(async () => {
    originalTitle = (await findInDb(workspaceId)).title;
  });
  it("B does not see A's workspace in the list", async () => {
    loginAs(userB);
    const rows = await (await collection.GET()).json();
    expect(rows.map((r: { id: string }) => r.id)).not.toContain(workspaceId);
  });
  it("B cannot read A's workspace (404)", async () => {
    loginAs(userB);
    expect((await item.GET(req("GET"), ctx(workspaceId))).status).toBe(404);
  });
  it("B cannot rename A's workspace (404)", async () => {
    loginAs(userB);
    const res = await item.PATCH(req("PATCH", { title: "hacked" }), ctx(workspaceId));
    expect(res.status).toBe(404);
  });
  it("B cannot delete A's workspace (404)", async () => {
    loginAs(userB);
    expect((await item.DELETE(req("DELETE"), ctx(workspaceId))).status).toBe(404);
  });
  it("A's workspace is untouched in the database", async () => {
    const row = await findInDb(workspaceId);
    expect(row).toBeDefined();
    expect(row.title).toBe(originalTitle);
  });
});
describe("validation", () => {
  it("rejects an empty title with 400", async () => {
    loginAs(userA);
    expect((await collection.POST(req("POST", { title: "" }))).status).toBe(400);
  });
  it("returns 404 for a malformed id", async () => {
    loginAs(userA);
    expect((await item.GET(req("GET"), ctx("not-a-uuid"))).status).toBe(404);
  });
  it("rejects an update with nothing to change (400)", async () => {
    loginAs(userA);
    expect((await item.PATCH(req("PATCH", {}), ctx(workspaceId))).status).toBe(400);
  });
});
describe("owner can change and delete (runs last)", () => {
  it("owner can rename", async () => {
    loginAs(userA);
    const res = await item.PATCH(req("PATCH", { title: "Renamed by owner" }), ctx(workspaceId));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Renamed by owner");
  });
  it("owner can delete (204) and it is gone", async () => {
    loginAs(userA);
    expect((await item.DELETE(req("DELETE"), ctx(workspaceId))).status).toBe(204);
    expect(await findInDb(workspaceId)).toBeUndefined();
  });
});