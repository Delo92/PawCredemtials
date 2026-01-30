import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// WHITE-LABEL CONFIGURATION
// ============================================================================

export const siteConfig = pgTable("site_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteName: text("site_name").notNull().default("Application Portal"),
  tagline: text("tagline").default("Your trusted application processing platform"),
  description: text("description"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#3b82f6"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  level1Name: text("level_1_name").notNull().default("Applicant"),
  level2Name: text("level_2_name").notNull().default("Reviewer"),
  level3Name: text("level_3_name").notNull().default("Agent"),
  level4Name: text("level_4_name").notNull().default("Admin"),
  level5Name: text("level_5_name").notNull().default("Owner"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSiteConfigSchema = createInsertSchema(siteConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiteConfig = z.infer<typeof insertSiteConfigSchema>;
export type SiteConfig = typeof siteConfig.$inferSelect;

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firebaseUid: text("firebase_uid").unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  userLevel: integer("user_level").notNull().default(1),
  profileId: text("profile_id").unique(),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  referralCode: text("referral_code").unique(),
  referredByUserId: varchar("referred_by_user_id"),
  lastEditedBy: varchar("last_edited_by"),
  lastEditedAt: timestamp("last_edited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  referredBy: one(users, {
    fields: [users.referredByUserId],
    references: [users.id],
    relationName: "referrals",
  }),
  referrals: many(users, { relationName: "referrals" }),
  applications: many(applications),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  documents: many(documents),
  queueEntriesAsApplicant: many(queueEntries, { relationName: "applicant" }),
  queueEntriesAsReviewer: many(queueEntries, { relationName: "reviewer" }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================================
// SERVICE PACKAGES
// ============================================================================

export const packages = pgTable("packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  state: text("state"),
  requiredDocuments: jsonb("required_documents").$type<string[]>().default([]),
  formFields: jsonb("form_fields").$type<{ name: string; type: string; required: boolean; options?: string[] }[]>().default([]),
  workflowSteps: jsonb("workflow_steps").$type<string[]>().default([
    "Registration",
    "Payment",
    "Document Upload",
    "Review",
    "Approval",
    "Completed"
  ]),
  requiresLevel2Interaction: boolean("requires_level2_interaction").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const packagesRelations = relations(packages, ({ many }) => ({
  applications: many(applications),
}));

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packages.$inferSelect;

// ============================================================================
// APPLICATIONS
// ============================================================================

export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  packageId: varchar("package_id").notNull().references(() => packages.id),
  currentStep: integer("current_step").notNull().default(1),
  totalSteps: integer("total_steps").notNull().default(6),
  status: text("status").notNull().default("pending"), // pending, level2_review, level2_approved, level2_denied, level3_work, level3_complete, level4_verification, completed, rejected
  currentLevel: integer("current_level").default(1), // Which level is currently handling: 1, 2, 3, 4, 5
  formData: jsonb("form_data").$type<Record<string, any>>().default({}),
  paymentStatus: text("payment_status").default("unpaid"),
  paymentId: text("payment_id"),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  assignedReviewerId: varchar("assigned_reviewer_id").references(() => users.id),
  assignedAgentId: varchar("assigned_agent_id").references(() => users.id),
  level2Notes: text("level2_notes"),
  level2ApprovedAt: timestamp("level2_approved_at"),
  level2ApprovedBy: varchar("level2_approved_by").references(() => users.id),
  level3Notes: text("level3_notes"),
  level3CompletedAt: timestamp("level3_completed_at"),
  level3CompletedBy: varchar("level3_completed_by").references(() => users.id),
  level4Notes: text("level4_notes"),
  level4VerifiedAt: timestamp("level4_verified_at"),
  level4VerifiedBy: varchar("level4_verified_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, {
    fields: [applications.userId],
    references: [users.id],
  }),
  package: one(packages, {
    fields: [applications.packageId],
    references: [packages.id],
  }),
  assignedReviewer: one(users, {
    fields: [applications.assignedReviewerId],
    references: [users.id],
  }),
  assignedAgent: one(users, {
    fields: [applications.assignedAgentId],
    references: [users.id],
  }),
  documents: many(documents),
  steps: many(applicationSteps),
}));

export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;

// ============================================================================
// APPLICATION STEPS
// ============================================================================

export const applicationSteps = pgTable("application_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id),
  stepNumber: integer("step_number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  stepData: jsonb("step_data").$type<Record<string, any>>().default({}),
  completedAt: timestamp("completed_at"),
  manuallyUnlocked: boolean("manually_unlocked").default(false),
  unlockedBy: varchar("unlocked_by").references(() => users.id),
  unlockReason: text("unlock_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const applicationStepsRelations = relations(applicationSteps, ({ one }) => ({
  application: one(applications, {
    fields: [applicationSteps.applicationId],
    references: [applications.id],
  }),
  unlockedByUser: one(users, {
    fields: [applicationSteps.unlockedBy],
    references: [users.id],
  }),
}));

export const insertApplicationStepSchema = createInsertSchema(applicationSteps).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApplicationStep = z.infer<typeof insertApplicationStepSchema>;
export type ApplicationStep = typeof applicationSteps.$inferSelect;

// ============================================================================
// DOCUMENTS
// ============================================================================

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => applications.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  category: text("category"),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  status: text("status").notNull().default("pending"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  application: one(applications, {
    fields: [documents.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ============================================================================
// MESSAGES
// ============================================================================

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  applicationId: varchar("application_id").references(() => applications.id),
  subject: text("subject"),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
  application: one(applications, {
    fields: [messages.applicationId],
    references: [applications.id],
  }),
}));

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ============================================================================
// QUEUE ENTRIES
// ============================================================================

export const queueEntries = pgTable("queue_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => applications.id),
  packageId: varchar("package_id").references(() => packages.id),
  applicantId: varchar("applicant_id").notNull().references(() => users.id),
  reviewerId: varchar("reviewer_id").references(() => users.id),
  queueType: text("queue_type").notNull().default("consultation"), // consultation, review, support
  status: text("status").notNull().default("waiting"), // waiting, claimed, in_call, completed, cancelled
  priority: integer("priority").default(0),
  position: integer("position"), // Position in queue
  roomId: text("room_id"), // Video room ID (Twilio/GHL)
  roomToken: text("room_token"), // Access token for video room
  applicantPhone: text("applicant_phone"),
  applicantFirstName: text("applicant_first_name"),
  applicantLastName: text("applicant_last_name"),
  applicantState: text("applicant_state"),
  packageName: text("package_name"),
  packagePrice: decimal("package_price", { precision: 10, scale: 2 }),
  claimedAt: timestamp("claimed_at"),
  callStartedAt: timestamp("call_started_at"),
  callEndedAt: timestamp("call_ended_at"),
  timerExpiresAt: timestamp("timer_expires_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  outcome: text("outcome"), // approved, denied, follow_up, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const queueEntriesRelations = relations(queueEntries, ({ one }) => ({
  application: one(applications, {
    fields: [queueEntries.applicationId],
    references: [applications.id],
  }),
  applicant: one(users, {
    fields: [queueEntries.applicantId],
    references: [users.id],
    relationName: "applicant",
  }),
  reviewer: one(users, {
    fields: [queueEntries.reviewerId],
    references: [users.id],
    relationName: "reviewer",
  }),
}));

export const insertQueueEntrySchema = createInsertSchema(queueEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQueueEntry = z.infer<typeof insertQueueEntrySchema>;
export type QueueEntry = typeof queueEntries.$inferSelect;

// ============================================================================
// PAYMENTS
// ============================================================================

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => applications.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  packageId: varchar("package_id").references(() => packages.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  transactionId: text("transaction_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  receiptUrl: text("receipt_url"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  application: one(applications, {
    fields: [payments.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  package: one(packages, {
    fields: [payments.packageId],
    references: [packages.id],
  }),
}));

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ============================================================================
// COMMISSIONS
// ============================================================================

export const commissions = pgTable("commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => users.id),
  applicationId: varchar("application_id").references(() => applications.id),
  referredUserId: varchar("referred_user_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const commissionsRelations = relations(commissions, ({ one }) => ({
  agent: one(users, {
    fields: [commissions.agentId],
    references: [users.id],
  }),
  application: one(applications, {
    fields: [commissions.applicationId],
    references: [applications.id],
  }),
  referredUser: one(users, {
    fields: [commissions.referredUserId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [commissions.approvedBy],
    references: [users.id],
  }),
}));

export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  actionUrl: text("action_url"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  details: jsonb("details").$type<Record<string, any>>().default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// ============================================================================
// USER NOTES (for Level 3/4/5 to leave notes on user profiles)
// ============================================================================

export const userNotes = pgTable("user_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userNotesRelations = relations(userNotes, ({ one }) => ({
  user: one(users, {
    fields: [userNotes.userId],
    references: [users.id],
    relationName: "notesAbout",
  }),
  author: one(users, {
    fields: [userNotes.authorId],
    references: [users.id],
    relationName: "notesWritten",
  }),
}));

export const insertUserNoteSchema = createInsertSchema(userNotes).omit({ id: true, createdAt: true });
export type InsertUserNote = z.infer<typeof insertUserNoteSchema>;
export type UserNote = typeof userNotes.$inferSelect;
