"use strict";

process.env.DATABASE_URL ||= "postgresql://mulalink_test:mulalink_test@127.0.0.1:5432/mulalink_test";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { app } = require("./server");
const { pool } = require("./db");

const users = new Map();
const sessions = new Map();
const financialRecords = new Map();
const adminTasks = new Map();
const clientPurchases = new Map();
const auditEntries = [];
const originalQuery = pool.query;
const originalConnect = pool.connect;
let server;
let baseUrl;
let adminCookie;

function createFakeClient() {
  return {
    async query(sql, values = []) {
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT id FROM users WHERE id = $1 AND role = 'user'")) {
        const user = [...users.values()].find(row => row.id === values[0] && row.role === "user");
        return { rows: user ? [{ id: user.id }] : [], rowCount: user ? 1 : 0 };
      }
      if (sql.includes("SELECT id, title, price, currency FROM admin_tasks")) {
        const task = adminTasks.get(values[0]);
        const activeTask = task?.status === "active" ? task : null;
        return { rows: activeTask ? [{ id: activeTask.id, title: activeTask.title, price: activeTask.price, currency: activeTask.currency }] : [], rowCount: activeTask ? 1 : 0 };
      }
      if (sql.includes("INSERT INTO admin_tasks")) {
        const [title, description, price, currency, status, createdBy] = values;
        const task = { id: crypto.randomUUID(), title, description, price: String(price), currency, status, created_by: createdBy, created_at: new Date(), updated_at: new Date() };
        adminTasks.set(task.id, task);
        return { rows: [task], rowCount: 1 };
      }
      if (sql.includes("UPDATE admin_tasks")) {
        const [title, description, price, currency, status, taskId] = values;
        const task = adminTasks.get(taskId);
        if (!task) return { rows: [], rowCount: 0 };
        Object.assign(task, { title, description, price: String(price), currency, status, updated_at: new Date() });
        return { rows: [task], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO admin_client_purchases")) {
        const [reference, userId, taskId, taskTitle, quantity, unitPrice, totalAmount, currency, recordedBy] = values;
        const purchase = {
          id: crypto.randomUUID(), reference, user_id: userId, task_id: taskId, task_title: taskTitle,
          quantity, unit_price: String(unitPrice), total_amount: String(totalAmount), currency,
          status: "pending", recorded_by: recordedBy, created_at: new Date(), updated_at: new Date()
        };
        clientPurchases.set(purchase.id, purchase);
        return { rows: [purchase], rowCount: 1 };
      }
      if (sql.includes("UPDATE admin_client_purchases")) {
        const [status, recordedBy, purchaseId] = values;
        const purchase = clientPurchases.get(purchaseId);
        if (!purchase || purchase.status !== "pending") return { rows: [], rowCount: 0 };
        Object.assign(purchase, { status, recorded_by: recordedBy, updated_at: new Date() });
        return { rows: [purchase], rowCount: 1 };
      }
      if (sql.includes("UPDATE users") && sql.includes("SET account_status = $1")) {
        const user = [...users.values()].find(row => row.id === values[1] && row.role === "user");
        if (!user) return { rows: [], rowCount: 0 };
        user.account_status = values[0];
        return { rows: [{ id: user.id, full_name: user.full_name, username: user.username, email: user.email, phone: user.phone, account_status: user.account_status, created_at: user.created_at }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO admin_financial_records")) {
        const [userId, recordType, amount, currency, reference, description] = values;
        const record = {
          id: crypto.randomUUID(), user_id: userId, record_type: recordType, amount: String(amount),
          currency, status: "pending", reference, description, reviewed_by: null, created_at: new Date(), updated_at: new Date()
        };
        financialRecords.set(record.id, record);
        return { rows: [record], rowCount: 1 };
      }
      if (sql.includes("UPDATE admin_financial_records")) {
        const [status, reviewerId, recordId] = values;
        const record = financialRecords.get(recordId);
        if (!record || record.status !== "pending") return { rows: [], rowCount: 0 };
        record.status = status;
        record.reviewed_by = reviewerId;
        record.updated_at = new Date();
        return { rows: [record], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO admin_audit_log")) {
        const [actorId, action, entityType, entityId, details] = values;
        auditEntries.push({ id: auditEntries.length + 1, actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details: JSON.parse(details), created_at: new Date() });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO users")) {
        const isAdminInsert = sql.includes("personal_referral_code, role");
        const [fullName, username, email, phone, passwordHash, personalReferralCode, referralCodeOrTermsVersion, maybeTermsVersion] = values;
        if ([...users.values()].some(user => user.email === email || user.phone === phone || user.username === username || user.personal_referral_code === personalReferralCode)) {
          const error = new Error("unique constraint");
          error.code = "23505";
          throw error;
        }
        const user = {
          id: crypto.randomUUID(),
          full_name: fullName,
          username,
          personal_referral_code: personalReferralCode,
          email,
          phone,
          date_of_birth: null,
          password_hash: passwordHash,
          referral_code: isAdminInsert ? null : referralCodeOrTermsVersion || null,
          role: isAdminInsert ? "admin" : "user",
          account_status: isAdminInsert ? "active" : "pending_verification",
          terms_version: isAdminInsert ? referralCodeOrTermsVersion : maybeTermsVersion || null,
          created_at: new Date()
        };
        users.set(user.email, user);
        return { rows: [user], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO auth_sessions")) {
        sessions.set(values[0], { userId: values[1], expiresAt: new Date(values[2]) });
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
    release() {}
  };
}

pool.query = async (sql, values = []) => {
  if (sql.includes("AS total_users")) {
    const members = [...users.values()].filter(user => user.role === "user");
    return { rows: [{
      total_users: members.length,
      active_users: members.filter(user => user.account_status === "active").length,
      pending_records: [...financialRecords.values()].filter(record => record.status === "pending").length,
      approved_records: [...financialRecords.values()].filter(record => record.status === "approved").length,
      approved_totals: ["payment", "payout", "commission", "transaction"].flatMap(type =>
        [...new Set([...financialRecords.values()]
          .filter(record => record.record_type === type && record.status === "approved")
          .map(record => record.currency))]
          .map(currency => ({ type, currency, amount: String([...financialRecords.values()]
            .filter(record => record.record_type === type && record.status === "approved" && record.currency === currency)
            .reduce((total, record) => total + Number(record.amount), 0)) }))
      )
    }], rowCount: 1 };
  }
  if (sql.includes("POSITION(LOWER($1) IN LOWER(full_name))")) {
    const search = values[0].toLowerCase();
    const found = [...users.values()].filter(user => user.role === "user" && (
      !search || [user.full_name, user.username || "", user.email, user.phone].some(value => value.toLowerCase().includes(search))
    )).sort((a, b) => b.created_at - a.created_at).slice(0, 100);
    return { rows: found.map(user => ({
      id: user.id, full_name: user.full_name, username: user.username, email: user.email,
      phone: user.phone, account_status: user.account_status, created_at: user.created_at
    })), rowCount: found.length };
  }
  if (sql.includes("FROM admin_financial_records r")) {
    const [type, status] = values;
    const rows = [...financialRecords.values()]
      .filter(record => (!type || record.record_type === type) && (!status || record.status === status))
      .map(record => {
        const user = [...users.values()].find(row => row.id === record.user_id);
        return { ...record, user_name: user?.full_name || null, user_email: user?.email || null };
      });
    return { rows, rowCount: rows.length };
  }
  if (sql.includes("FROM admin_tasks")) {
    const rows = [...adminTasks.values()].sort((a, b) => b.created_at - a.created_at);
    return { rows, rowCount: rows.length };
  }
  if (sql.includes("FROM admin_client_purchases p")) {
    const status = values[0];
    const rows = [...clientPurchases.values()]
      .filter(purchase => !status || purchase.status === status)
      .sort((a, b) => b.created_at - a.created_at)
      .map(purchase => {
        const user = [...users.values()].find(row => row.id === purchase.user_id);
        return { ...purchase, client_name: user?.full_name || null, client_email: user?.email || null };
      });
    return { rows, rowCount: rows.length };
  }
  if (sql.includes("FROM admin_audit_log a")) {
    const rows = auditEntries.slice(-100).reverse().map(entry => ({
      ...entry, actor_name: [...users.values()].find(user => user.id === entry.actor_id)?.full_name || null
    }));
    return { rows, rowCount: rows.length };
  }
  if (sql.includes("INSERT INTO users")) {
    const isAdminInsert = sql.includes("personal_referral_code, role");
    const [fullName, username, email, phone, passwordHash, personalReferralCode, referralCodeOrTermsVersion, maybeTermsVersion] = values;
    if ([...users.values()].some(user => user.email === email || user.phone === phone || user.username === username || user.personal_referral_code === personalReferralCode)) {
      const error = new Error("unique constraint");
      error.code = "23505";
      throw error;
    }
    const user = {
      id: crypto.randomUUID(),
      full_name: fullName,
      username,
      personal_referral_code: personalReferralCode,
      email,
      phone,
      date_of_birth: null,
      password_hash: passwordHash,
      referral_code: isAdminInsert ? null : referralCodeOrTermsVersion || null,
      role: isAdminInsert ? "admin" : "user",
      account_status: isAdminInsert ? "active" : "pending_verification",
      terms_version: isAdminInsert ? referralCodeOrTermsVersion : maybeTermsVersion || null,
      created_at: new Date()
    };
    users.set(user.email, user);
    return { rows: [user], rowCount: 1 };
  }
  if (sql.includes("UPDATE users")) {
    const [passwordHash, fullName, username, phone, termsVersion, userId] = values;
    for (const user of users.values()) {
      if (user.id === userId) {
        user.password_hash = passwordHash;
        user.full_name = fullName;
        user.username = username;
        user.phone = phone;
        user.role = "admin";
        user.account_status = "active";
        user.terms_version = termsVersion;
        user.updated_at = new Date();
      }
    }
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("FROM auth_sessions s")) {
    const session = sessions.get(values[0]);
    const user = session && session.expiresAt > new Date() ? [...users.values()].find(row => row.id === session.userId) : null;
    return {
      rows: user ? [{
        id: user.id,
        full_name: user.full_name,
        username: user.username || null,
        personal_referral_code: user.personal_referral_code,
        email: user.email,
        phone: user.phone,
        role: user.role || "user",
        account_status: user.account_status,
        created_at: user.created_at
      }] : [],
      rowCount: user ? 1 : 0
    };
  }
  if (sql.includes("FROM users")) {
    if (sql.includes("personal_referral_code = $1")) {
      const user = [...users.values()].find(row => row.personal_referral_code === values[0]);
      return { rows: user ? [{ id: user.id }] : [], rowCount: user ? 1 : 0 };
    }
    const hasRoleFilter = sql.includes("role = $1") || sql.includes("role IS NULL");
    if (!hasRoleFilter) {
      const requestedRole = values[0] === "user" || values[0] === "admin" ? values[0] : null;
      const identifier = requestedRole ? values[1] || values[0] : values[0];
      const alternativeIdentifier = values[2] || values[1] || values[0];
      const user = [...users.values()].find(row => (row.email === identifier || row.phone === alternativeIdentifier || row.email === alternativeIdentifier || row.phone === identifier) && (!requestedRole || (row.role || "user") === requestedRole));
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }
    const requestedRole = values[0];
    const identifier = values[1] || values[0];
    const user = [...users.values()].find(row => (row.email === identifier || row.phone === identifier) && ((row.role || "user") === (requestedRole || "user")));
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }
  if (sql.includes("DELETE FROM auth_sessions")) return { rows: [], rowCount: sessions.delete(values[0]) ? 1 : 0 };
  if (sql.includes("SELECT 1")) return { rows: [{ "?column?": 1 }], rowCount: 1 };
  throw new Error(`Unexpected pool query: ${sql}`);
};
pool.connect = async () => createFakeClient();

test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  pool.query = originalQuery;
  pool.connect = originalConnect;
  await pool.end();
});

test("requires a signed-in session to access the dashboard and keeps auth pages public", async () => {
  const home = await fetch(`${baseUrl}/`, { redirect: "manual" });
  const register = await fetch(`${baseUrl}/register`);
  const login = await fetch(`${baseUrl}/login`);
  assert.equal(home.status, 302);
  assert.equal(home.headers.get("location"), "/login");
  assert.equal(register.status, 200);
  assert.match(await register.text(), /Create your account/);
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Sign in securely/);
});

test("rejects invalid registration before accessing the database", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Test Person", username: "test_person", email: "not-an-email" })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid email/i);
});

test("does not block account creation after repeated failed registration attempts", async () => {
  const attempts = await Promise.all(Array.from({ length: 12 }, () => fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Test Person", username: "test_person", email: "not-an-email" })
  })));

  assert.ok(attempts.every(response => response.status === 400));

  const retry = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Retry Person",
      username: "retry_person",
      email: "retry.person@example.com",
      phone: "+254700000001",
      password: "correct horse battery",
      confirmPassword: "correct horse battery",
      acceptedTerms: true
    })
  });
  assert.equal(retry.status, 201);
});

