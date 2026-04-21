import { randomBytes } from "crypto";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  sendVerificationEmail,
  sendParentConsentEmail,
} from "../../email";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please wait 15 minutes and try again." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many accounts created from this device. Please try again in an hour." },
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date of birth"),
  zipCode: z.string().regex(/^\d{5}$/, "Zip code must be 5 digits"),
  parentEmail: z.string().email("Invalid parent/guardian email").optional(),
});

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

function getBaseUrl(req: Express["request"]): string {
  return process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
}

export function registerAuthRoutes(app: Express): void {
  // ── Register ───────────────────────────────────────────────────────────────
  app.post("/api/auth/register", registerLimiter, async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const age = calculateAge(input.dateOfBirth);

      if (age < 13) {
        return res.status(400).json({ message: "CourtMatch is for players 13 and older" });
      }

      if (age < 18 && !input.parentEmail) {
        return res.status(400).json({
          message: "A parent/guardian email is required for players under 18",
          field: "parentEmail",
        });
      }

      if (input.parentEmail && input.parentEmail.toLowerCase() === input.email.toLowerCase()) {
        return res.status(400).json({
          message: "Parent email must be different from the player's email address",
          field: "parentEmail",
        });
      }

      const existing = await authStorage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const emailEnabled = !!process.env.RESEND_API_KEY;

      // When email is not configured (e.g. local dev), skip verification and
      // activate accounts immediately so users can sign in right away.
      const initialStatus = emailEnabled ? "PENDING_EMAIL" : "ACTIVE";

      const user = await authStorage.createUser({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        zipCode: input.zipCode,
        parentEmail: input.parentEmail ?? null,
        accountStatus: initialStatus,
        guidelinesAcceptedAt: new Date(),
      });

      if (!emailEnabled) {
        // No email provider — account is active immediately.
        const { passwordHash: _, ...safeUser } = user;
        return res.status(201).json({ ...safeUser, needsEmailVerification: false });
      }

      // Generate email verification token (24h expiry)
      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await authStorage.setEmailVerificationToken(user.id, token, expiry);

      // Send verification email — await so we can surface failures to the user
      try {
        await sendVerificationEmail({
          toEmail: user.email,
          firstName: user.firstName ?? "there",
          verificationToken: token,
          baseUrl: getBaseUrl(req),
        });
      } catch (emailErr) {
        console.error("[auth] Failed to send verification email:", emailErr);
        // Email send failed after account was created — activate the account so
        // the user isn't permanently locked out.
        await authStorage.verifyEmail(user.id, "ACTIVE");
        const { passwordHash: _, ...safeUser } = user;
        return res.status(201).json({
          ...safeUser,
          needsEmailVerification: false,
          emailWarning: "We couldn't send a verification email, but your account is active. You can sign in now.",
        });
      }

      const { passwordHash: _, ...safeUser } = user;
      return res.status(201).json({ ...safeUser, needsEmailVerification: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Registration error:", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // ── Verify email ───────────────────────────────────────────────────────────
  app.get("/api/auth/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const user = await authStorage.getUserByEmailVerificationToken(token);

      if (!user) {
        return res.redirect("/auth?error=invalid-token");
      }

      if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
        return res.redirect("/auth?error=token-expired");
      }

      const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : 18;

      if (age < 18 && user.parentEmail) {
        // Email verified — now needs parent approval
        await authStorage.verifyEmail(user.id, "PENDING_PARENT");

        // Generate parent approval token and send consent email
        const parentToken = randomBytes(32).toString("hex");
        await authStorage.setParentApprovalToken(user.id, parentToken);

        sendParentConsentEmail({
          toEmail: user.parentEmail,
          playerFirstName: user.firstName ?? "Your child",
          parentApprovalToken: parentToken,
          baseUrl: getBaseUrl(req),
        });

        return res.redirect("/signup/success?type=parent");
      }

      // 18+ — activate immediately
      await authStorage.verifyEmail(user.id, "ACTIVE");
      return res.redirect("/signup/success?verified=1");
    } catch (err) {
      console.error("Email verification error:", err);
      return res.redirect("/auth?error=verification-failed");
    }
  });

  // ── Parent approval (called by frontend ParentApprovePage) ─────────────────
  app.post("/api/parent-approve/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const user = await authStorage.getUserByParentApprovalToken(token);

      if (!user) {
        return res.status(404).json({ message: "Invalid or expired approval link." });
      }

      if (user.accountStatus === "ACTIVE") {
        return res.json({ message: "Account is already active.", alreadyApproved: true });
      }

      await authStorage.approveAccount(user.id);
      return res.json({ message: "Account approved.", firstName: user.firstName });
    } catch (err) {
      console.error("Parent approval error:", err);
      return res.status(500).json({ message: "Approval failed. Please try again." });
    }
  });

  // ── Reminder cron (hit by a Render cron job every hour) ────────────────────
  // Protect with CRON_SECRET env var: set Authorization: Bearer <secret>
  app.post("/api/cron/parent-reminder", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${secret}`) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }

    try {
      const users = await authStorage.getUsersPendingParentReminder();
      const baseUrl = getBaseUrl(req);

      await Promise.all(
        users.map((user) => {
          if (!user.parentEmail || !user.parentApprovalToken) return;
          return sendParentConsentEmail({
            toEmail: user.parentEmail,
            playerFirstName: user.firstName ?? "Your child",
            parentApprovalToken: user.parentApprovalToken,
            baseUrl,
            isReminder: true,
          });
        })
      );

      return res.json({ sent: users.length });
    } catch (err) {
      console.error("Parent reminder cron error:", err);
      return res.status(500).json({ message: "Cron job failed" });
    }
  });

  // ── Login ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);

      const user = await authStorage.getUserByEmail(input.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.accountStatus === "PENDING_EMAIL") {
        // If email is not configured we can't verify — auto-activate and let them in.
        if (!process.env.RESEND_API_KEY) {
          await authStorage.verifyEmail(user.id, "ACTIVE");
        } else {
          return res.status(403).json({
            message: "Please verify your email address before signing in. Check your inbox for a verification link.",
          });
        }
      }

      if (user.accountStatus === "PENDING_PARENT" || user.accountStatus === "PENDING") {
        return res.status(403).json({
          message: "Your account is pending parent approval. Please ask your parent to check their email.",
        });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        (req.session as any).userId = user.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Session error" });
          }
          const { passwordHash: _, ...safeUser } = user;
          return res.json(safeUser);
        });
      });
      return;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[auth] Login error:", err instanceof Error ? err.message : err);
      return res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  // ── Get current user ───────────────────────────────────────────────────────
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await authStorage.getUser(userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { passwordHash: _, ...safeUser } = user;
      return res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
