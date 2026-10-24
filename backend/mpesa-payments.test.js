"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const { createMpesaRouter } = require("./mpesa-payments");
const { DarajaError } = require("./daraja");

// These API tests use a database double, matching the existing server tests.
// PostgreSQL enforces receipt uniqueness and serializes callbacks with FOR UPDATE.
async function fixture(t, { enabled = true, push, environment = "production", accountStatus = "pending_verification", role = "user" } = {}) {
  const payments = new Map();
  const calls = [];
  const users = new Map();
  let callback;
  let writes = 0;
  const pool = {
    async query(sql, values = []) {
      const result = rows => ({ rows, rowCount: rows.length });
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return result([]);
      if (sql.includes("INSERT INTO mpesa_payments")) {
        if ([...payments.values()].some(row => row.user_id === values[1] && (row.idempotency_key === values[2] || (row.purpose === "activation" && row.environment === values[3] && ["initiating", "pending", "unknown", "succeeded"].includes(row.status))))) return result([]);
        const [id, user_id, idempotency_key, environment, reference, phone, amount, callback_token_hash] = values;
        const row = { id, user_id, idempotency_key, environment, reference, phone, amount: String(amount), callback_token_hash,
          currency: "KES", purpose: "activation", status: "initiating", checkout_request_id: null, merchant_request_id: null,
          result_code: null, result_description: null, receipt: null, transaction_date: null, created_at: new Date(), updated_at: new Date() };
        payments.set(id, row);
        return result([{ ...row }]);
      }
      if (sql.includes("SUM(amount)")) {
        return result(["sandbox", "production"].map(environment => ({ environment, amount: String([...payments.values()]
          .filter(row => row.user_id === values[0] && row.status === "succeeded" && row.environment === environment).reduce((sum, row) => sum + Number(row.amount), 0)) })));
      }
      if (sql.includes("SELECT * FROM mpesa_payments WHERE user_id")) {
        const rows = [...payments.values()].filter(row => row.user_id === values[0] &&
          (!sql.includes("purpose = 'activation'") || row.purpose === "activation") &&
          (!sql.includes("idempotency_key") || row.idempotency_key === values[1] || (row.environment === values[2] && ["initiating", "pending", "unknown", "succeeded"].includes(row.status))));
        rows.sort((a, b) => Number(b.idempotency_key === values[1]) - Number(a.idempotency_key === values[1]));
        return result(rows.map(row => ({ ...row })));
      }
      if (sql.includes("UPDATE users SET activation_payment_id")) {
        const user = users.get(values[0]);
        if (!user || user.role !== "user" || user.activation_payment_id) return result([]);
        user.activation_payment_id = values[1];
        if (user.account_status === "pending_verification") user.account_status = "active";
        return result([user]);
      }
      if (sql.includes("SELECT * FROM mpesa_payments WHERE id")) return result(payments.has(values[0]) ? [{ ...payments.get(values[0]) }] : []);
      if (sql.includes("UPDATE mpesa_payments")) {
        const row = payments.get(values[0]);
        if (sql.includes("status = 'initiating'") && row.status !== "initiating") return result([]);
        if (sql.includes("result_code = $5")) {
          if ([...payments.values()].some(other => other.id !== row.id && other.environment === row.environment && (other.checkout_request_id === values[3] || (values[6] && other.receipt === values[6])))) throw Object.assign(new Error("duplicate receipt"), { code: "23505" });
          Object.assign(row, { status: values[1], merchant_request_id: values[2], checkout_request_id: values[3], result_code: values[4], result_description: values[5], receipt: values[6], transaction_date: values[7] });
          writes++;
        } else if (sql.includes("status = $2")) Object.assign(row, { status: values[1], result_description: values[2] });
        else Object.assign(row, { status: "pending", merchant_request_id: values[1], checkout_request_id: values[2] });
        return result([{ ...row }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async connect() { return { query: (...args) => pool.query(...args), release() {} }; }
  };
  const daraja = { enabled, environment, async push(input) {
    calls.push(input);
    callback = `/api/payments/mpesa/callback/${input.callbackId}/${input.callbackToken}`;
    return push ? push(input, { payments, callback, baseUrl }) : { merchantRequestId: "merchant-1", checkoutRequestId: `checkout-${calls.length}` };
  } };
  const app = express();
  app.use(express.json());
  const authenticate = (req, res, next) => {
    const id = req.get("X-Test-User");
    if (!id) return res.sendStatus(401);
    if (!users.has(id)) users.set(id, { id, role, account_status: accountStatus, phone: "+254712345678" });
    req.user = users.get(id);
    if (["suspended", "restricted"].includes(req.user.account_status)) return res.sendStatus(403);
    return next();
  };
  app.use("/api/payments/mpesa", createMpesaRouter({ pool, daraja, requireAuthenticatedSession: authenticate,
    requireSession(req, res, next) { return authenticate(req, res, () => req.user.account_status === "active" ? next() : res.sendStatus(403)); }
  }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => server.close(resolve)));
  const api = async (path, { user = "user-1", method = "GET", body, key = crypto.randomUUID(), headers = {} } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers: { ...(user ? { "X-Test-User": user } : {}), ...(body ? { "Content-Type": "application/json" } : {}), "Idempotency-Key": key, ...headers },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  };
  return { api, calls, payments, users, get callback() { return callback; }, get writes() { return writes; } };
}
const endpoint = "/api/payments/mpesa/activation";
const input = {};
function callbackBody({ code = 0, checkout = "checkout-1", amount = 1, phone = 254712345678, receipt = "ULJ7RT61SV" } = {}) {
  return { Body: { stkCallback: {
    MerchantRequestID: "merchant-1", CheckoutRequestID: checkout, ResultCode: code,
    ResultDesc: code === 0 ? "Payment completed" : "Request cancelled by user",
    ...(code === 0 ? { CallbackMetadata: { Item: [
      { Name: "Amount", Value: amount }, { Name: "MpesaReceiptNumber", Value: receipt },
      { Name: "TransactionDate", Value: 20261024140000 }, { Name: "PhoneNumber", Value: phone }, { Name: "Balance" }
    ] } } : {})
  } } };
}

test("requires a session and valid inputs; exposes disabled status without sending prompts", async t => {
  const f = await fixture(t, { enabled: false });
  assert.equal((await f.api(endpoint, { user: null })).status, 401);
  assert.equal((await f.api(`${endpoint}/stk-push`, { user: null, method: "POST", body: input })).status, 401);
  assert.equal((await f.api(endpoint)).data.enabled, false);
  assert.equal((await f.api(`${endpoint}/stk-push`, { method: "POST", body: input })).status, 503);
  assert.equal(f.calls.length, 0);
  const g = await fixture(t);
  for (const body of [{ ...input, amount: 1.5 }, { ...input, phone: "not-a-phone" }]) assert.equal((await g.api(`${endpoint}/stk-push`, { method: "POST", body })).status, 400);
  assert.equal((await g.api(`${endpoint}/stk-push`, { method: "POST", body: input, key: "invalid", user: "user-2" })).status, 400);
  assert.equal(g.payments.size, 0);
});

test("persists pending requests, scopes history by user, and prevents duplicate or changed idempotent requests", async t => {
  const f = await fixture(t);
  const key = crypto.randomUUID();
  const first = await f.api(`${endpoint}/stk-push`, { method: "POST", body: input, key });
  assert.equal(first.status, 202);
  assert.equal(first.data.payment.status, "pending");
  assert.equal(first.data.payment.phone, "254712345678");
  assert.equal(first.data.payment.receipt, null);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal("callback_token_hash" in first.data.payment, false);
  assert.equal("callbackToken" in first.data.payment, false);
  const retry = await f.api(`${endpoint}/stk-push`, { method: "POST", body: input, key });
  assert.equal(retry.data.payment.id, first.data.payment.id);
  assert.equal((await f.api(`${endpoint}/stk-push`, { method: "POST", body: { phone: "0722345678" }, key })).status, 400);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.api(endpoint, { user: "user-2" })).data.payments.length, 0);
  const list = await f.api(endpoint);
  assert.equal(list.data.payments.length, 1);
  assert.equal(list.data.user.accountStatus, "pending_verification");
  assert.equal(f.calls[0].amount, 1);
  assert.equal(f.calls[0].phone, "254712345678");
});

test("prevents a second activation charge even with a different idempotency key", async t => {
  const f = await fixture(t);
  const first = await f.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  const second = await f.api(`${endpoint}/stk-push`, { method: "POST", body: {} });
  assert.equal(second.data.payment.id, first.data.payment.id);
  assert.equal(f.calls.length, 1);
  assert.equal(f.users.get("user-1").account_status, "pending_verification");
});

test("a delivered prompt with a merchant mismatch does not activate the account", async t => {
  const f = await fixture(t);
  await f.api(`${endpoint}/stk-push`, { method: "POST", body: {} });
  const body = callbackBody({ code: 2002 });
  body.Body.stkCallback.ResultDesc = "Failed. The Agent number and Store number entered do not match.";
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body })).status, 200);
  const status = (await f.api(endpoint)).data;
  assert.equal(status.payments[0].status, "failed");
  assert.equal(status.payments[0].resultCode, 2002);
  assert.equal(status.user.accountStatus, "pending_verification");
  assert.equal(f.users.get("user-1").activation_payment_id, undefined);
});