test("registers a user, creates a session, and rejects duplicate email or phone", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Test Person",
      username: "test_person",
      email: "test.person@example.com",
      phone: "+254712345678",
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
    acceptedTerms: true
    })
  });
  assert.equal(response.status, 201);
  const { user } = await response.json();
  assert.equal(user.email, "test.person@example.com");
  assert.equal(user.username, "test_person");
  assert.match(user.personalReferralCode, /^[A-F0-9]{24}$/);
  assert.equal(user.accountStatus, "pending_verification");
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(";")[0];
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
  assert.equal(me.status, 403);
  assert.match((await me.json()).error, /awaiting administrator activation/i);
  const dashboard = await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: "manual" });
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.get("location"), "/account-pending");
  const pendingPage = await fetch(`${baseUrl}/account-pending`, { headers: { cookie } });
  assert.equal(pendingPage.status, 200);
  assert.match(await pendingPage.text(), /awaiting activation/i);

  const referredRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Another Person",
      username: "another_person",
      email: "another.person@example.com",
      phone: "+254799999999",
      password: "correct horse battery",
      confirmPassword: "correct horse battery",
      referralCode: user.personalReferralCode.toLowerCase(),
      acceptedTerms: true
    })
  });
  assert.equal(referredRegistration.status, 201);
  const referredUser = (await referredRegistration.json()).user;
  assert.notEqual(referredUser.personalReferralCode, user.personalReferralCode);
  assert.equal(users.get("another.person@example.com").referral_code, user.personalReferralCode);

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Another Person",
      username: "third_person",
      email: "test.person@example.com",
      phone: "+254799999998",
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
    acceptedTerms: true
    })
  });
  assert.equal(duplicate.status, 409);

  const duplicateUsername = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Another Person",
      username: "TEST_PERSON",
      email: "third.person@example.com",
      phone: "+254799999997",
      password: "correct horse battery",
      confirmPassword: "correct horse battery",
      acceptedTerms: true
    })
  });
  assert.equal(duplicateUsername.status, 409);
});

