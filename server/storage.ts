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
  type DoctorReviewToken,
  type InsertDoctorReviewToken,
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
import { getDb, FieldValue } from "./firebase-admin";
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

  getDoctorReviewToken(id: string): Promise<DoctorReviewToken | undefined>;
  getDoctorReviewTokenByToken(token: string): Promise<DoctorReviewToken | undefined>;
  getDoctorReviewTokensByDoctor(doctorId: string): Promise<DoctorReviewToken[]>;
  getDoctorReviewTokensByApplication(applicationId: string): Promise<DoctorReviewToken[]>;
  createDoctorReviewToken(data: InsertDoctorReviewToken): Promise<DoctorReviewToken>;
  updateDoctorReviewToken(id: string, data: Partial<InsertDoctorReviewToken>): Promise<DoctorReviewToken | undefined>;
  getNextDoctorForAssignment(): Promise<Record<string, any> | undefined>;
  getActiveDoctors(): Promise<Record<string, any>[]>;

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

  getNotification(id: string): Promise<Notification | undefined>;
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

  getCounter(collectionName: string): Promise<number>;
  initializeCounters(): Promise<void>;
  initCollectionWithPlaceholder(collectionName: string, placeholderDoc: Record<string, any>): Promise<boolean>;

  getAdminSettings(): Promise<Record<string, any> | undefined>;
  updateAdminSettings(data: Record<string, any>): Promise<Record<string, any>>;

  getApproval(id: string): Promise<Record<string, any> | undefined>;
  getApprovalsByUser(firebaseUid: string): Promise<Record<string, any>[]>;
  createApproval(data: Record<string, any>): Promise<Record<string, any>>;
  updateApproval(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  createErrorLog(data: Record<string, any>): Promise<Record<string, any>>;
  getErrorLogs(limit?: number): Promise<Record<string, any>[]>;

  getDocumentStates(firebaseUid: string): Promise<Record<string, any>[]>;
  updateDocumentState(firebaseUid: string, documentType: string, state: Record<string, any>): Promise<Record<string, any>>;

  getCommissionSettings(): Promise<Record<string, any> | undefined>;
  updateCommissionSettings(data: Record<string, any>): Promise<Record<string, any>>;

  createConsultationRecord(data: Record<string, any>): Promise<Record<string, any>>;
  getConsultationHistory(firebaseUid: string): Promise<Record<string, any>[]>;

  getFormAssignment(id: string): Promise<Record<string, any> | undefined>;
  getFormAssignmentsByUser(firebaseUid: string): Promise<Record<string, any>[]>;
  createFormAssignment(data: Record<string, any>): Promise<Record<string, any>>;
  updateFormAssignment(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  getFormTemplates(): Promise<Record<string, any>[]>;
  createFormTemplate(data: Record<string, any>): Promise<Record<string, any>>;

  getFormTypes(): Promise<Record<string, any>[]>;
  createFormType(data: Record<string, any>): Promise<Record<string, any>>;

  getWorkflowInstance(id: string): Promise<Record<string, any> | undefined>;
  getWorkflowInstancesByUser(firebaseUid: string): Promise<Record<string, any>[]>;
  createWorkflowInstance(data: Record<string, any>): Promise<Record<string, any>>;
  updateWorkflowInstance(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  getAgentQueue(): Promise<Record<string, any>[]>;
  getAgentQueueByAgent(agentFirebaseUid: string): Promise<Record<string, any>[]>;
  createAgentQueueEntry(data: Record<string, any>): Promise<Record<string, any>>;
  updateAgentQueueEntry(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  getAgentClockStatus(agentFirebaseUid: string): Promise<Record<string, any> | undefined>;
  getAgentClockRecords(agentFirebaseUid: string): Promise<Record<string, any>[]>;
  createAgentClockRecord(data: Record<string, any>): Promise<Record<string, any>>;
  updateAgentClockRecord(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  getBulletins(): Promise<Record<string, any>[]>;
  createBulletin(data: Record<string, any>): Promise<Record<string, any>>;
  updateBulletin(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;
  deleteBulletin(id: string): Promise<boolean>;

  getApplicationStatus(firebaseUid: string): Promise<Record<string, any> | undefined>;
  createApplicationStatus(data: Record<string, any>): Promise<Record<string, any>>;
  updateApplicationStatus(firebaseUid: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  getStepData(firebaseUid: string): Promise<Record<string, any> | undefined>;
  updateStepData(firebaseUid: string, data: Record<string, any>): Promise<Record<string, any>>;

  getProfileNotes(firebaseUid: string): Promise<Record<string, any>[]>;
  createProfileNote(data: Record<string, any>): Promise<Record<string, any>>;

  getPushSubscriptions(firebaseUid: string): Promise<Record<string, any>[]>;
  createPushSubscription(data: Record<string, any>): Promise<Record<string, any>>;
  deletePushSubscription(id: string): Promise<boolean>;

  getBlogPosts(): Promise<Record<string, any>[]>;
  createBlogPost(data: Record<string, any>): Promise<Record<string, any>>;
  updateBlogPost(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;
  deleteBlogPost(id: string): Promise<boolean>;

  getChargebacks(): Promise<Record<string, any>[]>;
  createChargeback(data: Record<string, any>): Promise<Record<string, any>>;
  updateChargeback(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  getReferralCodeHistory(agentFirebaseUid: string): Promise<Record<string, any>[]>;
  createReferralCodeHistory(data: Record<string, any>): Promise<Record<string, any>>;

  getReferralRegistrations(agentFirebaseUid: string): Promise<Record<string, any>[]>;
  createReferralRegistration(data: Record<string, any>): Promise<Record<string, any>>;

  getSystemReferralCodes(): Promise<Record<string, any>[]>;
  createSystemReferralCode(data: Record<string, any>): Promise<Record<string, any>>;

  getTermsOfService(): Promise<Record<string, any> | undefined>;
  updateTermsOfService(data: Record<string, any>): Promise<Record<string, any>>;

  getTermsAcceptances(firebaseUid: string): Promise<Record<string, any>[]>;
  createTermsAcceptance(data: Record<string, any>): Promise<Record<string, any>>;

  getAgentDocuments(agentFirebaseUid: string): Promise<Record<string, any>[]>;
  createAgentDocument(data: Record<string, any>): Promise<Record<string, any>>;

  getDoctorProfile(doctorId: string): Promise<Record<string, any> | undefined>;
  getDoctorProfileByUserId(userId: string): Promise<Record<string, any> | undefined>;
  getAllDoctorProfiles(): Promise<Record<string, any>[]>;
  createDoctorProfile(data: Record<string, any>): Promise<Record<string, any>>;
  updateDoctorProfile(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;

  getAutoMessageTriggers(packageId: string): Promise<Record<string, any>[]>;
  createAutoMessageTrigger(data: Record<string, any>): Promise<Record<string, any>>;
  updateAutoMessageTrigger(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined>;
  deleteAutoMessageTrigger(id: string): Promise<boolean>;
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

function cleanForFirestore(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

export class FirestoreStorage implements IStorage {
  private col(name: string) {
    return getDb().collection(name);
  }

  private async incrementCounter(collectionName: string, delta: number = 1): Promise<void> {
    const counterRef = this.col("_counters").doc(collectionName);
    const existing = await counterRef.get();
    if (existing.exists) {
      await counterRef.update({ count: FieldValue.increment(delta) });
    } else {
      await counterRef.set({ count: delta });
    }
  }

  // =========================================================================
  // COUNTERS
  // =========================================================================
  async getCounter(collectionName: string): Promise<number> {
    const doc = await this.col("_counters").doc(collectionName).get();
    if (!doc.exists) return 0;
    return doc.data()?.count ?? 0;
  }

  async initializeCounters(): Promise<void> {
    const collections = [
      "users", "packages", "applications", "applicationSteps", "documents",
      "messages", "queueEntries", "payments", "commissions", "notifications",
      "activityLogs", "siteConfig", "userNotes", "adminSettings", "approvals",
      "errorLogs", "documentStates", "commissionSettings", "consultationHistory",
      "formAssignments", "formTemplates", "formTypes", "workflowInstances",
      "agentQueue", "agentClockRecords", "bulletin", "applicationStatus",
      "stepData", "profileNotes", "pushSubscriptions", "blogPosts", "chargebacks",
      "referralCodeHistory", "referralRegistrations", "systemReferralCodes",
      "termsOfService", "termsAcceptances", "agentDocuments",
      "doctorProfiles", "autoMessageTriggers"
    ];
    const db = getDb();
    const batch = db.batch();
    for (const col of collections) {
      const ref = this.col("_counters").doc(col);
      const existing = await ref.get();
      if (!existing.exists) {
        batch.set(ref, { count: 0 });
      }
    }
    await batch.commit();
  }

  async initCollectionWithPlaceholder(collectionName: string, placeholderDoc: Record<string, any>): Promise<boolean> {
    const snap = await this.col(collectionName).limit(1).get();
    if (!snap.empty) return false;
    const id = `_placeholder_${randomUUID().slice(0, 8)}`;
    await this.col(collectionName).doc(id).set(
      cleanForFirestore({ ...placeholderDoc, _isPlaceholder: true, createdAt: FieldValue.serverTimestamp() })
    );
    return true;
  }

  // =========================================================================
  // USERS - Firebase UID as document ID
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
    const doc = await this.col("users").doc(firebaseUid).get();
    if (!doc.exists) {
      const snap = await this.col("users").where("firebaseUid", "==", firebaseUid).limit(1).get();
      if (snap.empty) return undefined;
      return docsToRecords(snap)[0] as User;
    }
    return docToRecord(doc) as User;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const snap = await this.col("users").where("referralCode", "==", referralCode).limit(1).get();
    if (snap.empty) return undefined;
    return docsToRecords(snap)[0] as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = insertUser.firebaseUid || randomUUID();
    const userData = cleanForFirestore({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
      firebaseUid: insertUser.firebaseUid || id,
      isActive: insertUser.isActive ?? true,
      userLevel: insertUser.userLevel ?? 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("users").doc(id).set(userData);
    const created = await this.col("users").doc(id).get();
    await this.incrementCounter("users");
    return docToRecord(created) as User;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const ref = this.col("users").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
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
    const snap = await this.col("packages").get();
    const results = docsToRecords(snap) as Package[];
    return results.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getActivePackages(): Promise<Package[]> {
    const snap = await this.col("packages").where("isActive", "==", true).get();
    const results = docsToRecords(snap) as Package[];
    return results.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async createPackage(insertPkg: InsertPackage): Promise<Package> {
    const id = randomUUID();
    const pkgData = cleanForFirestore({
      ...insertPkg,
      isActive: insertPkg.isActive ?? true,
      sortOrder: insertPkg.sortOrder ?? 0,
      requiredDocuments: insertPkg.requiredDocuments ?? [],
      formFields: insertPkg.formFields ?? [],
      workflowSteps: insertPkg.workflowSteps ?? ["Registration", "Payment", "Document Upload", "Review", "Approval", "Completed"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("packages").doc(id).set(pkgData);
    const created = await this.col("packages").doc(id).get();
    await this.incrementCounter("packages");
    return docToRecord(created) as Package;
  }

  async updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package | undefined> {
    const ref = this.col("packages").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Package;
  }

  async deletePackage(id: string): Promise<boolean> {
    const ref = this.col("packages").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    await this.incrementCounter("packages", -1);
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
    const appData = cleanForFirestore({
      ...insertApp,
      status: insertApp.status ?? "pending",
      currentStep: insertApp.currentStep ?? 1,
      totalSteps: insertApp.totalSteps ?? 6,
      currentLevel: insertApp.currentLevel ?? 1,
      formData: insertApp.formData ?? {},
      paymentStatus: insertApp.paymentStatus ?? "unpaid",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("applications").doc(id).set(appData);
    const created = await this.col("applications").doc(id).get();
    await this.incrementCounter("applications");
    return docToRecord(created) as Application;
  }

  async updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined> {
    const ref = this.col("applications").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
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
    const stepData = cleanForFirestore({
      ...step,
      status: step.status ?? "pending",
      stepData: step.stepData ?? {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("applicationSteps").doc(id).set(stepData);
    const created = await this.col("applicationSteps").doc(id).get();
    await this.incrementCounter("applicationSteps");
    return docToRecord(created) as ApplicationStep;
  }

  async updateApplicationStep(id: string, data: Partial<InsertApplicationStep>): Promise<ApplicationStep | undefined> {
    const ref = this.col("applicationSteps").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
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
    const docData = cleanForFirestore({
      ...doc,
      status: doc.status ?? "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("documents").doc(id).set(docData);
    const created = await this.col("documents").doc(id).get();
    await this.incrementCounter("documents");
    return docToRecord(created) as Document;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const ref = this.col("documents").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const ref = this.col("documents").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    await this.incrementCounter("documents", -1);
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
    const msgData = cleanForFirestore({
      ...msg,
      isRead: msg.isRead ?? false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await this.col("messages").doc(id).set(msgData);
    const created = await this.col("messages").doc(id).get();
    await this.incrementCounter("messages");
    return docToRecord(created) as Message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const ref = this.col("messages").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update({ isRead: true, readAt: FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return docToRecord(updated) as Message;
  }

  // =========================================================================
  // DOCTOR REVIEW TOKENS
  // =========================================================================
  async getDoctorReviewToken(id: string): Promise<DoctorReviewToken | undefined> {
    const doc = await this.col("doctorReviewTokens").doc(id).get();
    return docToRecord(doc) as DoctorReviewToken | undefined;
  }

  async getDoctorReviewTokenByToken(token: string): Promise<DoctorReviewToken | undefined> {
    const snap = await this.col("doctorReviewTokens").where("token", "==", token).limit(1).get();
    if (snap.empty) return undefined;
    return docsToRecords(snap)[0] as DoctorReviewToken;
  }

  async getDoctorReviewTokensByDoctor(doctorId: string): Promise<DoctorReviewToken[]> {
    const snap = await this.col("doctorReviewTokens").where("doctorId", "==", doctorId).get();
    const results = docsToRecords(snap) as DoctorReviewToken[];
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDoctorReviewTokensByApplication(applicationId: string): Promise<DoctorReviewToken[]> {
    const snap = await this.col("doctorReviewTokens").where("applicationId", "==", applicationId).get();
    return docsToRecords(snap) as DoctorReviewToken[];
  }

  async createDoctorReviewToken(data: InsertDoctorReviewToken): Promise<DoctorReviewToken> {
    const id = randomUUID();
    const tokenData = cleanForFirestore({
      ...data,
      status: data.status ?? "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    await this.col("doctorReviewTokens").doc(id).set(tokenData);
    const created = await this.col("doctorReviewTokens").doc(id).get();
    await this.incrementCounter("doctorReviewTokens");
    return docToRecord(created) as DoctorReviewToken;
  }

  async updateDoctorReviewToken(id: string, data: Partial<InsertDoctorReviewToken>): Promise<DoctorReviewToken | undefined> {
    const ref = this.col("doctorReviewTokens").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore(data));
    const updated = await ref.get();
    return docToRecord(updated) as DoctorReviewToken;
  }

  async getNextDoctorForAssignment(): Promise<Record<string, any> | undefined> {
    const doctors = await this.getActiveDoctors();
    if (doctors.length === 0) return undefined;

    const settings = await this.getAdminSettings();
    const lastAssignedDoctorId = settings?.lastAssignedDoctorId || null;

    if (!lastAssignedDoctorId) {
      await this.updateAdminSettings({ lastAssignedDoctorId: doctors[0].userId });
      return doctors[0];
    }

    const lastIndex = doctors.findIndex(d => d.userId === lastAssignedDoctorId);
    const nextIndex = (lastIndex + 1) % doctors.length;
    const nextDoctor = doctors[nextIndex];

    await this.updateAdminSettings({ lastAssignedDoctorId: nextDoctor.userId });
    return nextDoctor;
  }

  async getActiveDoctors(): Promise<Record<string, any>[]> {
    const snap = await this.col("doctorProfiles").get();
    const profiles = docsToRecords(snap);
    const active = profiles.filter(p => !p._isPlaceholder && p.isActive !== false);
    return active.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aDate - bDate;
    });
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
    const paymentData = cleanForFirestore({
      ...payment,
      status: payment.status ?? "pending",
      metadata: payment.metadata ?? {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("payments").doc(id).set(paymentData);
    const created = await this.col("payments").doc(id).get();
    await this.incrementCounter("payments");
    return docToRecord(created) as Payment;
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const ref = this.col("payments").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
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
    const commData = cleanForFirestore({
      ...commission,
      status: commission.status ?? "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("commissions").doc(id).set(commData);
    const created = await this.col("commissions").doc(id).get();
    await this.incrementCounter("commissions");
    return docToRecord(created) as Commission;
  }

  async updateCommission(id: string, data: Partial<InsertCommission>): Promise<Commission | undefined> {
    const ref = this.col("commissions").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    await ref.update(updateData);
    const updated = await ref.get();
    return docToRecord(updated) as Commission;
  }

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================
  async getNotification(id: string): Promise<Notification | undefined> {
    const doc = await this.col("notifications").doc(id).get();
    return docToRecord(doc) as Notification | undefined;
  }

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
    const notifData = cleanForFirestore({
      ...notification,
      isRead: notification.isRead ?? false,
      type: notification.type ?? "info",
      metadata: notification.metadata ?? {},
      createdAt: FieldValue.serverTimestamp(),
    });
    await this.col("notifications").doc(id).set(notifData);
    const created = await this.col("notifications").doc(id).get();
    await this.incrementCounter("notifications");
    return docToRecord(created) as Notification;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const ref = this.col("notifications").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update({ isRead: true, readAt: FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return docToRecord(updated) as Notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const db = getDb();
    const snap = await this.col("notifications")
      .where("userId", "==", userId)
      .where("isRead", "==", false)
      .get();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true, readAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
  }

  // =========================================================================
  // ACTIVITY LOGS
  // =========================================================================
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const logData = cleanForFirestore({
      ...log,
      details: log.details ?? {},
      createdAt: FieldValue.serverTimestamp(),
    });
    await this.col("activityLogs").doc(id).set(logData);
    const created = await this.col("activityLogs").doc(id).get();
    await this.incrementCounter("activityLogs");
    return docToRecord(created) as ActivityLog;
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
      const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
      await ref.update(updateData);
      const updated = await ref.get();
      return docToRecord(updated) as SiteConfig;
    } else {
      const id = "default";
      const configData = cleanForFirestore({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await this.col("siteConfig").doc(id).set(configData);
      const created = await this.col("siteConfig").doc(id).get();
      return docToRecord(created) as SiteConfig;
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
    const noteData = cleanForFirestore({
      ...note,
      createdAt: FieldValue.serverTimestamp(),
    });
    await this.col("userNotes").doc(id).set(noteData);
    const created = await this.col("userNotes").doc(id).get();
    await this.incrementCounter("userNotes");
    return docToRecord(created) as UserNote;
  }

  // =========================================================================
  // ADMIN SETTINGS
  // =========================================================================
  async getAdminSettings(): Promise<Record<string, any> | undefined> {
    const doc = await this.col("adminSettings").doc("default").get();
    return docToRecord(doc);
  }

  async updateAdminSettings(data: Record<string, any>): Promise<Record<string, any>> {
    const ref = this.col("adminSettings").doc("default");
    const existing = await ref.get();
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    if (existing.exists) {
      await ref.update(updateData);
    } else {
      await ref.set({ ...updateData, createdAt: FieldValue.serverTimestamp() });
    }
    const updated = await ref.get();
    return docToRecord(updated)!;
  }

  // =========================================================================
  // APPROVALS
  // =========================================================================
  async getApproval(id: string): Promise<Record<string, any> | undefined> {
    const doc = await this.col("approvals").doc(id).get();
    return docToRecord(doc);
  }

  async getApprovalsByUser(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("approvals").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  async createApproval(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await this.col("approvals").doc(id).set(cleanData);
    await this.incrementCounter("approvals");
    const created = await this.col("approvals").doc(id).get();
    return docToRecord(created)!;
  }

  async updateApproval(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("approvals").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  // =========================================================================
  // ERROR LOGS
  // =========================================================================
  async createErrorLog(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("errorLogs").doc(id).set(cleanData);
    await this.incrementCounter("errorLogs");
    const created = await this.col("errorLogs").doc(id).get();
    return docToRecord(created)!;
  }

  async getErrorLogs(limit: number = 100): Promise<Record<string, any>[]> {
    const snap = await this.col("errorLogs").orderBy("createdAt", "desc").limit(limit).get();
    return docsToRecords(snap);
  }

  // =========================================================================
  // DOCUMENT STATES
  // =========================================================================
  async getDocumentStates(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("documentStates").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  async updateDocumentState(firebaseUid: string, documentType: string, state: Record<string, any>): Promise<Record<string, any>> {
    const snap = await this.col("documentStates")
      .where("firebaseUid", "==", firebaseUid)
      .where("documentType", "==", documentType)
      .limit(1).get();

    if (!snap.empty) {
      const ref = snap.docs[0].ref;
      await ref.update(cleanForFirestore({ ...state, updatedAt: FieldValue.serverTimestamp() }));
      const updated = await ref.get();
      return docToRecord(updated)!;
    } else {
      const id = randomUUID();
      const data = cleanForFirestore({ firebaseUid, documentType, ...state, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      await this.col("documentStates").doc(id).set(data);
      await this.incrementCounter("documentStates");
      const created = await this.col("documentStates").doc(id).get();
      return docToRecord(created)!;
    }
  }

  // =========================================================================
  // COMMISSION SETTINGS
  // =========================================================================
  async getCommissionSettings(): Promise<Record<string, any> | undefined> {
    const doc = await this.col("commissionSettings").doc("default").get();
    return docToRecord(doc);
  }

  async updateCommissionSettings(data: Record<string, any>): Promise<Record<string, any>> {
    const ref = this.col("commissionSettings").doc("default");
    const existing = await ref.get();
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    if (existing.exists) {
      await ref.update(updateData);
    } else {
      await ref.set({ ...updateData, createdAt: FieldValue.serverTimestamp() });
    }
    const updated = await ref.get();
    return docToRecord(updated)!;
  }

  // =========================================================================
  // CONSULTATION HISTORY
  // =========================================================================
  async createConsultationRecord(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("consultationHistory").doc(id).set(cleanData);
    await this.incrementCounter("consultationHistory");
    const created = await this.col("consultationHistory").doc(id).get();
    return docToRecord(created)!;
  }

  async getConsultationHistory(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("consultationHistory").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  // =========================================================================
  // FORM ASSIGNMENTS
  // =========================================================================
  async getFormAssignment(id: string): Promise<Record<string, any> | undefined> {
    const doc = await this.col("formAssignments").doc(id).get();
    return docToRecord(doc);
  }

  async getFormAssignmentsByUser(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("formAssignments").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  async createFormAssignment(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, status: data.status ?? "pending", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await this.col("formAssignments").doc(id).set(cleanData);
    await this.incrementCounter("formAssignments");
    const created = await this.col("formAssignments").doc(id).get();
    return docToRecord(created)!;
  }

  async updateFormAssignment(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("formAssignments").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  // =========================================================================
  // FORM TEMPLATES
  // =========================================================================
  async getFormTemplates(): Promise<Record<string, any>[]> {
    const snap = await this.col("formTemplates").get();
    return docsToRecords(snap);
  }

  async createFormTemplate(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("formTemplates").doc(id).set(cleanData);
    await this.incrementCounter("formTemplates");
    const created = await this.col("formTemplates").doc(id).get();
    return docToRecord(created)!;
  }

  // =========================================================================
  // FORM TYPES
  // =========================================================================
  async getFormTypes(): Promise<Record<string, any>[]> {
    const snap = await this.col("formTypes").get();
    return docsToRecords(snap);
  }

  async createFormType(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("formTypes").doc(id).set(cleanData);
    await this.incrementCounter("formTypes");
    const created = await this.col("formTypes").doc(id).get();
    return docToRecord(created)!;
  }

  // =========================================================================
  // WORKFLOW INSTANCES
  // =========================================================================
  async getWorkflowInstance(id: string): Promise<Record<string, any> | undefined> {
    const doc = await this.col("workflowInstances").doc(id).get();
    return docToRecord(doc);
  }

  async getWorkflowInstancesByUser(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("workflowInstances").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  async createWorkflowInstance(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, status: data.status ?? "active", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await this.col("workflowInstances").doc(id).set(cleanData);
    await this.incrementCounter("workflowInstances");
    const created = await this.col("workflowInstances").doc(id).get();
    return docToRecord(created)!;
  }

  async updateWorkflowInstance(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("workflowInstances").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  // =========================================================================
  // AGENT QUEUE
  // =========================================================================
  async getAgentQueue(): Promise<Record<string, any>[]> {
    const snap = await this.col("agentQueue").where("status", "==", "pending").get();
    return docsToRecords(snap);
  }

  async getAgentQueueByAgent(agentFirebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("agentQueue").where("agentFirebaseUid", "==", agentFirebaseUid).get();
    return docsToRecords(snap);
  }

  async createAgentQueueEntry(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, status: data.status ?? "pending", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await this.col("agentQueue").doc(id).set(cleanData);
    await this.incrementCounter("agentQueue");
    const created = await this.col("agentQueue").doc(id).get();
    return docToRecord(created)!;
  }

  async updateAgentQueueEntry(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("agentQueue").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  // =========================================================================
  // AGENT CLOCK RECORDS
  // =========================================================================
  async getAgentClockStatus(agentFirebaseUid: string): Promise<Record<string, any> | undefined> {
    const snap = await this.col("agentClockRecords")
      .where("agentFirebaseUid", "==", agentFirebaseUid)
      .where("clockOutTime", "==", null)
      .limit(1).get();
    if (snap.empty) return undefined;
    return docsToRecords(snap)[0];
  }

  async getAgentClockRecords(agentFirebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("agentClockRecords").where("agentFirebaseUid", "==", agentFirebaseUid).get();
    const results = docsToRecords(snap);
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAgentClockRecord(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("agentClockRecords").doc(id).set(cleanData);
    await this.incrementCounter("agentClockRecords");
    const created = await this.col("agentClockRecords").doc(id).get();
    return docToRecord(created)!;
  }

  async updateAgentClockRecord(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("agentClockRecords").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  // =========================================================================
  // BULLETIN
  // =========================================================================
  async getBulletins(): Promise<Record<string, any>[]> {
    const snap = await this.col("bulletin").orderBy("createdAt", "desc").get();
    return docsToRecords(snap);
  }

  async createBulletin(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, isActive: data.isActive ?? true, createdAt: FieldValue.serverTimestamp() });
    await this.col("bulletin").doc(id).set(cleanData);
    await this.incrementCounter("bulletin");
    const created = await this.col("bulletin").doc(id).get();
    return docToRecord(created)!;
  }

  async updateBulletin(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("bulletin").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  async deleteBulletin(id: string): Promise<boolean> {
    const ref = this.col("bulletin").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    await this.incrementCounter("bulletin", -1);
    return true;
  }

  // =========================================================================
  // APPLICATION STATUS
  // =========================================================================
  async getApplicationStatus(firebaseUid: string): Promise<Record<string, any> | undefined> {
    const doc = await this.col("applicationStatus").doc(firebaseUid).get();
    return docToRecord(doc);
  }

  async createApplicationStatus(data: Record<string, any>): Promise<Record<string, any>> {
    const uid = data.firebaseUid;
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await this.col("applicationStatus").doc(uid).set(cleanData);
    await this.incrementCounter("applicationStatus");
    const created = await this.col("applicationStatus").doc(uid).get();
    return docToRecord(created)!;
  }

  async updateApplicationStatus(firebaseUid: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("applicationStatus").doc(firebaseUid);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  // =========================================================================
  // STEP DATA
  // =========================================================================
  async getStepData(firebaseUid: string): Promise<Record<string, any> | undefined> {
    const doc = await this.col("stepData").doc(firebaseUid).get();
    return docToRecord(doc);
  }

  async updateStepData(firebaseUid: string, data: Record<string, any>): Promise<Record<string, any>> {
    const ref = this.col("stepData").doc(firebaseUid);
    const existing = await ref.get();
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    if (existing.exists) {
      await ref.update(updateData);
    } else {
      await ref.set({ ...updateData, firebaseUid, createdAt: FieldValue.serverTimestamp() });
      await this.incrementCounter("stepData");
    }
    const updated = await ref.get();
    return docToRecord(updated)!;
  }

  // =========================================================================
  // PROFILE NOTES
  // =========================================================================
  async getProfileNotes(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("profileNotes").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  async createProfileNote(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("profileNotes").doc(id).set(cleanData);
    await this.incrementCounter("profileNotes");
    const created = await this.col("profileNotes").doc(id).get();
    return docToRecord(created)!;
  }

  // =========================================================================
  // PUSH SUBSCRIPTIONS
  // =========================================================================
  async getPushSubscriptions(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("pushSubscriptions").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  async createPushSubscription(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("pushSubscriptions").doc(id).set(cleanData);
    await this.incrementCounter("pushSubscriptions");
    const created = await this.col("pushSubscriptions").doc(id).get();
    return docToRecord(created)!;
  }

  async deletePushSubscription(id: string): Promise<boolean> {
    const ref = this.col("pushSubscriptions").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    await this.incrementCounter("pushSubscriptions", -1);
    return true;
  }

  // =========================================================================
  // BLOG POSTS
  // =========================================================================
  async getBlogPosts(): Promise<Record<string, any>[]> {
    const snap = await this.col("blogPosts").orderBy("createdAt", "desc").get();
    return docsToRecords(snap);
  }

  async createBlogPost(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, isPublished: data.isPublished ?? false, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await this.col("blogPosts").doc(id).set(cleanData);
    await this.incrementCounter("blogPosts");
    const created = await this.col("blogPosts").doc(id).get();
    return docToRecord(created)!;
  }

  async updateBlogPost(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("blogPosts").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const ref = this.col("blogPosts").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    await this.incrementCounter("blogPosts", -1);
    return true;
  }

  // =========================================================================
  // CHARGEBACKS
  // =========================================================================
  async getChargebacks(): Promise<Record<string, any>[]> {
    const snap = await this.col("chargebacks").orderBy("createdAt", "desc").get();
    return docsToRecords(snap);
  }

  async createChargeback(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, status: data.status ?? "pending", createdAt: FieldValue.serverTimestamp() });
    await this.col("chargebacks").doc(id).set(cleanData);
    await this.incrementCounter("chargebacks");
    const created = await this.col("chargebacks").doc(id).get();
    return docToRecord(created)!;
  }

  async updateChargeback(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const ref = this.col("chargebacks").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return undefined;
    await ref.update(cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return docToRecord(updated);
  }

  // =========================================================================
  // REFERRAL CODE HISTORY
  // =========================================================================
  async getReferralCodeHistory(agentFirebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("referralCodeHistory").where("agentFirebaseUid", "==", agentFirebaseUid).get();
    return docsToRecords(snap);
  }

  async createReferralCodeHistory(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("referralCodeHistory").doc(id).set(cleanData);
    await this.incrementCounter("referralCodeHistory");
    const created = await this.col("referralCodeHistory").doc(id).get();
    return docToRecord(created)!;
  }

  // =========================================================================
  // REFERRAL REGISTRATIONS
  // =========================================================================
  async getReferralRegistrations(agentFirebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("referralRegistrations").where("agentFirebaseUid", "==", agentFirebaseUid).get();
    return docsToRecords(snap);
  }

  async createReferralRegistration(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("referralRegistrations").doc(id).set(cleanData);
    await this.incrementCounter("referralRegistrations");
    const created = await this.col("referralRegistrations").doc(id).get();
    return docToRecord(created)!;
  }

  // =========================================================================
  // SYSTEM REFERRAL CODES
  // =========================================================================
  async getSystemReferralCodes(): Promise<Record<string, any>[]> {
    const snap = await this.col("systemReferralCodes").get();
    return docsToRecords(snap);
  }

  async createSystemReferralCode(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, isActive: data.isActive ?? true, createdAt: FieldValue.serverTimestamp() });
    await this.col("systemReferralCodes").doc(id).set(cleanData);
    await this.incrementCounter("systemReferralCodes");
    const created = await this.col("systemReferralCodes").doc(id).get();
    return docToRecord(created)!;
  }

  // =========================================================================
  // TERMS OF SERVICE
  // =========================================================================
  async getTermsOfService(): Promise<Record<string, any> | undefined> {
    const doc = await this.col("termsOfService").doc("current").get();
    return docToRecord(doc);
  }

  async updateTermsOfService(data: Record<string, any>): Promise<Record<string, any>> {
    const ref = this.col("termsOfService").doc("current");
    const existing = await ref.get();
    const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    if (existing.exists) {
      await ref.update(updateData);
    } else {
      await ref.set({ ...updateData, createdAt: FieldValue.serverTimestamp() });
    }
    const updated = await ref.get();
    return docToRecord(updated)!;
  }

  // =========================================================================
  // TERMS ACCEPTANCES
  // =========================================================================
  async getTermsAcceptances(firebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("termsAcceptances").where("firebaseUid", "==", firebaseUid).get();
    return docsToRecords(snap);
  }

  async createTermsAcceptance(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("termsAcceptances").doc(id).set(cleanData);
    await this.incrementCounter("termsAcceptances");
    const created = await this.col("termsAcceptances").doc(id).get();
    return docToRecord(created)!;
  }

  // =========================================================================
  // AGENT DOCUMENTS
  // =========================================================================
  async getAgentDocuments(agentFirebaseUid: string): Promise<Record<string, any>[]> {
    const snap = await this.col("agentDocuments").where("agentFirebaseUid", "==", agentFirebaseUid).get();
    return docsToRecords(snap);
  }

  async createAgentDocument(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("agentDocuments").doc(id).set(cleanData);
    await this.incrementCounter("agentDocuments");
    const created = await this.col("agentDocuments").doc(id).get();
    return docToRecord(created)!;
  }

  async getDoctorProfile(doctorId: string): Promise<Record<string, any> | undefined> {
    const doc = await this.col("doctorProfiles").doc(doctorId).get();
    return docToRecord(doc);
  }

  async getDoctorProfileByUserId(userId: string): Promise<Record<string, any> | undefined> {
    const snap = await this.col("doctorProfiles").where("userId", "==", userId).limit(1).get();
    if (snap.empty) return undefined;
    return docToRecord(snap.docs[0]);
  }

  async getAllDoctorProfiles(): Promise<Record<string, any>[]> {
    const snap = await this.col("doctorProfiles").get();
    return docsToRecords(snap);
  }

  async createDoctorProfile(data: Record<string, any>): Promise<Record<string, any>> {
    const id = data.userId || randomUUID();
    const cleanData = cleanForFirestore({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.col("doctorProfiles").doc(id).set(cleanData);
    await this.incrementCounter("doctorProfiles");
    const created = await this.col("doctorProfiles").doc(id).get();
    return docToRecord(created)!;
  }

  async updateDoctorProfile(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const cleanData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    await this.col("doctorProfiles").doc(id).update(cleanData);
    const updated = await this.col("doctorProfiles").doc(id).get();
    return docToRecord(updated);
  }

  async getAutoMessageTriggers(packageId: string): Promise<Record<string, any>[]> {
    const snap = await this.col("autoMessageTriggers").where("packageId", "==", packageId).get();
    return docsToRecords(snap);
  }

  async createAutoMessageTrigger(data: Record<string, any>): Promise<Record<string, any>> {
    const id = randomUUID();
    const cleanData = cleanForFirestore({ ...data, createdAt: FieldValue.serverTimestamp() });
    await this.col("autoMessageTriggers").doc(id).set(cleanData);
    await this.incrementCounter("autoMessageTriggers");
    const created = await this.col("autoMessageTriggers").doc(id).get();
    return docToRecord(created)!;
  }

  async updateAutoMessageTrigger(id: string, data: Record<string, any>): Promise<Record<string, any> | undefined> {
    const cleanData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
    await this.col("autoMessageTriggers").doc(id).update(cleanData);
    const updated = await this.col("autoMessageTriggers").doc(id).get();
    return docToRecord(updated);
  }

  async deleteAutoMessageTrigger(id: string): Promise<boolean> {
    await this.col("autoMessageTriggers").doc(id).delete();
    return true;
  }
}

export const storage = new FirestoreStorage();
