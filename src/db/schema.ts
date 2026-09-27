import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  date,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------- Enums ----------

export const userRole = pgEnum("user_role", ["volunteer", "coordinator", "admin"]);
export const userStatus = pgEnum("user_status", ["invited", "active", "inactive"]);
export const liturgyStatus = pgEnum("liturgy_status", ["draft", "published", "cancelled"]);
export const assignmentStatus = pgEnum("assignment_status", [
  "signed_up", // volunteer claimed the slot
  "confirmed", // replied YES to a reminder or confirmed in app
  "sub_requested", // volunteer can't make it, slot shows as needing a sub
  "declined", // dropped; kept for history
]);
export const otpPurpose = pgEnum("otp_purpose", ["login", "mfa", "verify_phone", "verify_email"]);
export const notificationChannel = pgEnum("notification_channel", ["sms", "email"]);

// ---------- People ----------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"), // E.164, e.g. +19085551234
    username: text("username"), // optional; email works as username too
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("volunteer"),
    status: userStatus("status").notNull().default("invited"),
    mfaRequired: boolean("mfa_required").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    emailVerified: boolean("email_verified").notNull().default(false),
    notifySms: boolean("notify_sms").notNull().default(true),
    notifyEmail: boolean("notify_email").notNull().default(true),
    entraOid: text("entra_oid"), // Microsoft Entra object id, staff only
    initials: text("initials"), // as printed on the presider schedule, e.g. TPN
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_phone_idx").on(t.phone),
    uniqueIndex("users_username_idx").on(t.username),
    uniqueIndex("users_entra_oid_idx").on(t.entraOid),
    uniqueIndex("users_initials_idx").on(t.initials),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(), // phone or email the code went to
    channel: notificationChannel("channel").notNull(),
    purpose: otpPurpose("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_destination_idx").on(t.destination)],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invites_token_idx").on(t.tokenHash)],
);

// ---------- Ministries ----------

export const ministries = pgTable(
  "ministries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // "Extraordinary Ministers of Holy Communion"
    shortName: text("short_name").notNull(), // "EM"
    slug: text("slug").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#1F346D"),
    sortOrder: integer("sort_order").notNull().default(100),
    active: boolean("active").notNull().default(true),
    // If false, members of this ministry don't appear on the kiosk (e.g. Presider)
    checkInEnabled: boolean("check_in_enabled").notNull().default(true),
    // Optional sub-roles, e.g. Music: Vocals, Guitar, Bass. Seats are counted per role and labeled with it.
    roles: text("roles").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ministries_slug_idx").on(t.slug)],
);

export const ministryMembers = pgTable(
  "ministry_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ministryId: uuid("ministry_id")
      .notNull()
      .references(() => ministries.id, { onDelete: "cascade" }),
    isCoordinator: boolean("is_coordinator").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.ministryId] })],
);

// ---------- Mass schedule ----------

// The recurring weekend template: "Saturday 5:00 PM", "Sunday 10:30 AM", etc.
export const massTimes = pgTable("mass_times", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(), // "Sunday 10:30 AM"
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday ... 6 = Saturday
  time: text("time").notNull(), // "10:30" 24h local (America/New_York)
  location: text("location").notNull().default("Church"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
});

// How many of each ministry a given Mass time normally needs.
export const positionTemplates = pgTable(
  "position_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    massTimeId: uuid("mass_time_id")
      .notNull()
      .references(() => massTimes.id, { onDelete: "cascade" }),
    ministryId: uuid("ministry_id")
      .notNull()
      .references(() => ministries.id, { onDelete: "cascade" }),
    role: text("role").notNull().default(""), // one of the ministry's roles, or "" when it has none
    count: integer("count").notNull().default(1),
  },
  (t) => [uniqueIndex("position_templates_unique").on(t.massTimeId, t.ministryId, t.role)],
);

