"use strict";

require("dotenv").config({ path: require("node:path").resolve(__dirname, "..", ".env") });

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { loginSchema, registrationSchema } = require("./auth-validation");
const { migrate, pool } = require("./db");

const app = express();
const publicRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3000);
const sessionCookieName = "mulalink_session";
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const termsVersion = "2026-10-15-draft";
const adminCredentials = {
  fullName: "Kelvin Munyao",
  username: "adminkevo",
  email: process.env.ADMIN_EMAIL || "kevox122@gmail.com",
  phone: process.env.ADMIN_PHONE || "+2547117214196",
  password: process.env.ADMIN_PASSWORD || "matheka12203",
  role: "admin"
};
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString("base64url"), 12);

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "same-origin" }
}));
app.use(express.json({ limit: "12kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "12kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please wait 15 minutes and try again." }
});

const sha256 = token => crypto.createHash("sha256").update(token).digest("hex");
const publicUser = row => ({
  id: row.id,
  fullName: row.full_name,
  username: row.username || null,
  personalReferralCode: row.personal_referral_code,
  email: row.email,
  phone: row.phone,
  role: row.role || "user",
  accountStatus: row.account_status,
  createdAt: row.created_at
});
const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: sessionLifetimeMs
};

function readSessionToken(req) {
  const cookieHeader = req.get("Cookie") || "";
  const cookie = cookieHeader.split(";").map(value => value.trim()).find(value => value.startsWith(`${sessionCookieName}=`));
  return cookie ? cookie.slice(sessionCookieName.length + 1) : null;
}

function validationMessage(result) {
  return result.error.issues[0]?.message || "Please check the information you entered.";
}

function generateReferralCode() {
  return crypto.randomBytes(12).toString("hex").toUpperCase();
}

async function ensureAdminUser() {
  const adminResult = await pool.query(
    `SELECT id, full_name, username, personal_referral_code, email, phone, role, account_status, created_at, password_hash
     FROM users
     WHERE LOWER(email) = LOWER($1) OR phone = $2
     LIMIT 1`,
    [adminCredentials.email, adminCredentials.phone]
  );

  if (adminResult.rowCount) {
    const existingAdmin = adminResult.rows[0];
    if (existingAdmin.role !== "admin") {
      await pool.query(
        `UPDATE users
         SET role = 'admin', account_status = 'active', password_hash = $1, full_name = $2, username = $3, phone = $4, terms_version = $5, terms_accepted_at = NOW(), updated_at = NOW()
         WHERE id = $6`,
        [await bcrypt.hash(adminCredentials.password, 12), adminCredentials.fullName, adminCredentials.username, adminCredentials.phone, termsVersion, existingAdmin.id]
      );
      return { ...existingAdmin, role: "admin", account_status: "active" };
    }
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(adminCredentials.password, 12);
  const inserted = await pool.query(
    `INSERT INTO users
      (full_name, username, email, phone, password_hash, personal_referral_code, role, account_status, terms_version, terms_accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin', 'active', $7, NOW())
     RETURNING id, full_name, username, personal_referral_code, email, phone, role, account_status, created_at, password_hash`,
    [adminCredentials.fullName, adminCredentials.username, adminCredentials.email, adminCredentials.phone, passwordHash, generateReferralCode(), termsVersion]
  );
  return inserted.rows[0];
}

async function createSession(client, userId, res) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await client.query(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [sha256(rawToken), userId, expiresAt]
  );
  res.cookie(sessionCookieName, rawToken, sessionCookieOptions);
}

async function requireSession(req, res, next) {
  const token = readSessionToken(req);
  if (!token) return res.status(401).json({ error: "Please sign in to continue." });
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.personal_referral_code, u.email, u.phone, u.role, u.account_status, u.created_at
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [sha256(token)]
    );
    if (!result.rowCount) {
      res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    if (result.rows[0].account_status === "suspended" || result.rows[0].account_status === "restricted") {
      return res.status(403).json({ error: "This account is currently restricted. Contact support for assistance." });
    }
    if (result.rows[0].role !== "admin" && result.rows[0].account_status !== "active") {
      return res.status(403).json({ error: "Your account is awaiting administrator activation. You can access the dashboard after it is approved." });
    }
    req.user = result.rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Administrator access is required." });
  }
  return next();
}