test("only live activation payments unlock an account, and restricted accounts stay restricted", async t => {
  const sandbox = await fixture(t, { environment: "sandbox" });
  await sandbox.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  await sandbox.api(sandbox.callback, { user: null, method: "POST", body: callbackBody() });
  assert.equal(sandbox.users.get("user-1").account_status, "pending_verification");
  const restricted = await fixture(t);
  await restricted.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  restricted.users.get("user-1").account_status = "suspended";
  await restricted.api(restricted.callback.replace("/callback/", "/activation-callback/"), { user: null, method: "POST", body: callbackBody() });
  assert.equal(restricted.users.get("user-1").account_status, "suspended");
  assert.ok(restricted.users.get("user-1").activation_payment_id);
  const deposit = await fixture(t);
  await deposit.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  [...deposit.payments.values()][0].purpose = "deposit";
  await deposit.api(deposit.callback, { user: null, method: "POST", body: callbackBody() });
  assert.equal(deposit.users.get("user-1").account_status, "pending_verification");
});

test("rejects client-controlled fees and prevents already-active accounts from paying again", async t => {
  const f = await fixture(t);
  assert.equal((await f.api(`${endpoint}/stk-push`, { method: "POST", body: { amount: 100 } })).status, 400);
  assert.equal(f.calls.length, 0);
  const alternatePhone = await f.api(`${endpoint}/stk-push`, { method: "POST", body: { phone: "0722345678" } });
  assert.equal(alternatePhone.status, 400);
  assert.equal(f.calls.length, 0);
  const active = await fixture(t, { accountStatus: "active" });
  assert.equal((await active.api(`${endpoint}/stk-push`, { method: "POST", body: input })).status, 409);
  assert.equal(active.calls.length, 0);
});

