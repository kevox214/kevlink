"use strict";

const { z } = require("zod");

function normalizePhone(value) {
  const phone = String(value).replace(/[\s()-]/g, "");
  if (/^0[17]\d{8}$/.test(phone)) return `254${phone.slice(1)}`;
  if (/^\+?254[17]\d{8}$/.test(phone)) return phone.replace(/^\+/, "");
  return null;
}

const stkPushSchema = z.object({
  phone: z.string().max(32).transform(normalizePhone).refine(Boolean, "Enter a valid Kenyan mobile number, for example 0712345678."),
  amount: z.number().int().min(1).max(250000)
}).strict();

class DarajaError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.name = "DarajaError";
    this.uncertain = uncertain;
  }
}

function readConfig(env) {
  env = {
    ...env,
    DARAJA_ENV: env.DARAJA_ENV || env.MPESA_ENVIRONMENT,
    DARAJA_CONSUMER_KEY: env.DARAJA_CONSUMER_KEY || env.MPESA_CONSUMER_KEY,
    DARAJA_CONSUMER_SECRET: env.DARAJA_CONSUMER_SECRET || env.MPESA_CONSUMER_SECRET,
    DARAJA_SHORTCODE: env.DARAJA_SHORTCODE || env.MPESA_SHORTCODE,
    DARAJA_PASSKEY: env.DARAJA_PASSKEY || env.MPESA_PASSKEY,
    DARAJA_CALLBACK_URL: env.DARAJA_CALLBACK_URL || env.MPESA_STK_CALLBACK_URL,
    DARAJA_TRANSACTION_TYPE: env.DARAJA_TRANSACTION_TYPE || env.MPESA_TRANSACTION_TYPE,
    DARAJA_PARTY_B: env.DARAJA_PARTY_B || env.MPESA_PARTY_B
  };
  const required = ["DARAJA_CONSUMER_KEY", "DARAJA_CONSUMER_SECRET", "DARAJA_SHORTCODE", "DARAJA_PASSKEY", "DARAJA_CALLBACK_URL"];
  if (required.some(key => !env[key]?.trim())) return null;
  const environment = env.DARAJA_ENV || "sandbox";
  if (!["sandbox", "production"].includes(environment)) throw new Error("DARAJA_ENV must be sandbox or production.");
  const shortcode = env.DARAJA_SHORTCODE.trim();
  const partyB = (env.DARAJA_PARTY_B || shortcode).trim();
  if (!/^\d{5,7}$/.test(shortcode) || !/^\d{5,7}$/.test(partyB)) throw new Error("Daraja short code and PartyB must contain 5 to 7 digits.");
  const transactionType = env.DARAJA_TRANSACTION_TYPE || "CustomerPayBillOnline";
  if (!["CustomerPayBillOnline", "CustomerBuyGoodsOnline"].includes(transactionType)) throw new Error("Invalid DARAJA_TRANSACTION_TYPE.");
  const callback = new URL(env.DARAJA_CALLBACK_URL);
  if (callback.protocol !== "https:" || callback.username || callback.password || callback.search || callback.hash || /^(localhost|127\.|\[::1\])/.test(callback.hostname)) {
    throw new Error("DARAJA_CALLBACK_URL must be a public HTTPS URL without credentials, query parameters, or a fragment.");
  }
  if (!["/api/payments/mpesa/callback", "/api/payments/mpesa/activation-callback"].includes(callback.pathname.replace(/\/$/, ""))) throw new Error("The M-PESA callback URL must end in /api/payments/mpesa/callback or /api/payments/mpesa/activation-callback.");
  return {
    environment, shortcode, partyB, transactionType,
    consumerKey: env.DARAJA_CONSUMER_KEY.trim(), consumerSecret: env.DARAJA_CONSUMER_SECRET.trim(),
    passkey: env.DARAJA_PASSKEY.trim(), callbackUrl: callback.href.replace(/\/$/, ""),
    baseUrl: environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke"
  };
}

function darajaTimestamp(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date).filter(part => part.type !== "literal")
    .reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

function createDarajaClient({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const config = readConfig(env);
  let cachedToken;
  let tokenExpiresAt = 0;
  let tokenRequest;

  async function request(path, options, uncertain) {
    try {
      const response = await fetchImpl(`${config.baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(15000), redirect: "error" });
      let body;
      try { body = await response.json(); } catch { throw new DarajaError("M-PESA returned an unreadable response.", uncertain); }
      if (response.status === 401 || response.status === 403 || body?.errorCode === "404.001.03") {
        cachedToken = null;
        tokenExpiresAt = 0;
      }
      if (!response.ok) {
        const providerCode = typeof body?.errorCode === "string" && /^[\d.]{1,32}$/.test(body.errorCode) ? `; code ${body.errorCode}` : "";
        throw new DarajaError(`M-PESA could not accept the request (HTTP ${response.status}${providerCode}). Please try again later.`, uncertain && response.status >= 500);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new DarajaError("M-PESA returned an invalid response.", uncertain);
      return body;
    } catch (error) {
      if (error instanceof DarajaError) throw error;
      throw new DarajaError("M-PESA could not be reached. Please check your payment status before trying again.", uncertain);
    }
  }

  async function accessToken() {
    if (cachedToken && now() < tokenExpiresAt) return cachedToken;
    if (!tokenRequest) {
      tokenRequest = (async () => {
        const body = await request("/oauth/v1/generate?grant_type=client_credentials", {
          headers: { Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}`, Accept: "application/json" }
        }, false);
        const lifetime = Number(body.expires_in);
        if (typeof body.access_token !== "string" || !body.access_token || !Number.isFinite(lifetime) || lifetime <= 0) throw new DarajaError("M-PESA authentication failed.");
        cachedToken = body.access_token;
        tokenExpiresAt = now() + Math.max(0, lifetime - 60) * 1000;
        return cachedToken;
      })().finally(() => { tokenRequest = null; });
    }
    return tokenRequest;
  }

  return {
    enabled: Boolean(config),
    environment: config?.environment || "sandbox",
    async push({ phone, amount, reference, callbackId, callbackToken, description = "Deposit" }) {
      if (!config) throw new DarajaError("M-PESA deposits are not configured yet.");
      const token = await accessToken();
      const timestamp = darajaTimestamp(new Date(now()));
      const response = await request("/mpesa/stkpush/v1/processrequest", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          BusinessShortCode: config.shortcode,
          Password: Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64"),
          Timestamp: timestamp, TransactionType: config.transactionType, Amount: amount,
          PartyA: phone, PartyB: config.partyB, PhoneNumber: phone,
          CallBackURL: `${config.callbackUrl}/${callbackId}/${callbackToken}`,
          AccountReference: reference, TransactionDesc: description
        })
      }, true);
      if (response.ResponseCode !== "0" && response.ResponseCode !== 0) {
        throw new DarajaError("M-PESA did not accept the payment request.", response.ResponseCode === undefined);
      }
      if (![response.MerchantRequestID, response.CheckoutRequestID].every(value => typeof value === "string" && value.length > 0 && value.length <= 128)) {
        throw new DarajaError("M-PESA did not return payment tracking IDs. Check your payment status before retrying.", true);
      }
      return { merchantRequestId: response.MerchantRequestID, checkoutRequestId: response.CheckoutRequestID };
    }
  };
}

module.exports = { createDarajaClient, DarajaError, normalizePhone, stkPushSchema };
