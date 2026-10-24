"use strict";

const crypto = require("node:crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { DarajaError, normalizePhone } = require("./daraja");

const uuid = z.string().uuid();
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const finalStatuses = new Set(["succeeded", "failed"]);
const activationFee = 1;
const activationSchema = z.object({}).strict();
const callbackSchema = z.object({ Body: z.object({ stkCallback: z.object({
  MerchantRequestID: z.string().min(1).max(128), CheckoutRequestID: z.string().min(1).max(128),
  ResultCode: z.number().int().min(0).max(2147483647), ResultDesc: z.string().max(1024),
  CallbackMetadata: z.object({ Item: z.array(z.object({ Name: z.string(), Value: z.unknown().optional() })).max(20) }).optional()
}) }) });

function publicPayment(row) {
  return {
    id: row.id, reference: row.reference, phone: row.phone, amount: Number(row.amount), currency: row.currency,
    environment: row.environment, purpose: row.purpose, status: row.status, checkoutRequestId: row.checkout_request_id,
    resultCode: row.result_code, resultDescription: row.result_description, receipt: row.receipt,
    transactionDate: row.transaction_date, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function createActivationService({ pool, daraja }) {
  return {
    async start(user, key = crypto.randomUUID()) {
      if (user.role !== "user" || user.account_status !== "pending_verification") return { statusCode: 409, error: "This account does not require an activation payment." };
      const phone = normalizePhone(user.phone);
      if (!phone) return { statusCode: 400, error: "The registered phone number must be a valid Kenyan M-PESA mobile number." };
      if (!daraja.enabled) return { statusCode: 503, error: "M-PESA activation payments are not configured yet. Please contact support." };
      const callbackId = crypto.randomUUID();
      const callbackToken = crypto.randomBytes(32).toString("hex");
      const inserted = await pool.query(
        `INSERT INTO mpesa_payments (id, user_id, idempotency_key, environment, reference, phone, amount, callback_token_hash, purpose)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activation') ON CONFLICT DO NOTHING RETURNING *`,
        [callbackId, user.id, key, daraja.environment, `ML${crypto.randomBytes(5).toString("hex").toUpperCase()}`, phone, activationFee, hash(callbackToken)]
      );
      if (!inserted.rowCount) {
        const existing = await pool.query(
          `SELECT * FROM mpesa_payments WHERE user_id = $1 AND (idempotency_key = $2 OR
             (purpose = 'activation' AND environment = $3 AND status IN ('initiating', 'pending', 'unknown', 'succeeded')))
           ORDER BY (idempotency_key = $2) DESC LIMIT 1`, [user.id, key, daraja.environment]
        );
        const payment = existing.rows[0];
        if (!payment) throw new Error("Could not locate the existing activation payment.");
        if (payment.purpose !== "activation" || payment.phone !== phone) return { statusCode: 409, error: "An existing payment must be resolved before another activation request." };
        return { statusCode: finalStatuses.has(payment.status) ? 200 : 202, payment: publicPayment(payment) };
      }
      const payment = inserted.rows[0];
      let response;
      try {
        response = await daraja.push({ phone, amount: activationFee, reference: payment.reference, callbackId, callbackToken, description: "Activation" });
      } catch (error) {
        if (!(error instanceof DarajaError)) throw error;
        const updated = await pool.query(
          "UPDATE mpesa_payments SET status = $2, result_description = $3, updated_at = NOW() WHERE id = $1 AND status = 'initiating' RETURNING *",
          [payment.id, error.uncertain ? "unknown" : "failed", error.message]
        );
        if (!updated.rowCount) {
          const current = await pool.query("SELECT * FROM mpesa_payments WHERE id = $1", [payment.id]);
          return { statusCode: 200, payment: publicPayment(current.rows[0]) };
        }
        return { statusCode: error.uncertain ? 202 : 502, error: error.message, payment: publicPayment(updated.rows[0]) };
      }
      const updated = await pool.query(
        `UPDATE mpesa_payments SET merchant_request_id = $2, checkout_request_id = $3,
         status = 'pending', updated_at = NOW() WHERE id = $1 AND status = 'initiating' RETURNING *`,
        [payment.id, response.merchantRequestId, response.checkoutRequestId]
      );
      const current = updated.rowCount ? updated : await pool.query("SELECT * FROM mpesa_payments WHERE id = $1", [payment.id]);
      return { statusCode: 202, payment: publicPayment(current.rows[0]) };
    }
  };
}

function createMpesaRouter({ pool, requireSession, requireAuthenticatedSession, daraja, activationService = createActivationService({ pool, daraja }) }) {
  const router = express.Router();
  const pushLimiter = rateLimit({
    windowMs: 60000, limit: 3, keyGenerator: req => req.user.id,
    standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: "Please wait a minute before requesting another M-PESA prompt." }
  });

  router.get("/", requireSession, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const payments = await pool.query("SELECT * FROM mpesa_payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [req.user.id]);
      const totals = await pool.query(
        "SELECT environment, COALESCE(SUM(amount), 0) AS amount FROM mpesa_payments WHERE user_id = $1 AND status = 'succeeded' GROUP BY environment", [req.user.id]
      );
      return res.json({ enabled: daraja.enabled, environment: daraja.environment, payments: payments.rows.map(publicPayment), confirmedTotals: totals.rows });
    } catch (error) { return next(error); }
  });

  router.get("/activation", requireAuthenticatedSession, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const payments = await pool.query("SELECT * FROM mpesa_payments WHERE user_id = $1 AND purpose = 'activation' ORDER BY created_at DESC LIMIT 20", [req.user.id]);
      return res.json({
        enabled: daraja.enabled, environment: daraja.environment, activationFee, currency: "KES",
        user: { id: req.user.id, fullName: req.user.full_name, phone: req.user.phone, accountStatus: req.user.account_status },
        payments: payments.rows.map(publicPayment)
      });
    } catch (error) { return next(error); }
  });

  router.post("/stk-push", requireSession, (_req, res) => res.status(410).json({ error: "STK Push is used for the KES 1 account activation test fee. Wallet deposits are unavailable." }));

  router.post("/activation/stk-push", requireAuthenticatedSession, pushLimiter, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!req.is("application/json")) return res.status(415).json({ error: "Send the request as application/json." });
    const input = activationSchema.safeParse(req.body);
    const key = uuid.safeParse(req.get("Idempotency-Key"));
    if (!input.success || !key.success) return res.status(400).json({ error: !input.success ? "The activation phone and amount are taken from your registered account; send an empty JSON object." : "Provide a UUID Idempotency-Key header to prevent duplicate payment requests." });
    try {
      const { statusCode, ...result } = await activationService.start(req.user, key.data);
      return res.status(statusCode).json(result);
    } catch (error) { return next(error); }
  });

  // Each request has a private callback URL. Daraja does not send our session cookie.
  router.post(["/callback/:id/:token", "/activation-callback/:id/:token"], async (req, res, next) => {
    if (!uuid.safeParse(req.params.id).success || !/^[a-f0-9]{64}$/.test(req.params.token)) return res.sendStatus(404);
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM mpesa_payments WHERE id = $1 FOR UPDATE", [req.params.id]);
      const payment = result.rows[0];
      if (!payment || !crypto.timingSafeEqual(Buffer.from(hash(req.params.token), "hex"), Buffer.from(payment.callback_token_hash, "hex"))) {
        await client.query("ROLLBACK");
        return res.sendStatus(404);
      }
      const parsed = callbackSchema.safeParse(req.body);
      if (!parsed.success) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid M-PESA callback." });
      }
      const callback = parsed.data.Body.stkCallback;
      if ((payment.checkout_request_id && payment.checkout_request_id !== callback.CheckoutRequestID) ||
          (payment.merchant_request_id && payment.merchant_request_id !== callback.MerchantRequestID)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Callback tracking IDs do not match this payment." });
      }
      let receipt = null;
      let transactionDate = null;
      if (callback.ResultCode === 0) {
        const items = callback.CallbackMetadata?.Item || [];
        const metadata = Object.fromEntries(items.map(item => [item.Name, item.Value]));
        if (new Set(items.map(item => item.Name)).size !== items.length ||
            (typeof metadata.Amount !== "number" && typeof metadata.Amount !== "string") || Number(metadata.Amount) !== Number(payment.amount) ||
            normalizePhone(metadata.PhoneNumber) !== payment.phone ||
            typeof metadata.MpesaReceiptNumber !== "string" || !/^[A-Z0-9]{8,32}$/.test(metadata.MpesaReceiptNumber) ||
            !/^\d{14}$/.test(String(metadata.TransactionDate))) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Successful callback metadata does not match the payment." });
        }
        receipt = metadata.MpesaReceiptNumber;
        transactionDate = String(metadata.TransactionDate);
      }
      if (!finalStatuses.has(payment.status)) {
        await client.query(
          `UPDATE mpesa_payments SET status = $2, merchant_request_id = $3, checkout_request_id = $4,
           result_code = $5, result_description = $6, receipt = $7, transaction_date = $8, updated_at = NOW() WHERE id = $1`,
          [payment.id, callback.ResultCode === 0 ? "succeeded" : "failed", callback.MerchantRequestID, callback.CheckoutRequestID,
            callback.ResultCode, callback.ResultDesc, receipt, transactionDate]
        );
        if (callback.ResultCode === 0 && payment.purpose === "activation" && payment.environment === "production" && [1, 100].includes(Number(payment.amount))) {
          await client.query(
            `UPDATE users SET activation_payment_id = $2, activation_paid_at = NOW(), updated_at = NOW(),
             account_status = CASE WHEN account_status = 'pending_verification' THEN 'active' ELSE account_status END
             WHERE id = $1 AND role = 'user' AND activation_payment_id IS NULL`,
            [payment.user_id, payment.id]
          );
        }
      }
      await client.query("COMMIT");
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      if (error.code === "23505") return res.status(409).json({ error: "M-PESA receipt or checkout ID was already recorded." });
      return next(error);
    } finally { client?.release(); }
  });

  return router;
}

module.exports = { activationFee, createActivationService, createMpesaRouter };
