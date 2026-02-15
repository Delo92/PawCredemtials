import {
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
import { firestore } from "./firebase-admin";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByLevel(level: number): Promise<User[]>;

  getPackage(id: string): Promise<Package | undefined>;
  getAllPackages(): Promise<Package[]>;
  getActivePackages(): Promise<Package[]>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined>;
  deletePackage(id: string): Promise<boolean>;

  getApplication(id: string): Promise<Application | undefined>;
  getApplicationsByUser(userId: string): Promise<Application[]>;
  getApplicationsByStatus(status: string): Promise<Application[]>;
  getAllApplications(): Promise<Application[]>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined>;

  getApplicationSteps(applicationId: string): Promise<ApplicationStep[]>;
  createApplicationStep(step: InsertApplicationStep): Promise<ApplicationStep>;
  updateApplicationStep(id: string, data: Partial<InsertApplicationStep>): Promise<ApplicationStep | undefined>;

  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByApplication(applicationId: string): Promise<Document[]>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  getMessage(id: string): Promise<Message | undefined>;
  getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]>;
  getMessagesForUser(userId: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  createMessage(msg: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message | undefined>;

  getQueueEntry(id: string): Promise<QueueEntry | undefined>;
  getWaitingQueueEntries(): Promise<QueueEntry[]>;
  getInCallQueueEntries(): Promise<QueueEntry[]>;
  getCompletedQueueEntriesToday(): Promise<QueueEntry[]>;
  getQueueEntriesByReviewer(reviewerId: string): Promise<QueueEntry[]>;
  createQueueEntry(entry: InsertQueueEntry): Promise<QueueEntry>;
  updateQueueEntry(id: string, data: Partial<InsertQueueEntry>): Promise<QueueEntry | undefined>;

  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByUser(userId: string): Promise<Payment[]>;
  getPaymentsByApplication(applicationId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;

  getCommission(id: string): Promise<Commission | undefined>;
  getCommissionsByAgent(agentId: string): Promise<Commission[]>;
  getAllCommissions(): Promise<Commission[]>;
  createCommission(commission: InsertCommission): Promise<Commission>;
  updateCommission(id: string, data: Partial<InsertCommission>): Promise<Commission | undefined>;

  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;

  getSiteConfig(): Promise<SiteConfig | undefined>;
  updateSiteConfig(data: Partial<InsertSiteConfig>): Promise<SiteConfig>;

  getUserNotes(userId: string): Promise<(UserNote & { author?: { firstName: string; lastName: string } })[]>;
  createUserNote(note: InsertUserNote): Promise<UserNote>;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate && typeof val.toDate === "function") return val.toDate();
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return null;
}

function serializeForFirestore(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value instanceof Date) {
      result[key] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function docToRecord(doc: FirebaseFirestore.DocumentSnapshot): Record<string, any> | undefined {
  if (!doc.exists) return undefined;
  const data = doc.data()!;
  const result: Record<string, any> = { id: doc.id };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && typeof value.toDate === "function") {
      result[key] = value.toDate();
    } else {
      result[key] = value;
    }
  }
  return result;
}

function docsToRecords(snapshot: FirebaseFirestore.QuerySnapshot): Record<string, any>[] {
  return snapshot.docs.map(doc => {
    const data = doc.data();
    const result: Record<string, any> = { id: doc.id };
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && typeof value.toDate === "function") {
        result[key] = value.toDate();
      } else {
        result[key] = value;
      }
    }
    return result;
  });
}

export class FirestoreStorage implements IStorage {
  private col(name: string) {
    return firestore.collection(name);
  }

  // =========================================================================
  // USERS
  // =========================================================================
  async getUser(id: string): Promise<User | undefined> {
    const doc = await this.col("users").doc(id).get();
    return docToRecord(doc) as User | undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const snap = await this.col("users").where("email", "==", email.toLowerCase()).limit(1).get();
    if (snap.empty) return undefined;
    return docsToRecords(snap)[0] as User;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const snap = await this.col("users").where("firebaseUid", "==", firebaseUid).limit(1).get();
    if (snap.empty) return undefined;
    return docsToRecords(snap)[0] as User;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const snap = await this.col("users").where("referralCode", "==", referralCode).limit(1).get();
    if (snap.empty) return undefined;
    return docsToRecords(snap)[0] as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const userData = serializeForFirestore({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
      createdAt: now,
      updatedAt: now,
      isActive: insertUser.isActive ?? true,
      userLevel: insertUser.userLevel ?? 1,
    });
    await this.col("users").doc(id).set(userData);
    return { id, ...userData } as User;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const ref = this.col("users").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as User;
  }

  async getAllUsers(): Promise<User[]> {
    const snap = await this.col("users").orderBy("createdAt", "desc").get();
    return docsToRecords(snap) as User[];
  }

