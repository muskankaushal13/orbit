import {
  pgTable, pgEnum, text, timestamp, integer, real, jsonb, boolean,
  uuid, primaryKey, index,
} from "drizzle-orm/pg-core";

/* ---------- Auth.js tables (required by @auth/drizzle-adapter) ---------- */
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

/* ---------- Orbit tables ---------- */
export const visibility = pgEnum("visibility", ["private", "shared", "public"]);
export const memberRole = pgEnum("member_role", ["viewer", "editor"]);
export const cardType = pgEnum("card_type", ["topic", "note", "code", "project", "company"]);
export const agentName = pgEnum("agent_name", ["planner", "interviewer", "resume"]);
export const runStatus = pgEnum("run_status", ["running", "done", "failed"]);

export const workspaces = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  visibility: visibility("visibility").notNull().default("private"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("workspace_owner_idx").on(t.ownerId)]);

export const workspaceMembers = pgTable("workspace_member", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull().default("viewer"),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]);

export const cards = pgTable("card", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  type: cardType("type").notNull().default("note"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  x: real("x").notNull().default(0),
  y: real("y").notNull().default(0),
  z: real("z").notNull().default(0),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("card_workspace_idx").on(t.workspaceId)]);

export const links = pgTable("link", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  fromCard: uuid("from_card").notNull().references(() => cards.id, { onDelete: "cascade" }),
  toCard: uuid("to_card").notNull().references(() => cards.id, { onDelete: "cascade" }),
  label: text("label"),
}, (t) => [index("link_workspace_idx").on(t.workspaceId)]);

export const agentRuns = pgTable("agent_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agent: agentName("agent").notNull(),
  input: text("input").notNull(),
  output: text("output"),
  status: runStatus("status").notNull().default("running"),
  tokens: integer("tokens").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const integrations = pgTable("integration", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // github | leetcode | google_calendar
  encryptedToken: text("encrypted_token").notNull(), // AES-256-GCM, never plain text
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reminders = pgTable("reminder", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at").notNull(),
  done: boolean("done").notNull().default(false),
});

// API keys used by the MCP server (store only a hash, show the key once)
export const apiKeys = pgTable("api_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