// A specific Mass on a specific date.
export const liturgies = pgTable(
  "liturgies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    massTimeId: uuid("mass_time_id").references(() => massTimes.id, { onDelete: "set null" }),
    date: date("date").notNull(), // YYYY-MM-DD local
    time: text("time").notNull(), // "10:30"
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(), // computed from date+time in America/New_York
    label: text("label").notNull(), // "Sunday 10:30 AM"
    title: text("title"), // optional: "27th Sunday in Ordinary Time", "Christmas Eve"
    location: text("location").notNull().default("Church"),
    notes: text("notes"),
    status: liturgyStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("liturgies_starts_idx").on(t.startsAt), index("liturgies_date_idx").on(t.date)],
);

// One seat to fill. Four EMs at 10:30 = four rows.
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    liturgyId: uuid("liturgy_id")
      .notNull()
      .references(() => liturgies.id, { onDelete: "cascade" }),
    ministryId: uuid("ministry_id")
      .notNull()
      .references(() => ministries.id, { onDelete: "cascade" }),
    label: text("label"), // optional: "Cup 1", "Cross bearer", "Cantor"
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("positions_liturgy_idx").on(t.liturgyId)],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: assignmentStatus("status").notNull().default("signed_up"),
    assignedById: uuid("assigned_by_id").references(() => users.id, { onDelete: "set null" }), // null = self sign-up
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInVia: text("checked_in_via"), // "kiosk:<kioskId>" | "admin:<userId>"
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Only one live assignment per position
    uniqueIndex("assignments_position_live_idx")
      .on(t.positionId)
      .where(sql`status <> 'declined'`),
    index("assignments_user_idx").on(t.userId),
  ],
);

// ---------- Kiosks ----------

export const kiosks = pgTable("kiosks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // "Sacristy touchscreen"
  keyHash: text("key_hash").notNull(),
  active: boolean("active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Presider schedule imports ----------

export type PresiderImportRow = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  initials: string;
  sundayName: string | null;
};
export type PresiderImportPayload = {
  legend: Record<string, string>; // initials -> name as printed, e.g. NS -> "Fr. Nick Sertich"
  rows: PresiderImportRow[]; // weekend Masses that match the weekly pattern
  skipped: { date: string; time: string; initials: string; reason: string }[];
};

// One uploaded presider schedule PDF, parsed and waiting for review (or already applied).
export const presiderImports = pgTable("presider_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  payload: jsonb("payload").$type<PresiderImportPayload>().notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Logs ----------

export const notificationLog = pgTable("notification_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  channel: notificationChannel("channel").notNull(),
  destination: text("destination").notNull(),
  kind: text("kind").notNull(), // "reminder" | "open_slots" | "otp" | "invite" | ...
  body: text("body").notNull(),
  providerId: text("provider_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Relations ----------

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(ministryMembers),
  assignments: many(assignments),
}));

export const ministriesRelations = relations(ministries, ({ many }) => ({
  members: many(ministryMembers),
  positions: many(positions),
  templates: many(positionTemplates),
}));

export const ministryMembersRelations = relations(ministryMembers, ({ one }) => ({
  user: one(users, { fields: [ministryMembers.userId], references: [users.id] }),
  ministry: one(ministries, { fields: [ministryMembers.ministryId], references: [ministries.id] }),
}));

export const massTimesRelations = relations(massTimes, ({ many }) => ({
  templates: many(positionTemplates),
  liturgies: many(liturgies),
}));

export const positionTemplatesRelations = relations(positionTemplates, ({ one }) => ({
  massTime: one(massTimes, { fields: [positionTemplates.massTimeId], references: [massTimes.id] }),
  ministry: one(ministries, { fields: [positionTemplates.ministryId], references: [ministries.id] }),
}));

export const liturgiesRelations = relations(liturgies, ({ one, many }) => ({
  massTime: one(massTimes, { fields: [liturgies.massTimeId], references: [massTimes.id] }),
  positions: many(positions),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  liturgy: one(liturgies, { fields: [positions.liturgyId], references: [liturgies.id] }),
  ministry: one(ministries, { fields: [positions.ministryId], references: [ministries.id] }),
  assignments: many(assignments),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  position: one(positions, { fields: [assignments.positionId], references: [positions.id] }),
  user: one(users, { fields: [assignments.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Ministry = typeof ministries.$inferSelect;
export type Liturgy = typeof liturgies.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type MassTime = typeof massTimes.$inferSelect;