test("signs in using a phone number and invalidates the session on logout", async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: "+254712345678", password: "correct horse battery" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const adminApi = await fetch(`${baseUrl}/api/admin/summary`, { headers: { cookie } });
  assert.equal(adminApi.status, 403);
  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { cookie } });
  assert.equal(logout.status, 204);
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
  assert.equal(me.status, 401);
});

test("does not reveal whether an unregistered email exists at sign-in", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: "absent@example.com", password: "wrong password" })
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Email/phone or password is incorrect.");
});

test("accepts a dedicated admin login from the same sign-in page", async () => {
  const adminEmail = "admin@mulalink.com";
  const adminPassword = "Admin@2026";
  const adminUser = {
    id: crypto.randomUUID(),
    full_name: "MULALINK Admin",
    username: "admin",
    personal_referral_code: "0123456789ABCDEF01234567",
    email: adminEmail,
    phone: "+254700000000",
    date_of_birth: null,
    password_hash: await bcrypt.hash(adminPassword, 12),
    referral_code: null,
    role: "admin",
    account_status: "active",
    created_at: new Date()
  };
  users.set(adminEmail, adminUser);

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: adminEmail, password: adminPassword, role: "admin" })
  });

  assert.equal(response.status, 200);
  const { user } = await response.json();
  assert.equal(user.email, adminEmail);
  assert.equal(user.role, "admin");
  adminCookie = response.headers.get("set-cookie").split(";")[0];
  const adminPage = await fetch(`${baseUrl}/admin`, { headers: { cookie: adminCookie } });
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /Admin console/);
});