test("records successful callbacks once, validates private URL and metadata, and keeps final status stable", async t => {
  const f = await fixture(t);
  await f.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  assert.equal((await f.api(f.callback.replace(/[a-f0-9]{64}$/, "0".repeat(64)), { user: null, method: "POST", body: callbackBody() })).status, 404);
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body: {} })).status, 400);
  for (const change of [{ amount: 101 }, { phone: 254722345678 }]) assert.equal((await f.api(f.callback, { user: null, method: "POST", body: callbackBody(change) })).status, 400);
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body: callbackBody({ checkout: "wrong-id" }) })).status, 409);
  const missing = callbackBody();
  delete missing.Body.stkCallback.CallbackMetadata;
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body: missing })).status, 400);
  assert.equal(f.writes, 0);
  const success = await f.api(f.callback, { user: null, method: "POST", body: callbackBody() });
  assert.equal(success.status, 200);
  assert.equal(success.data.ResultCode, 0);
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body: callbackBody() })).status, 200);
  await f.api(f.callback, { user: null, method: "POST", body: callbackBody({ code: 1032 }) });
  assert.equal(f.writes, 1);
  const list = (await f.api(endpoint)).data;
  assert.equal(list.payments[0].status, "succeeded");
  assert.equal(list.payments[0].receipt, "ULJ7RT61SV");
  assert.equal(list.user.accountStatus, "active");
  assert.equal(f.users.get("user-1").activation_payment_id, list.payments[0].id);
});