function adminAudit(client, actorId, action, entityType, entityId, details) {
  return client.query(
    `INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorId, action, entityType, String(entityId), JSON.stringify(details)]
  );
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function sendFile(res, filename) {
  return res.sendFile(path.join(publicRoot, filename));
}

app.get("/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});
app.get("/", async (req, res, next) => {
  const token = readSessionToken(req);
  if (!token) return res.redirect("/login");
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.phone, u.role, u.account_status, u.created_at
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [sha256(token)]
    );
    if (!result.rowCount) {
      res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
      return res.redirect("/login");
    }
    if (result.rows[0].role === "admin") return res.redirect("/admin");
    if (result.rows[0].account_status !== "active") return res.redirect("/account-pending");
    return sendFile(res, "index.html").catch(next);
  } catch (error) {
    return next(error);
  }
});
app.get("/register", (_req, res, next) => sendFile(res, "register.html").catch(next));
app.get("/login", (_req, res, next) => sendFile(res, "login.html").catch(next));
app.get("/account-pending", (_req, res, next) => sendFile(res, "account-pending.html").catch(next));
app.get("/admin", requireSession, (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).send("Administrator access is required.");
  return sendFile(res, "admin.html").catch(next);
});
app.get("/terms", (_req, res, next) => sendFile(res, "terms.html").catch(next));
app.get("/privacy", (_req, res, next) => sendFile(res, "privacy.html").catch(next));
for (const filename of ["styles.css", "auth.css", "app.js", "auth.js", "admin.css", "admin.js", "pending.js"]) {
  app.get(`/${filename}`, (_req, res, next) => sendFile(res, filename).catch(next));
}

app.post("/api/auth/register", async (req, res, next) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed) });

  const input = parsed.data;
  const email = input.email.toLowerCase();
  const phone = input.phone.replace(/\s+/g, "");
  const referralCode = input.referralCode?.toUpperCase() || null;
  let client;
  try {
    if (referralCode) {
      const referrer = await pool.query(
        "SELECT id FROM users WHERE personal_referral_code = $1",
        [referralCode]
      );
      if (!referrer.rowCount) return res.status(400).json({ error: "The referral link is invalid. Check the link or sign up without it." });
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    client = await pool.connect();
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO users
        (full_name, username, email, phone, password_hash, personal_referral_code, referral_code, account_status, terms_version, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_verification', $8, NOW())
       RETURNING id, full_name, username, personal_referral_code, email, phone, account_status, created_at`,
      [input.fullName, input.username, email, phone, passwordHash, generateReferralCode(), referralCode, termsVersion]
    );
    await createSession(client, inserted.rows[0].id, res);
    await client.query("COMMIT");
    res.status(201).json({ user: publicUser(inserted.rows[0]) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Registration rollback failed:", rollbackError.message));
    if (error.code === "23505") return res.status(409).json({ error: "That username, email address, or phone number is already in use." });
    return next(error);
  } finally {
    client?.release();
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed) });
  const { identifier, password, role } = parsed.data;
  const requestedRole = role === "admin" ? "admin" : "user";
  const normalizedIdentifier = identifier.includes("@") ? identifier.toLowerCase() : identifier.replace(/\s+/g, "");
  let client;
  try {
    if (requestedRole === "admin") {
      await ensureAdminUser();
    }
    const result = await pool.query(
      `SELECT id, full_name, username, personal_referral_code, email, phone, role, account_status, created_at, password_hash
       FROM users
       WHERE (role = $1 OR role IS NULL) AND (LOWER(email) = $2 OR phone = $3)
       LIMIT 1`,
      [requestedRole, normalizedIdentifier, normalizedIdentifier]
    );
    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user?.password_hash || dummyPasswordHash);
    if (!user || !passwordMatches) return res.status(401).json({ error: "Email/phone or password is incorrect." });
    if (user.account_status === "suspended" || user.account_status === "restricted") {
      return res.status(403).json({ error: "This account is currently restricted. Contact support for assistance." });
    }

    if (requestedRole === "admin" && user.role !== "admin") {
      return res.status(401).json({ error: "Admin credentials are incorrect." });
    }

    client = await pool.connect();
    await client.query("BEGIN");
    await createSession(client, user.id, res);
    await client.query("COMMIT");
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Login rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.get("/api/auth/me", requireSession, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/admin/summary", requireSession, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'user') AS total_users,
         (SELECT COUNT(*) FROM users WHERE role = 'user' AND account_status = 'active') AS active_users,
         (SELECT COUNT(*) FROM admin_financial_records WHERE status = 'pending') AS pending_records,
         (SELECT COUNT(*) FROM admin_financial_records WHERE status = 'approved') AS approved_records,
         COALESCE((
           SELECT JSONB_AGG(JSONB_BUILD_OBJECT('type', totals.record_type, 'currency', totals.currency, 'amount', totals.amount))
           FROM (
             SELECT record_type, currency, SUM(amount) AS amount
             FROM admin_financial_records
             WHERE status = 'approved'
             GROUP BY record_type, currency
           ) totals
         ), '[]'::jsonb) AS approved_totals`
    );
    return res.json({ summary: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/users", requireSession, requireAdmin, async (req, res, next) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  try {
    const result = await pool.query(
      `SELECT id, full_name, username, email, phone, account_status, created_at
       FROM users
       WHERE role = 'user'
         AND ($1 = '' OR POSITION(LOWER($1) IN LOWER(full_name)) > 0
           OR POSITION(LOWER($1) IN LOWER(COALESCE(username, ''))) > 0
           OR POSITION(LOWER($1) IN LOWER(email)) > 0
           OR POSITION(LOWER($1) IN phone) > 0)
       ORDER BY created_at DESC
       LIMIT 100`,
      [search]
    );
    return res.json({ users: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/admin/users/:id/status", requireSession, requireAdmin, async (req, res, next) => {
  const statuses = new Set(["pending_verification", "active", "suspended", "restricted"]);
  const status = req.body?.status;
  if (!statuses.has(status)) return res.status(400).json({ error: "Choose a valid account status." });
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "Member account ID is invalid." });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE users
       SET account_status = $1, updated_at = NOW()
       WHERE id = $2 AND role = 'user'
       RETURNING id, full_name, username, email, phone, account_status, created_at`,
      [status, req.params.id]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Member account not found." });
    }
    await adminAudit(client, req.user.id, "user.status_changed", "user", updated.rows[0].id, { status });
    await client.query("COMMIT");
    return res.json({ user: updated.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Admin status rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.get("/api/admin/financial-records", requireSession, requireAdmin, async (req, res, next) => {
  const allowedTypes = new Set(["payment", "payout", "commission", "transaction"]);
  const allowedStatuses = new Set(["pending", "approved", "rejected"]);
  const type = String(req.query.type || "");
  const status = String(req.query.status || "");
  if ((type && !allowedTypes.has(type)) || (status && !allowedStatuses.has(status))) {
    return res.status(400).json({ error: "Choose a valid record type or status filter." });
  }
  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id, u.full_name AS user_name, u.email AS user_email,
              r.record_type, r.amount, r.currency, r.status, r.reference,
              r.description, r.reviewed_by, r.created_at, r.updated_at
       FROM admin_financial_records r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE ($1 = '' OR r.record_type = $1)
         AND ($2 = '' OR r.status = $2)
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [type, status]
    );
    return res.json({ records: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/financial-records", requireSession, requireAdmin, async (req, res, next) => {
  const { userId = null, type, amount, currency = "KES", description = "" } = req.body || {};
  const allowedTypes = new Set(["payment", "payout", "commission", "transaction"]);
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  const normalizedCurrency = typeof currency === "string" ? currency.toUpperCase() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  const hasValidPrecision = Math.abs(numericAmount * 100 - Math.round(numericAmount * 100)) <= 1e-7;
  if (!allowedTypes.has(type) || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100_000_000 || !hasValidPrecision) {
    return res.status(400).json({ error: "Choose a valid record type and an amount up to 100,000,000 with no more than two decimal places." });
  }
  if ((userId !== null && !isUuid(userId)) || typeof description !== "string" || !/^[A-Z]{3}$/.test(normalizedCurrency) || normalizedDescription.length > 500) {
    return res.status(400).json({ error: "Member ID, currency, or description is invalid." });
  }

  const reference = `ML-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (userId) {
      const member = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'user'", [userId]);
      if (!member.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Member account not found." });
      }
    }
    const inserted = await client.query(
      `INSERT INTO admin_financial_records (user_id, record_type, amount, currency, reference, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, record_type, amount, currency, status, reference, description, created_at, updated_at`,
      [userId, type, numericAmount, normalizedCurrency, reference, normalizedDescription]
    );
    await adminAudit(client, req.user.id, "financial_record.created", "financial_record", inserted.rows[0].id, {
      type,
      amount: numericAmount,
      currency: normalizedCurrency,
      status: "pending"
    });
    await client.query("COMMIT");
    return res.status(201).json({ record: inserted.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Financial record creation rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.patch("/api/admin/financial-records/:id/status", requireSession, requireAdmin, async (req, res, next) => {
  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "A pending record can only be approved or rejected." });
  }
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "Financial record ID is invalid." });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE admin_financial_records
       SET status = $1, reviewed_by = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING id, user_id, record_type, amount, currency, status, reference, description, reviewed_by, created_at, updated_at`,
      [status, req.user.id, req.params.id]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pending financial record not found." });
    }
    await adminAudit(client, req.user.id, `financial_record.${status}`, "financial_record", updated.rows[0].id, { status });
    await client.query("COMMIT");
    return res.json({ record: updated.rows[0], internalOnly: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Financial record review rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.get("/api/admin/tasks", requireSession, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, price, currency, status, created_at, updated_at
       FROM admin_tasks
       ORDER BY created_at DESC
       LIMIT 200`
    );
    return res.json({ tasks: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/tasks", requireSession, requireAdmin, async (req, res, next) => {
  const { title, description = "", price, currency = "KES", status = "active" } = req.body || {};
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  const normalizedCurrency = typeof currency === "string" ? currency.toUpperCase() : "";
  const numericPrice = typeof price === "number" ? price : Number(price);
  const priceCents = Math.round(numericPrice * 100);
  if (!normalizedTitle || normalizedTitle.length > 120 || typeof description !== "string" || normalizedDescription.length > 1000) {
    return res.status(400).json({ error: "Enter a task title (up to 120 characters) and description (up to 1,000 characters)." });
  }
  if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100_000_000 || Math.abs(numericPrice * 100 - priceCents) > 1e-7) {
    return res.status(400).json({ error: "Task price must be positive, up to 100,000,000, with no more than two decimal places." });
  }
  if (!/^[A-Z]{3}$/.test(normalizedCurrency) || !["active", "inactive"].includes(status)) {
    return res.status(400).json({ error: "Choose a valid three-letter currency and task status." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO admin_tasks (title, description, price, currency, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, price, currency, status, created_at, updated_at`,
      [normalizedTitle, normalizedDescription, priceCents / 100, normalizedCurrency, status, req.user.id]
    );
    await adminAudit(client, req.user.id, "task.created", "task", inserted.rows[0].id, {
      title: normalizedTitle,
      price: priceCents / 100,
      currency: normalizedCurrency,
      status
    });
    await client.query("COMMIT");
    return res.status(201).json({ task: inserted.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Task creation rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.patch("/api/admin/tasks/:id", requireSession, requireAdmin, async (req, res, next) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "Task ID is invalid." });
  const { title, description = "", price, currency = "KES", status } = req.body || {};
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  const normalizedCurrency = typeof currency === "string" ? currency.toUpperCase() : "";
  const numericPrice = typeof price === "number" ? price : Number(price);
  const priceCents = Math.round(numericPrice * 100);
  if (!normalizedTitle || normalizedTitle.length > 120 || typeof description !== "string" || normalizedDescription.length > 1000) {
    return res.status(400).json({ error: "Enter a task title (up to 120 characters) and description (up to 1,000 characters)." });
  }
  if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100_000_000 || Math.abs(numericPrice * 100 - priceCents) > 1e-7) {
    return res.status(400).json({ error: "Task price must be positive, up to 100,000,000, with no more than two decimal places." });
  }
  if (!/^[A-Z]{3}$/.test(normalizedCurrency) || !["active", "inactive"].includes(status)) {
    return res.status(400).json({ error: "Choose a valid three-letter currency and task status." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE admin_tasks
       SET title = $1, description = $2, price = $3, currency = $4, status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, title, description, price, currency, status, created_at, updated_at`,
      [normalizedTitle, normalizedDescription, priceCents / 100, normalizedCurrency, status, req.params.id]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found." });
    }
    await adminAudit(client, req.user.id, "task.updated", "task", updated.rows[0].id, {
      title: normalizedTitle,
      price: priceCents / 100,
      currency: normalizedCurrency,
      status
    });
    await client.query("COMMIT");
    return res.json({ task: updated.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Task update rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.get("/api/admin/purchases", requireSession, requireAdmin, async (req, res, next) => {
  const allowedStatuses = new Set(["pending", "recorded", "cancelled"]);
  const status = String(req.query.status || "");
  if (status && !allowedStatuses.has(status)) return res.status(400).json({ error: "Choose a valid purchase status filter." });
  try {
    const result = await pool.query(
      `SELECT p.id, p.reference, p.user_id, u.full_name AS client_name, u.email AS client_email,
              p.task_id, p.task_title, p.quantity, p.unit_price, p.total_amount, p.currency,
              p.status, p.recorded_by, p.created_at, p.updated_at
       FROM admin_client_purchases p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE ($1 = '' OR p.status = $1)
       ORDER BY p.created_at DESC
       LIMIT 300`,
      [status]
    );
    return res.json({ purchases: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/purchases", requireSession, requireAdmin, async (req, res, next) => {
  const { userId, taskId, quantity } = req.body || {};
  if (!isUuid(userId) || !isUuid(taskId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
    return res.status(400).json({ error: "Select a client and active task, and enter a quantity from 1 to 10,000." });
  }
  const reference = `BUY-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const member = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'user'", [userId]);
    const task = await client.query("SELECT id, title, price, currency FROM admin_tasks WHERE id = $1 AND status = 'active'", [taskId]);
    if (!member.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Client account not found." });
    }
    if (!task.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Active task not found. Refresh the task list and try again." });
    }
    const taskRow = task.rows[0];
    const unitPriceCents = Math.round(Number(taskRow.price) * 100);
    const totalCents = unitPriceCents * quantity;
    if (!Number.isSafeInteger(totalCents) || totalCents < 1 || totalCents > 10_000_000_000) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This quantity exceeds the maximum recorded purchase total." });
    }
    const inserted = await client.query(
      `INSERT INTO admin_client_purchases
         (reference, user_id, task_id, task_title, quantity, unit_price, total_amount, currency, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, reference, user_id, task_id, task_title, quantity, unit_price, total_amount, currency, status, recorded_by, created_at, updated_at`,
      [reference, userId, taskId, taskRow.title, quantity, unitPriceCents / 100, totalCents / 100, taskRow.currency, req.user.id]
    );
    await adminAudit(client, req.user.id, "purchase.created", "purchase", inserted.rows[0].id, {
      reference,
      userId,
      taskId,
      quantity,
      total: totalCents / 100,
      currency: taskRow.currency
    });
    await client.query("COMMIT");
    return res.status(201).json({ purchase: inserted.rows[0], internalOnly: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Purchase creation rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.patch("/api/admin/purchases/:id/status", requireSession, requireAdmin, async (req, res, next) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "Purchase ID is invalid." });
  const status = req.body?.status;
  if (!["recorded", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "A pending purchase can only be recorded or cancelled." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE admin_client_purchases
       SET status = $1, recorded_by = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING id, reference, user_id, task_id, task_title, quantity, unit_price, total_amount, currency, status, recorded_by, created_at, updated_at`,
      [status, req.user.id, req.params.id]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pending client purchase not found." });
    }
    await adminAudit(client, req.user.id, `purchase.${status}`, "purchase", updated.rows[0].id, { status });
    await client.query("COMMIT");
    return res.json({ purchase: updated.rows[0], internalOnly: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(rollbackError => console.error("Purchase status rollback failed:", rollbackError.message));
    return next(error);
  } finally {
    client?.release();
  }
});

app.get("/api/admin/audit-log", requireSession, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.actor_id, u.full_name AS actor_name, a.action, a.entity_type,
              a.entity_id, a.details, a.created_at
       FROM admin_audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );
    return res.json({ entries: result.rows });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  const token = readSessionToken(req);
  try {
    if (token) await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [sha256(token)]);
    res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API endpoint not found." });
  return res.status(404).send("Page not found.");
});

app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must contain valid JSON." });
  console.error("Unhandled request error:", error.message);
  if (res.headersSent) return;
  res.status(500).json({ error: "The server could not complete your request. Please try again." });
});

async function start() {
  await pool.query("SELECT 1");
  await migrate();
  await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`MULALINK running at http://localhost:${port}`);
  });
  const shutdown = signal => {
    console.log(`${signal} received; shutting down.`);
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

if (require.main === module) {
  start().catch(error => {
    console.error("Could not start MULALINK:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, start };