  async getUsersByLevel(level: number): Promise<User[]> {
    const snap = await this.col("users").where("userLevel", "==", level).get();
    const results = docsToRecords(snap) as User[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // =========================================================================
  // PACKAGES
  // =========================================================================
  async getPackage(id: string): Promise<Package | undefined> {
    const doc = await this.col("packages").doc(id).get();
    return docToRecord(doc) as Package | undefined;
  }

  async getAllPackages(): Promise<Package[]> {
    const snap = await this.col("packages").orderBy("sortOrder", "asc").get();
    return docsToRecords(snap) as Package[];
  }

  async getActivePackages(): Promise<Package[]> {
    const snap = await this.col("packages").where("isActive", "==", true).get();
    const results = docsToRecords(snap) as Package[];
    return results.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async createPackage(insertPkg: InsertPackage): Promise<Package> {
    const id = randomUUID();
    const now = new Date();
    const pkgData = serializeForFirestore({
      ...insertPkg,
      createdAt: now,
      updatedAt: now,
      isActive: insertPkg.isActive ?? true,
      sortOrder: insertPkg.sortOrder ?? 0,
      requiredDocuments: insertPkg.requiredDocuments ?? [],
      formFields: insertPkg.formFields ?? [],
      workflowSteps: insertPkg.workflowSteps ?? ["Registration", "Payment", "Document Upload", "Review", "Approval", "Completed"],
    });
    await this.col("packages").doc(id).set(pkgData);
    return { id, ...pkgData } as Package;
  }

  async updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined> {
    const ref = this.col("packages").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Package;
  }

  async deletePackage(id: string): Promise<boolean> {
    const ref = this.col("packages").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    return true;
  }

  // =========================================================================
  // APPLICATIONS
  // =========================================================================
  async getApplication(id: string): Promise<Application | undefined> {
    const doc = await this.col("applications").doc(id).get();
    return docToRecord(doc) as Application | undefined;
  }

  async getApplicationsByUser(userId: string): Promise<Application[]> {
    const snap = await this.col("applications").where("userId", "==", userId).get();
    const results = docsToRecords(snap) as Application[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getApplicationsByStatus(status: string): Promise<Application[]> {
    const snap = await this.col("applications").where("status", "==", status).get();
    const results = docsToRecords(snap) as Application[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllApplications(): Promise<Application[]> {
    const snap = await this.col("applications").orderBy("createdAt", "desc").get();
    return docsToRecords(snap) as Application[];
  }

  async createApplication(insertApp: InsertApplication): Promise<Application> {
    const id = randomUUID();
    const now = new Date();
    const appData = serializeForFirestore({
      ...insertApp,
      createdAt: now,
      updatedAt: now,
      status: insertApp.status ?? "pending",
      currentStep: insertApp.currentStep ?? 1,
      totalSteps: insertApp.totalSteps ?? 6,
      currentLevel: insertApp.currentLevel ?? 1,
      formData: insertApp.formData ?? {},
      paymentStatus: insertApp.paymentStatus ?? "unpaid",
    });
    await this.col("applications").doc(id).set(appData);
    return { id, ...appData } as Application;
  }

  async updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined> {
    const ref = this.col("applications").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Application;
  }

  // =========================================================================
  // APPLICATION STEPS
  // =========================================================================
  async getApplicationSteps(applicationId: string): Promise<ApplicationStep[]> {
    const snap = await this.col("applicationSteps").where("applicationId", "==", applicationId).get();
    const results = docsToRecords(snap) as ApplicationStep[];
    return results.sort((a, b) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0));
  }

  async createApplicationStep(step: InsertApplicationStep): Promise<ApplicationStep> {
    const id = randomUUID();
    const now = new Date();
    const stepData = serializeForFirestore({
      ...step,
      createdAt: now,
      updatedAt: now,
      status: step.status ?? "pending",
      stepData: step.stepData ?? {},
    });
    await this.col("applicationSteps").doc(id).set(stepData);
    return { id, ...stepData } as ApplicationStep;
  }

  async updateApplicationStep(id: string, data: Partial<InsertApplicationStep>): Promise<ApplicationStep | undefined> {
    const ref = this.col("applicationSteps").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as ApplicationStep;
  }

  // =========================================================================
  // DOCUMENTS
  // =========================================================================
  async getDocument(id: string): Promise<Document | undefined> {
    const doc = await this.col("documents").doc(id).get();
    return docToRecord(doc) as Document | undefined;
  }

  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    const snap = await this.col("documents").where("applicationId", "==", applicationId).get();
    const results = docsToRecords(snap) as Document[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    const snap = await this.col("documents").where("userId", "==", userId).get();
    const results = docsToRecords(snap) as Document[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const now = new Date();
    const docData = serializeForFirestore({
      ...doc,
      createdAt: now,
      updatedAt: now,
      status: doc.status ?? "pending",
    });
    await this.col("documents").doc(id).set(docData);
    return { id, ...docData } as Document;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const ref = this.col("documents").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const ref = this.col("documents").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    return true;
  }

  // =========================================================================
  // MESSAGES
  // =========================================================================
  async getMessage(id: string): Promise<Message | undefined> {
    const doc = await this.col("messages").doc(id).get();
    return docToRecord(doc) as Message | undefined;
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]> {
    const snap1 = await this.col("messages")
      .where("senderId", "==", user1Id)
      .where("receiverId", "==", user2Id)
      .get();
    const snap2 = await this.col("messages")
      .where("senderId", "==", user2Id)
      .where("receiverId", "==", user1Id)
      .get();
    const all = [...docsToRecords(snap1), ...docsToRecords(snap2)] as Message[];
    return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getMessagesForUser(userId: string): Promise<Message[]> {
    const snap1 = await this.col("messages").where("senderId", "==", userId).get();
    const snap2 = await this.col("messages").where("receiverId", "==", userId).get();
    const seen = new Set<string>();
    const all: Message[] = [];
    for (const msg of [...docsToRecords(snap1), ...docsToRecords(snap2)]) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        all.push(msg as Message);
      }
    }
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const snap = await this.col("messages")
      .where("receiverId", "==", userId)
      .where("isRead", "==", false)
      .get();
    return snap.size;
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const now = new Date();
    const msgData = serializeForFirestore({
      ...msg,
      createdAt: now,
      isRead: msg.isRead ?? false,
    });
    await this.col("messages").doc(id).set(msgData);
    return { id, ...msgData } as Message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const ref = this.col("messages").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update({ isRead: true, readAt: new Date() });
    const updated = await ref.get();
    return docToRecord(updated) as Message;
  }

  // =========================================================================
  // QUEUE ENTRIES
  // =========================================================================
  async getQueueEntry(id: string): Promise<QueueEntry | undefined> {
    const doc = await this.col("queueEntries").doc(id).get();
    return docToRecord(doc) as QueueEntry | undefined;
  }

  async getWaitingQueueEntries(): Promise<QueueEntry[]> {
    const snap = await this.col("queueEntries").where("status", "==", "waiting").get();
    const results = docsToRecords(snap) as QueueEntry[];
    return results.sort((a, b) => {
      const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (pDiff !== 0) return pDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async getInCallQueueEntries(): Promise<QueueEntry[]> {
    const snap1 = await this.col("queueEntries").where("status", "==", "in_call").get();
    const snap2 = await this.col("queueEntries").where("status", "==", "claimed").get();
    const all = [...docsToRecords(snap1), ...docsToRecords(snap2)] as QueueEntry[];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCompletedQueueEntriesToday(): Promise<QueueEntry[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const snap = await this.col("queueEntries")
      .where("status", "==", "completed")
      .where("completedAt", ">=", today)
      .get();
    const results = docsToRecords(snap) as QueueEntry[];
    return results.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  }

  async getQueueEntriesByReviewer(reviewerId: string): Promise<QueueEntry[]> {
    const snap = await this.col("queueEntries").where("reviewerId", "==", reviewerId).get();
    const results = docsToRecords(snap) as QueueEntry[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createQueueEntry(entry: InsertQueueEntry): Promise<QueueEntry> {
    const id = randomUUID();
    const now = new Date();
    const entryData = serializeForFirestore({
      ...entry,
      createdAt: now,
      updatedAt: now,
      status: entry.status ?? "waiting",
      queueType: entry.queueType ?? "consultation",
      priority: entry.priority ?? 0,
    });
    await this.col("queueEntries").doc(id).set(entryData);
    return { id, ...entryData } as QueueEntry;
  }

  async updateQueueEntry(id: string, data: Partial<InsertQueueEntry>): Promise<QueueEntry | undefined> {
    const ref = this.col("queueEntries").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as QueueEntry;
  }

  // =========================================================================
  // PAYMENTS
  // =========================================================================
  async getPayment(id: string): Promise<Payment | undefined> {
    const doc = await this.col("payments").doc(id).get();
    return docToRecord(doc) as Payment | undefined;
  }

  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    const snap = await this.col("payments").where("userId", "==", userId).get();
    const results = docsToRecords(snap) as Payment[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPaymentsByApplication(applicationId: string): Promise<Payment[]> {
    const snap = await this.col("payments").where("applicationId", "==", applicationId).get();
    const results = docsToRecords(snap) as Payment[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllPayments(): Promise<Payment[]> {
    const snap = await this.col("payments").orderBy("createdAt", "desc").get();
    return docsToRecords(snap) as Payment[];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const now = new Date();
    const paymentData = serializeForFirestore({
      ...payment,
      createdAt: now,
      updatedAt: now,
      status: payment.status ?? "pending",
      metadata: payment.metadata ?? {},
    });
    await this.col("payments").doc(id).set(paymentData);
    return { id, ...paymentData } as Payment;
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const ref = this.col("payments").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Payment;
  }

  // =========================================================================
  // COMMISSIONS
  // =========================================================================
  async getCommission(id: string): Promise<Commission | undefined> {
    const doc = await this.col("commissions").doc(id).get();
    return docToRecord(doc) as Commission | undefined;
  }

  async getCommissionsByAgent(agentId: string): Promise<Commission[]> {
    const snap = await this.col("commissions").where("agentId", "==", agentId).get();
    const results = docsToRecords(snap) as Commission[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllCommissions(): Promise<Commission[]> {
    const snap = await this.col("commissions").orderBy("createdAt", "desc").get();
    return docsToRecords(snap) as Commission[];
  }

  async createCommission(commission: InsertCommission): Promise<Commission> {
    const id = randomUUID();
    const now = new Date();
    const commData = serializeForFirestore({
      ...commission,
      createdAt: now,
      updatedAt: now,
      status: commission.status ?? "pending",
    });
    await this.col("commissions").doc(id).set(commData);
    return { id, ...commData } as Commission;
  }

  async updateCommission(id: string, data: Partial<InsertCommission>): Promise<Commission | undefined> {
    const ref = this.col("commissions").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Commission;
  }

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================
  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    const snap = await this.col("notifications").where("userId", "==", userId).get();
    const results = docsToRecords(snap) as Notification[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const snap = await this.col("notifications")
      .where("userId", "==", userId)
      .where("isRead", "==", false)
      .get();
    const results = docsToRecords(snap) as Notification[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const now = new Date();
    const notifData = serializeForFirestore({
      ...notification,
      createdAt: now,
      isRead: notification.isRead ?? false,
      type: notification.type ?? "info",
      metadata: notification.metadata ?? {},
    });
    await this.col("notifications").doc(id).set(notifData);
    return { id, ...notifData } as Notification;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const ref = this.col("notifications").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update({ isRead: true, readAt: new Date() });
    const updated = await ref.get();
    return docToRecord(updated) as Notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const snap = await this.col("notifications")
      .where("userId", "==", userId)
      .where("isRead", "==", false)
      .get();
    const batch = firestore.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true, readAt: new Date() });
    });
    await batch.commit();
  }

  // =========================================================================
  // ACTIVITY LOGS
  // =========================================================================
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const now = new Date();
    const logData = serializeForFirestore({
      ...log,
      createdAt: now,
      details: log.details ?? {},
    });
    await this.col("activityLogs").doc(id).set(logData);
    return { id, ...logData } as ActivityLog;
  }

  async getActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
    const snap = await this.col("activityLogs").orderBy("createdAt", "desc").limit(limit).get();
    return docsToRecords(snap) as ActivityLog[];
  }

  // =========================================================================
  // SITE CONFIG
  // =========================================================================
  async getSiteConfig(): Promise<SiteConfig | undefined> {
    const snap = await this.col("siteConfig").limit(1).get();
    if (snap.empty) return undefined;
    return docsToRecords(snap)[0] as SiteConfig;
  }

  async updateSiteConfig(data: Partial<InsertSiteConfig>): Promise<SiteConfig> {
    const existing = await this.getSiteConfig();
    if (existing) {
      const ref = this.col("siteConfig").doc(existing.id);
      const updateData = serializeForFirestore({ ...data, updatedAt: new Date() });
      await ref.update(updateData);
      const updated = await ref.get();
      return docToRecord(updated) as SiteConfig;
    } else {
      const id = randomUUID();
      const now = new Date();
      const configData = serializeForFirestore({
        ...data,
        createdAt: now,
        updatedAt: now,
      });
      await this.col("siteConfig").doc(id).set(configData);
      return { id, ...configData } as SiteConfig;
    }
  }

  // =========================================================================
  // USER NOTES
  // =========================================================================
  async getUserNotes(userId: string): Promise<(UserNote & { author?: { firstName: string; lastName: string } })[]> {
    const snap = await this.col("userNotes").where("userId", "==", userId).get();
    const notes = docsToRecords(snap) as UserNote[];
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    const id = randomUUID();
    const now = new Date();
    const noteData = serializeForFirestore({
      ...note,
      createdAt: now,
    });
    await this.col("userNotes").doc(id).set(noteData);
    return { id, ...noteData } as UserNote;
  }
}

export const storage = new FirestoreStorage();
