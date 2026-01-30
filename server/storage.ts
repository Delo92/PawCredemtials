import {
  users,
  packages,
  applications,
  applicationSteps,
  documents,
  messages,
  queueEntries,
  payments,
  commissions,
  notifications,
  activityLogs,
  siteConfig,
  userNotes,
  type User,
  type InsertUser,
  type Package,
  type InsertPackage,
  type Application,
  type InsertApplication,
  type ApplicationStep,
  type InsertApplicationStep,
  type Document,
  type InsertDocument,
  type Message,
  type InsertMessage,
  type QueueEntry,
  type InsertQueueEntry,
  type Payment,
  type InsertPayment,
  type Commission,
  type InsertCommission,
  type Notification,
  type InsertNotification,
  type ActivityLog,
  type InsertActivityLog,
  type SiteConfig,
  type InsertSiteConfig,
  type UserNote,
  type InsertUserNote,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, like, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByLevel(level: number): Promise<User[]>;

  // Packages
  getPackage(id: string): Promise<Package | undefined>;
  getAllPackages(): Promise<Package[]>;
  getActivePackages(): Promise<Package[]>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined>;
  deletePackage(id: string): Promise<boolean>;

  // Applications
  getApplication(id: string): Promise<Application | undefined>;
  getApplicationsByUser(userId: string): Promise<Application[]>;
  getApplicationsByStatus(status: string): Promise<Application[]>;
  getAllApplications(): Promise<Application[]>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined>;

  // Application Steps
  getApplicationSteps(applicationId: string): Promise<ApplicationStep[]>;
  createApplicationStep(step: InsertApplicationStep): Promise<ApplicationStep>;
  updateApplicationStep(id: string, data: Partial<InsertApplicationStep>): Promise<ApplicationStep | undefined>;

  // Documents
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByApplication(applicationId: string): Promise<Document[]>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]>;
  getMessagesForUser(userId: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  createMessage(msg: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message | undefined>;

  // Queue Entries
  getQueueEntry(id: string): Promise<QueueEntry | undefined>;
  getWaitingQueueEntries(): Promise<QueueEntry[]>;
  getInCallQueueEntries(): Promise<QueueEntry[]>;
  getCompletedQueueEntriesToday(): Promise<QueueEntry[]>;
  getQueueEntriesByReviewer(reviewerId: string): Promise<QueueEntry[]>;
  createQueueEntry(entry: InsertQueueEntry): Promise<QueueEntry>;
  updateQueueEntry(id: string, data: Partial<InsertQueueEntry>): Promise<QueueEntry | undefined>;

  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByUser(userId: string): Promise<Payment[]>;
  getPaymentsByApplication(applicationId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;

  // Commissions
  getCommission(id: string): Promise<Commission | undefined>;
  getCommissionsByAgent(agentId: string): Promise<Commission[]>;
  getAllCommissions(): Promise<Commission[]>;
  createCommission(commission: InsertCommission): Promise<Commission>;
  updateCommission(id: string, data: Partial<InsertCommission>): Promise<Commission | undefined>;

  // Notifications
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;

  // Site Config
  getSiteConfig(): Promise<SiteConfig | undefined>;
  updateSiteConfig(data: Partial<InsertSiteConfig>): Promise<SiteConfig>;

  // User Notes
  getUserNotes(userId: string): Promise<(UserNote & { author?: { firstName: string; lastName: string } })[]>;
  createUserNote(note: InsertUserNote): Promise<UserNote>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || undefined;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user || undefined;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByLevel(level: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.userLevel, level)).orderBy(desc(users.createdAt));
  }

  // Packages
  async getPackage(id: string): Promise<Package | undefined> {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, id));
    return pkg || undefined;
  }

  async getAllPackages(): Promise<Package[]> {
    return db.select().from(packages).orderBy(asc(packages.sortOrder));
  }

  async getActivePackages(): Promise<Package[]> {
    return db.select().from(packages).where(eq(packages.isActive, true)).orderBy(asc(packages.sortOrder));
  }

  async createPackage(insertPkg: InsertPackage): Promise<Package> {
    const [pkg] = await db.insert(packages).values(insertPkg).returning();
    return pkg;
  }

  async updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined> {
    const [pkg] = await db.update(packages).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(packages.id, id)).returning();
    return pkg || undefined;
  }

  async deletePackage(id: string): Promise<boolean> {
    const result = await db.delete(packages).where(eq(packages.id, id)).returning();
    return result.length > 0;
  }

  // Applications
  async getApplication(id: string): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app || undefined;
  }

  async getApplicationsByUser(userId: string): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.createdAt));
  }

  async getApplicationsByStatus(status: string): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.status, status)).orderBy(desc(applications.createdAt));
  }

  async getAllApplications(): Promise<Application[]> {
    return db.select().from(applications).orderBy(desc(applications.createdAt));
  }

  async createApplication(insertApp: InsertApplication): Promise<Application> {
    const [app] = await db.insert(applications).values(insertApp).returning();
    return app;
  }

  async updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined> {
    const [app] = await db.update(applications).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(applications.id, id)).returning();
    return app || undefined;
  }

  // Application Steps
  async getApplicationSteps(applicationId: string): Promise<ApplicationStep[]> {
    return db.select().from(applicationSteps).where(eq(applicationSteps.applicationId, applicationId)).orderBy(asc(applicationSteps.stepNumber));
  }

  async createApplicationStep(step: InsertApplicationStep): Promise<ApplicationStep> {
    const [result] = await db.insert(applicationSteps).values(step).returning();
    return result;
  }

  async updateApplicationStep(id: string, data: Partial<InsertApplicationStep>): Promise<ApplicationStep | undefined> {
    const [result] = await db.update(applicationSteps).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(applicationSteps.id, id)).returning();
    return result || undefined;
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc || undefined;
  }

  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.applicationId, applicationId)).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [result] = await db.insert(documents).values(doc).returning();
    return result;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const [result] = await db.update(documents).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(documents.id, id)).returning();
    return result || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  // Messages
  async getMessage(id: string): Promise<Message | undefined> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    return msg || undefined;
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]> {
    return db.select().from(messages).where(
      or(
        and(eq(messages.senderId, user1Id), eq(messages.receiverId, user2Id)),
        and(eq(messages.senderId, user2Id), eq(messages.receiverId, user1Id))
      )
    ).orderBy(asc(messages.createdAt));
  }

  async getMessagesForUser(userId: string): Promise<Message[]> {
    return db.select().from(messages).where(
      or(eq(messages.senderId, userId), eq(messages.receiverId, userId))
    ).orderBy(desc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const unread = await db.select().from(messages).where(
      and(eq(messages.receiverId, userId), eq(messages.isRead, false))
    );
    return unread.length;
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const [result] = await db.insert(messages).values(msg).returning();
    return result;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const [result] = await db.update(messages).set({
      isRead: true,
      readAt: new Date(),
    }).where(eq(messages.id, id)).returning();
    return result || undefined;
  }

  // Queue Entries
  async getQueueEntry(id: string): Promise<QueueEntry | undefined> {
    const [entry] = await db.select().from(queueEntries).where(eq(queueEntries.id, id));
    return entry || undefined;
  }

  async getWaitingQueueEntries(): Promise<QueueEntry[]> {
    return db.select().from(queueEntries).where(eq(queueEntries.status, "waiting")).orderBy(desc(queueEntries.priority), asc(queueEntries.createdAt));
  }

  async getInCallQueueEntries(): Promise<QueueEntry[]> {
    return db.select().from(queueEntries).where(
      or(eq(queueEntries.status, "in_call"), eq(queueEntries.status, "claimed"))
    ).orderBy(desc(queueEntries.createdAt));
  }

  async getCompletedQueueEntriesToday(): Promise<QueueEntry[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return db.select().from(queueEntries).where(
      and(
        eq(queueEntries.status, "completed"),
        gte(queueEntries.completedAt, today)
      )
    ).orderBy(desc(queueEntries.completedAt));
  }

  async getQueueEntriesByReviewer(reviewerId: string): Promise<QueueEntry[]> {
    return db.select().from(queueEntries).where(eq(queueEntries.reviewerId, reviewerId)).orderBy(desc(queueEntries.createdAt));
  }

  async createQueueEntry(entry: InsertQueueEntry): Promise<QueueEntry> {
    const [result] = await db.insert(queueEntries).values(entry).returning();
    return result;
  }

  async updateQueueEntry(id: string, data: Partial<InsertQueueEntry>): Promise<QueueEntry | undefined> {
    const [result] = await db.update(queueEntries).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(queueEntries.id, id)).returning();
    return result || undefined;
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByApplication(applicationId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.applicationId, applicationId)).orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [result] = await db.insert(payments).values(payment).returning();
    return result;
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [result] = await db.update(payments).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(payments.id, id)).returning();
    return result || undefined;
  }

  // Commissions
  async getCommission(id: string): Promise<Commission | undefined> {
    const [commission] = await db.select().from(commissions).where(eq(commissions.id, id));
    return commission || undefined;
  }

  async getCommissionsByAgent(agentId: string): Promise<Commission[]> {
    return db.select().from(commissions).where(eq(commissions.agentId, agentId)).orderBy(desc(commissions.createdAt));
  }

  async getAllCommissions(): Promise<Commission[]> {
    return db.select().from(commissions).orderBy(desc(commissions.createdAt));
  }

  async createCommission(commission: InsertCommission): Promise<Commission> {
    const [result] = await db.insert(commissions).values(commission).returning();
    return result;
  }

  async updateCommission(id: string, data: Partial<InsertCommission>): Promise<Commission | undefined> {
    const [result] = await db.update(commissions).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(commissions.id, id)).returning();
    return result || undefined;
  }

  // Notifications
  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    ).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [result] = await db.update(notifications).set({
      isRead: true,
      readAt: new Date(),
    }).where(eq(notifications.id, id)).returning();
    return result || undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications).set({
      isRead: true,
      readAt: new Date(),
    }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [result] = await db.insert(activityLogs).values(log).returning();
    return result;
  }

  async getActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
    return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
  }

  // Site Config
  async getSiteConfig(): Promise<SiteConfig | undefined> {
    const configs = await db.select().from(siteConfig).limit(1);
    return configs[0] || undefined;
  }

  async updateSiteConfig(data: Partial<InsertSiteConfig>): Promise<SiteConfig> {
    const existing = await this.getSiteConfig();
    if (existing) {
      const [result] = await db.update(siteConfig).set({
        ...data,
        updatedAt: new Date(),
      }).where(eq(siteConfig.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(siteConfig).values(data).returning();
      return result;
    }
  }

  // User Notes
  async getUserNotes(userId: string): Promise<(UserNote & { author?: { firstName: string; lastName: string } })[]> {
    const notes = await db.select().from(userNotes).where(eq(userNotes.userId, userId)).orderBy(desc(userNotes.createdAt));
    const notesWithAuthors = await Promise.all(notes.map(async (note) => {
      const author = await this.getUser(note.authorId);
      return {
        ...note,
        author: author ? { firstName: author.firstName, lastName: author.lastName } : undefined,
      };
    }));
    return notesWithAuthors;
  }

  async createUserNote(note: InsertUserNote): Promise<UserNote> {
    const [result] = await db.insert(userNotes).values(note).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