test("admin APIs create and review internal-only financial records and audit each change", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/admin/financial-records`);
  assert.equal(unauthorized.status, 401);

  const member = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Admin Managed Member",
      username: "managed_member",
      email: "managed.member@example.com",
      phone: "+254799999996",
      password: "correct horse battery",
      confirmPassword: "correct horse battery",
      acceptedTerms: true
    })
  });
  assert.equal(member.status, 201);
  const createdMember = (await member.json()).user;

  const summary = await fetch(`${baseUrl}/api/admin/summary`, { headers: { cookie: adminCookie } });
  assert.equal(summary.status, 200);
  assert.ok(Number((await summary.json()).summary.total_users) >= 1);

  const statusUpdate = await fetch(`${baseUrl}/api/admin/users/${createdMember.id}/status`, {
    method: "PATCH",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "active" })
  });
  assert.equal(statusUpdate.status, 200);
  assert.equal((await statusUpdate.json()).user.account_status, "active");
  const memberCookie = member.headers.get("set-cookie").split(";")[0];
  const dashboard = await fetch(`${baseUrl}/`, { headers: { cookie: memberCookie }, redirect: "manual" });
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /id="page-content"/);
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: memberCookie } });
  assert.equal(me.status, 200);

  const createdRecord = await fetch(`${baseUrl}/api/admin/financial-records`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "payout", userId: createdMember.id, amount: 425.5, currency: "KES", description: "Internal test tracking record" })
  });
  assert.equal(createdRecord.status, 201);
  const { record } = await createdRecord.json();
  assert.equal(record.status, "pending");

  const reviewed = await fetch(`${baseUrl}/api/admin/financial-records/${record.id}/status`, {
    method: "PATCH",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "approved" })
  });
  assert.equal(reviewed.status, 200);
  const reviewResult = await reviewed.json();
  assert.equal(reviewResult.record.status, "approved");
  assert.equal(reviewResult.internalOnly, true);

  const audit = await fetch(`${baseUrl}/api/admin/audit-log`, { headers: { cookie: adminCookie } });
  assert.equal(audit.status, 200);
  const { entries } = await audit.json();
  assert.ok(entries.some(entry => entry.action === "user.status_changed"));
  assert.ok(entries.some(entry => entry.action === "financial_record.created"));
  assert.ok(entries.some(entry => entry.action === "financial_record.approved"));
});

test("admin APIs reject invalid status changes and non-admins cannot load the admin page", async () => {
  const memberLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: "managed.member@example.com", password: "correct horse battery" })
  });
  assert.equal(memberLogin.status, 200);
  const memberCookie = memberLogin.headers.get("set-cookie").split(";")[0];
  const page = await fetch(`${baseUrl}/admin`, { headers: { cookie: memberCookie } });
  assert.equal(page.status, 403);
  const taskApi = await fetch(`${baseUrl}/api/admin/tasks`, { headers: { cookie: memberCookie } });
  assert.equal(taskApi.status, 403);
  const purchaseApi = await fetch(`${baseUrl}/api/admin/purchases`, { headers: { cookie: memberCookie } });
  assert.equal(purchaseApi.status, 403);

  const invalidRecord = await fetch(`${baseUrl}/api/admin/financial-records`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "payout", amount: -10 })
  });
  assert.equal(invalidRecord.status, 400);

  const invalidPrecision = await fetch(`${baseUrl}/api/admin/financial-records`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "payout", amount: 12.345 })
  });
  assert.equal(invalidPrecision.status, 400);

  const invalidId = await fetch(`${baseUrl}/api/admin/users/not-a-uuid/status`, {
    method: "PATCH",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "active" })
  });
  assert.equal(invalidId.status, 400);
});

test("admin task pricing and client purchase records are protected, persisted, and audited", async () => {
  const noAdminTasks = await fetch(`${baseUrl}/api/admin/tasks`);
  const noAdminPurchases = await fetch(`${baseUrl}/api/admin/purchases`);
  assert.equal(noAdminTasks.status, 401);
  assert.equal(noAdminPurchases.status, 401);

  const member = [...users.values()].find(user => user.role === "user" && user.email === "managed.member@example.com");
  assert.ok(member);

  const createdResponse = await fetch(`${baseUrl}/api/admin/tasks`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Client onboarding", description: "Prepare an onboarding package.", price: 250.5, currency: "kes" })
  });
  assert.equal(createdResponse.status, 201);
  const { task: createdTask } = await createdResponse.json();
  assert.equal(createdTask.title, "Client onboarding");
  assert.equal(createdTask.price, "250.5");
  assert.equal(createdTask.currency, "KES");
  assert.equal(createdTask.status, "active");

  const listedTasks = await fetch(`${baseUrl}/api/admin/tasks`, { headers: { cookie: adminCookie } });
  assert.equal(listedTasks.status, 200);
  assert.ok((await listedTasks.json()).tasks.some(task => task.id === createdTask.id));

  const updatedTaskResponse = await fetch(`${baseUrl}/api/admin/tasks/${createdTask.id}`, {
    method: "PATCH",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Client onboarding", description: "Updated package.", price: 300, currency: "KES", status: "active" })
  });
  assert.equal(updatedTaskResponse.status, 200);
  assert.equal((await updatedTaskResponse.json()).task.price, "300");

  const createdPurchaseResponse = await fetch(`${baseUrl}/api/admin/purchases`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ userId: member.id, taskId: createdTask.id, quantity: 2 })
  });
  assert.equal(createdPurchaseResponse.status, 201);
  const { purchase, internalOnly } = await createdPurchaseResponse.json();
  assert.equal(internalOnly, true);
  assert.equal(purchase.status, "pending");
  assert.equal(purchase.task_title, "Client onboarding");
  assert.equal(purchase.unit_price, "300");
  assert.equal(purchase.total_amount, "600");

  const listedPurchases = await fetch(`${baseUrl}/api/admin/purchases?status=pending`, { headers: { cookie: adminCookie } });
  assert.equal(listedPurchases.status, 200);
  assert.ok((await listedPurchases.json()).purchases.some(row => row.id === purchase.id));

  const recordedResponse = await fetch(`${baseUrl}/api/admin/purchases/${purchase.id}/status`, {
    method: "PATCH",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "recorded" })
  });
  assert.equal(recordedResponse.status, 200);
  const recorded = await recordedResponse.json();
  assert.equal(recorded.purchase.status, "recorded");
  assert.equal(recorded.internalOnly, true);

  const invalidTaskPrice = await fetch(`${baseUrl}/api/admin/tasks`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Invalid price", price: 12.345 })
  });
  assert.equal(invalidTaskPrice.status, 400);

  const invalidPurchaseQuantity = await fetch(`${baseUrl}/api/admin/purchases`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ userId: member.id, taskId: createdTask.id, quantity: 1.5 })
  });
  assert.equal(invalidPurchaseQuantity.status, 400);

  const audit = await fetch(`${baseUrl}/api/admin/audit-log`, { headers: { cookie: adminCookie } });
  const { entries } = await audit.json();
  assert.ok(entries.some(entry => entry.action === "task.created"));
  assert.ok(entries.some(entry => entry.action === "task.updated"));
  assert.ok(entries.some(entry => entry.action === "purchase.created"));
  assert.ok(entries.some(entry => entry.action === "purchase.recorded"));
});
