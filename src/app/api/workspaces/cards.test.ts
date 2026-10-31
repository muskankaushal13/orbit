import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { Mock } from "vitest";
import { inArray } from "drizzle-orm";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import * as wsRoute from "./route";
import * as cardsRoute from "./[id]/cards/route";
import * as cardRoute from "./[id]/cards/[cardId]/route";
import * as linksRoute from "./[id]/links/route";
const mockedAuth = auth as unknown as Mock;
const run = Date.now().toString(36);
const userA = `test-a-${run}`;
const userB = `test-b-${run}`;
let wsA = "", wsB = "", cardA1 = "", cardA2 = "", cardB = "";
function loginAs(id: string | null) {
  mockedAuth.mockResolvedValue(id ? { user: { id } } : null);
}
function req(method: string, body?: unknown) {
  return new Request("http://localhost/t", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const c1 = (id: string) => ({ params: Promise.resolve({ id }) });
const c2 = (id: string, cardId: string) => ({ params: Promise.resolve({ id, cardId }) });
async function mkWorkspace(title: string) {
  const res = await wsRoute.POST(req("POST", { title }));
  expect(res.status).toBe(201);
  return (await res.json()).id as string;
}
async function mkCard(ws: string, title: string) {
  const res = await cardsRoute.POST(req("POST", { title, x: 0, y: 0 }), c1(ws));
  expect(res.status).toBe(201);
  return (await res.json()).id as string;
}
beforeAll(async () => {
  await db.insert(users).values([
    { id: userA, name: "Test A", email: `${userA}@test.local` },
    { id: userB, name: "Test B", email: `${userB}@test.local` },
  ]);
  loginAs(userA);
  wsA = await mkWorkspace("A workspace");
  cardA1 = await mkCard(wsA, "A card one");
  cardA2 = await mkCard(wsA, "A card two");
  loginAs(userB);
  wsB = await mkWorkspace("B workspace");
  cardB = await mkCard(wsB, "B card");
});
afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});
describe("authentication required", () => {
  it("returns 401 when logged out", async () => {
    loginAs(null);
    expect((await cardsRoute.GET(req("GET"), c1(wsA))).status).toBe(401);
    expect(
      (await cardsRoute.POST(req("POST", { title: "x", x: 0, y: 0 }), c1(wsA))).status,
    ).toBe(401);
  });
});
describe("owner access", () => {
  it("owner lists their cards", async () => {
    loginAs(userA);
    const res = await cardsRoute.GET(req("GET"), c1(wsA));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(2);
  });
});
describe("cross-user isolation (user B attacking user A)", () => {
  it("B cannot list A's cards", async () => {
    loginAs(userB);
    expect((await cardsRoute.GET(req("GET"), c1(wsA))).status).toBe(404);
  });
  it("B cannot create a card in A's workspace", async () => {
    loginAs(userB);
    const res = await cardsRoute.POST(req("POST", { title: "evil", x: 0, y: 0 }), c1(wsA));
    expect(res.status).toBe(404);
  });
  it("B cannot edit A's card through A's workspace", async () => {
    loginAs(userB);
    const res = await cardRoute.PATCH(req("PATCH", { title: "hacked" }), c2(wsA, cardA1));
    expect(res.status).toBe(404);
  });
  it("B cannot delete A's card through A's workspace", async () => {
    loginAs(userB);
    expect((await cardRoute.DELETE(req("DELETE"), c2(wsA, cardA1))).status).toBe(404);
  });
  it("B cannot edit A's card through B's OWN workspace", async () => {
    loginAs(userB);
    const res = await cardRoute.PATCH(req("PATCH", { title: "hacked" }), c2(wsB, cardA1));
    expect(res.status).toBe(404);
  });
  it("B cannot delete A's card through B's OWN workspace", async () => {
    loginAs(userB);
    expect((await cardRoute.DELETE(req("DELETE"), c2(wsB, cardA1))).status).toBe(404);
  });
  it("B cannot link B's card to A's card (cross-workspace link)", async () => {
    loginAs(userB);
    const res = await linksRoute.POST(
      req("POST", { fromCard: cardB, toCard: cardA1 }),
      c1(wsB),
    );
    expect(res.status).toBe(404);
  });
  it("B cannot create a link inside A's workspace", async () => {
    loginAs(userB);
    const res = await linksRoute.POST(
      req("POST", { fromCard: cardA1, toCard: cardA2 }),
      c1(wsA),
    );
    expect(res.status).toBe(404);
  });
  it("A's cards are untouched", async () => {
    loginAs(userA);
    const rows = await (await cardsRoute.GET(req("GET"), c1(wsA))).json();
    const titles = rows.map((r: { title: string }) => r.title).sort();
    expect(titles).toEqual(["A card one", "A card two"]);
  });
});
describe("links and validation (owner)", () => {
  it("owner can link two cards, and a duplicate returns the same link", async () => {
    loginAs(userA);
    const first = await linksRoute.POST(
      req("POST", { fromCard: cardA1, toCard: cardA2 }),
      c1(wsA),
    );
    expect(first.status).toBe(201);
    const firstId = (await first.json()).id;
    const again = await linksRoute.POST(
      req("POST", { fromCard: cardA1, toCard: cardA2 }),
      c1(wsA),
    );
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe(firstId);
  });
  it("rejects a link from a card to itself (400)", async () => {
    loginAs(userA);
    const res = await linksRoute.POST(
      req("POST", { fromCard: cardA1, toCard: cardA1 }),
      c1(wsA),
    );
    expect(res.status).toBe(400);
  });
  it("rejects a card without coordinates (400)", async () => {
    loginAs(userA);
    expect((await cardsRoute.POST(req("POST", { title: "no coords" }), c1(wsA))).status).toBe(400);
  });
  it("rejects an empty card update (400)", async () => {
    loginAs(userA);
    expect((await cardRoute.PATCH(req("PATCH", {}), c2(wsA, cardA1))).status).toBe(400);
  });
  it("owner can move, edit and delete a card", async () => {
    loginAs(userA);
    const patched = await cardRoute.PATCH(
      req("PATCH", { title: "Edited", x: 50, y: 60 }),
      c2(wsA, cardA2),
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).title).toBe("Edited");
    expect((await cardRoute.DELETE(req("DELETE"), c2(wsA, cardA2))).status).toBe(204);
  });
});