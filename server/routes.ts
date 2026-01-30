import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { defaultConfig } from "@shared/config";

// Session augmentation
declare module "express-session" {
  interface SessionData {
    userId: string;
    userLevel: number;
  }
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function requireLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.userLevel) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (req.session.userLevel < minLevel) {
      res.status(403).json({ message: "Forbidden - Insufficient permissions" });
      return;
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // ===========================================================================
  // AUTH ROUTES
  // ===========================================================================

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, referralCode } = req.body;

      if (!email || !password || !firstName || !lastName) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ message: "Email already registered" });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Generate unique profile ID and referral code
      const profileId = randomBytes(4).toString("hex").toUpperCase();
      const userReferralCode = randomBytes(4).toString("hex").toUpperCase();

      // Check for referral
      let referredByUserId: string | undefined;
      if (referralCode) {
        const referrer = await storage.getUserByReferralCode(referralCode);
        if (referrer) {
          referredByUserId = referrer.id;
        }
      }

      // Create user
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        userLevel: 1, // Default to applicant
        profileId,
        referralCode: userReferralCode,
        referredByUserId,
        isActive: true,
      });

      // Create session
      req.session.userId = user.id;
      req.session.userLevel = user.userLevel;

      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "user_registered",
        entityType: "user",
        entityId: user.id,
        details: { referredBy: referralCode || null },
      });

      res.json({
        user: {
          ...user,
          passwordHash: undefined,
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ message: "Email and password required" });
        return;
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({ message: "Account is deactivated" });
        return;
      }

      // Create session
      req.session.userId = user.id;
      req.session.userLevel = user.userLevel;

      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "user_login",
        entityType: "user",
        entityId: user.id,
      });

      res.json({
        user: {
          ...user,
          passwordHash: undefined,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ message: "Logout failed" });
        return;
      }
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ message: "User not found" });
      return;
    }

    res.json({
      user: {
        ...user,
        passwordHash: undefined,
      },
    });
  });

  // ===========================================================================
  // CONFIG ROUTES
  // ===========================================================================

  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getSiteConfig();
      if (config) {
        res.json({
          siteName: config.siteName,
          tagline: config.tagline,
          description: config.description,
          logoUrl: config.logoUrl,
          faviconUrl: config.faviconUrl,
          primaryColor: config.primaryColor,
          contactEmail: config.contactEmail,
          contactPhone: config.contactPhone,
          address: config.address,
          levelNames: {
            level1: config.level1Name,
            level2: config.level2Name,
            level3: config.level3Name,
            level4: config.level4Name,
            level5: config.level5Name,
          },
          workflowSteps: defaultConfig.workflowSteps,
          features: defaultConfig.features,
        });
      } else {
        res.json(defaultConfig);
      }
    } catch (error) {
      res.json(defaultConfig);
    }
  });

  // ===========================================================================
  // PACKAGE ROUTES
  // ===========================================================================

  app.get("/api/packages", async (req, res) => {
    try {
      const packages = await storage.getActivePackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/packages/:id", async (req, res) => {
    try {
      const pkg = await storage.getPackage(req.params.id);
      if (!pkg) {
        res.status(404).json({ message: "Package not found" });
        return;
      }
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // APPLICATION ROUTES (Authenticated)
  // ===========================================================================

  app.get("/api/applications", requireAuth, async (req, res) => {
    try {
      const applications = await storage.getApplicationsByUser(req.session.userId!);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/applications/:id", requireAuth, async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      // Check ownership or admin access
      if (application.userId !== req.session.userId && req.session.userLevel! < 4) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      res.json(application);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/applications", requireAuth, async (req, res) => {
    try {
      const { packageId, formData } = req.body;

      const pkg = await storage.getPackage(packageId);
      if (!pkg) {
        res.status(400).json({ message: "Invalid package" });
        return;
      }

      const workflowSteps = (pkg.workflowSteps as string[]) || defaultConfig.workflowSteps;

      const application = await storage.createApplication({
        userId: req.session.userId!,
        packageId,
        currentStep: 1,
        totalSteps: workflowSteps.length,
        status: "pending",
        formData: formData || {},
        paymentStatus: "unpaid",
        paymentAmount: pkg.price,
      });

      // Create workflow steps
      for (let i = 0; i < workflowSteps.length; i++) {
        await storage.createApplicationStep({
          applicationId: application.id,
          stepNumber: i + 1,
          name: workflowSteps[i],
          status: i === 0 ? "in-progress" : "pending",
        });
      }

      res.json(application);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // QUEUE ROUTES (Call Queue System)
  // ===========================================================================

  // Get all waiting queue entries (for Level 2+ reviewers)
  app.get("/api/queue", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entries = await storage.getWaitingQueueEntries();
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get queue stats for Level 2 dashboard
  app.get("/api/queue/stats", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const waiting = await storage.getWaitingQueueEntries();
      const myActive = await storage.getQueueEntriesByReviewer(req.session.userId!);
      const inCall = myActive.filter(e => e.status === "in_call");
      const completedToday = myActive.filter(e => {
        if (!e.completedAt) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(e.completedAt) >= today;
      });
      res.json({
        waitingCount: waiting.length,
        inCallCount: inCall.length,
        completedTodayCount: completedToday.length,
        waiting,
        inCall,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 1: Join the call queue
  app.post("/api/queue/join", requireAuth, async (req, res) => {
    try {
      const { packageId, applicationId, phone } = req.body;
      
      // Check if user already in queue
      const existing = await storage.getWaitingQueueEntries();
      const alreadyInQueue = existing.find(e => e.applicantId === req.session.userId && e.status === "waiting");
      if (alreadyInQueue) {
        res.status(400).json({ message: "You are already in the queue", queueEntry: alreadyInQueue });
        return;
      }

      // Calculate position
      const position = existing.length + 1;

      const entry = await storage.createQueueEntry({
        applicantId: req.session.userId!,
        packageId,
        applicationId,
        applicantPhone: phone,
        queueType: "consultation",
        status: "waiting",
        position,
        priority: 0,
      });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 1: Check my queue status
  app.get("/api/queue/my-status", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getWaitingQueueEntries();
      const myEntry = entries.find(e => e.applicantId === req.session.userId);
      if (!myEntry) {
        res.json({ inQueue: false });
        return;
      }
      const position = entries.filter(e => e.createdAt <= myEntry.createdAt && e.status === "waiting").length;
      res.json({ inQueue: true, position, entry: myEntry });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 1: Leave the queue
  app.post("/api/queue/leave", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getWaitingQueueEntries();
      const myEntry = entries.find(e => e.applicantId === req.session.userId && e.status === "waiting");
      if (!myEntry) {
        res.status(404).json({ message: "Not in queue" });
        return;
      }
      await storage.updateQueueEntry(myEntry.id, { status: "cancelled" });
      res.json({ message: "Left the queue" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Claim a caller from the queue
  app.post("/api/queue/:id/claim", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.status !== "waiting") {
        res.status(400).json({ message: "This caller has already been claimed" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id, {
        reviewerId: req.session.userId!,
        status: "claimed",
        claimedAt: new Date(),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Start call with claimed caller
  app.post("/api/queue/:id/start-call", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.session.userId) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      
      // Here is where Twilio/GHL integration would generate a call
      // For now, just update status
      const updated = await storage.updateQueueEntry(req.params.id, {
        status: "in_call",
        callStartedAt: new Date(),
        // roomId would be set here when Twilio/GHL is integrated
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Complete a call
  app.post("/api/queue/:id/complete", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const { notes, outcome } = req.body;
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.session.userId) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id, {
        status: "completed",
        callEndedAt: new Date(),
        completedAt: new Date(),
        notes,
        outcome,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Release a claimed caller back to queue
  app.post("/api/queue/:id/release", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.session.userId) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id, {
        reviewerId: null,
        status: "waiting",
        claimedAt: null,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // COMMISSION ROUTES
  // ===========================================================================

  app.get("/api/commissions", requireAuth, async (req, res) => {
    try {
      if (req.session.userLevel! >= 4) {
        const commissions = await storage.getAllCommissions();
        res.json(commissions);
      } else {
        const commissions = await storage.getCommissionsByAgent(req.session.userId!);
        res.json(commissions);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // ADMIN ROUTES
  // ===========================================================================

  app.get("/api/admin/users", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map((u) => ({ ...u, passwordHash: undefined })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/applications", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const applications = await storage.getAllApplications();
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/payments", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/commissions", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const commissions = await storage.getAllCommissions();
      res.json(commissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // OWNER ROUTES (Site Configuration)
  // ===========================================================================

  app.put("/api/owner/config", requireAuth, requireLevel(5), async (req, res) => {
    try {
      const {
        siteName,
        tagline,
        description,
        logoUrl,
        faviconUrl,
        primaryColor,
        contactEmail,
        contactPhone,
        address,
        level1Name,
        level2Name,
        level3Name,
        level4Name,
        level5Name,
      } = req.body;

      const config = await storage.updateSiteConfig({
        siteName,
        tagline,
        description,
        logoUrl,
        faviconUrl,
        primaryColor,
        contactEmail,
        contactPhone,
        address,
        level1Name,
        level2Name,
        level3Name,
        level4Name,
        level5Name,
      });

      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Package management for owner/admin
  app.post("/api/admin/packages", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const pkg = await storage.createPackage(req.body);
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/packages/:id", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const pkg = await storage.updatePackage(req.params.id, req.body);
      if (!pkg) {
        res.status(404).json({ message: "Package not found" });
        return;
      }
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/packages/:id", requireAuth, requireLevel(5), async (req, res) => {
    try {
      const success = await storage.deletePackage(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Package not found" });
        return;
      }
      res.json({ message: "Package deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User management
  app.put("/api/admin/users/:id", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const { userLevel, isActive } = req.body;
      const user = await storage.updateUser(req.params.id, { userLevel, isActive });
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