test("handles cancellations without metadata and rejects receipt reuse across requests", async t => {
  const f = await fixture(t);
  await f.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  await f.api(f.callback, { user: null, method: "POST", body: callbackBody({ code: 1032 }) });
  assert.equal((await f.api(endpoint)).data.payments[0].status, "failed");
  assert.equal((await f.api(endpoint)).data.payments[0].resultCode, 1032);
  await f.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  await f.api(f.callback, { user: null, method: "POST", body: callbackBody({ checkout: "checkout-2" }) });
  await f.api(`${endpoint}/stk-push`, { method: "POST", body: input, user: "user-2" });
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body: callbackBody({ checkout: "checkout-3" }) })).status, 409);
  assert.equal([...f.payments.values()][2].status, "pending");
});

test("preserves uncertain timeouts and accepts delayed callbacks without resending the prompt", async t => {
  const f = await fixture(t, { push: () => { throw new DarajaError("Connection timed out", true); } });
  const key = crypto.randomUUID();
  const first = await f.api(`${endpoint}/stk-push`, { method: "POST", body: input, key });
  assert.equal(first.status, 202);
  assert.equal(first.data.payment.status, "unknown");
  await f.api(`${endpoint}/stk-push`, { method: "POST", body: input, key });
  assert.equal(f.calls.length, 1);
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body: callbackBody() })).status, 200);
  assert.equal((await f.api(endpoint)).data.payments[0].status, "succeeded");
  const g = await fixture(t, { push: () => { throw new DarajaError("Provider rejected request"); } });
  const rejected = await g.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  assert.equal(rejected.status, 502);
  assert.equal(rejected.data.payment.status, "failed");
});

test("keeps an early callback final when it arrives before the push response", async t => {
  const f = await fixture(t, { push: async (_input, { callback, baseUrl }) => {
    const result = await fetch(`${baseUrl}${callback}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(callbackBody()) });
    assert.equal(result.status, 200);
    return { merchantRequestId: "merchant-1", checkoutRequestId: "checkout-1" };
  } });
  const first = await f.api(`${endpoint}/stk-push`, { method: "POST", body: input });
  assert.equal(first.data.payment.status, "succeeded");
  assert.equal(f.writes, 1);
});

test("limits prompt requests per member without blocking provider callbacks", async t => {
  const f = await fixture(t);
  for (let i = 0; i < 3; i++) assert.equal((await f.api(`${endpoint}/stk-push`, { method: "POST", body: input })).status, 202);
  assert.equal((await f.api(`${endpoint}/stk-push`, { method: "POST", body: input })).status, 429);
  assert.equal((await f.api(f.callback, { user: null, method: "POST", body: callbackBody({ checkout: "checkout-1" }) })).status, 200);
  assert.equal((await f.api(`${endpoint}/stk-push`, { method: "POST", body: input, user: "user-2" })).status, 202);
});
