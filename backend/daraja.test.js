"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDarajaClient, DarajaError, normalizePhone, stkPushSchema } = require("./daraja");

const env = {
  DARAJA_ENV: "sandbox", DARAJA_CONSUMER_KEY: "consumer", DARAJA_CONSUMER_SECRET: "secret",
  DARAJA_SHORTCODE: "174379", DARAJA_PASSKEY: "passkey",
  DARAJA_CALLBACK_URL: "https://payments.example.com/api/payments/mpesa/callback"
};
const payment = { phone: "254712345678", amount: 100, reference: "ML1234567890", callbackId: "payment-id", callbackToken: "private-token" };
const accepted = { ResponseCode: "0", MerchantRequestID: "merchant-1", CheckoutRequestID: "checkout-1" };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("normalizes Kenyan mobile numbers and rejects invalid phones and amounts", () => {
  for (const phone of ["0712345678", "+254 712 345 678", "254712345678", "(0712) 345-678"]) assert.equal(normalizePhone(phone), "254712345678");
  assert.equal(normalizePhone("0112345678"), "254112345678");
  for (const phone of ["712345678", "254212345678", "071234567", "++254712345678", null]) assert.equal(normalizePhone(phone), null);
  for (const amount of [0, -1, 1.5, 250001, "100", null, true]) assert.equal(stkPushSchema.safeParse({ phone: "0712345678", amount }).success, false);
  assert.deepEqual(stkPushSchema.parse({ phone: "+254712345678", amount: 100 }), { phone: "254712345678", amount: 100 });
  assert.equal(stkPushSchema.safeParse({ phone: "0712345678", amount: 100, userId: "another-user" }).success, false);
});

test("stays disabled without credentials and rejects invalid configured environments and callbacks", async () => {
  const client = createDarajaClient({ env: {} });
  assert.equal(client.enabled, false);
  await assert.rejects(client.push(payment), /not configured/);
  for (const override of [
    { DARAJA_ENV: "live" }, { DARAJA_SHORTCODE: "123x" }, { DARAJA_TRANSACTION_TYPE: "invalid" },
    { DARAJA_CALLBACK_URL: "http://payments.example.com/api/payments/mpesa/callback" },
    { DARAJA_CALLBACK_URL: "https://localhost/api/payments/mpesa/callback" },
    { DARAJA_CALLBACK_URL: "https://payments.example.com/wrong-path" },
    { DARAJA_CALLBACK_URL: "https://payments.example.com/api/payments/mpesa/callback?secret=x" }
  ]) assert.throws(() => createDarajaClient({ env: { ...env, ...override } }));
});

test("uses Basic OAuth, Nairobi timestamps, encoded passwords, and cached expiring tokens", async () => {
  const calls = [];
  let time = Date.parse("2026-10-24T10:15:30Z");
  const client = createDarajaClient({ env, now: () => time, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return response(url.includes("oauth") ? { access_token: "test-access-token", expires_in: "3599" } : accepted);
  } });
  assert.deepEqual(await client.push(payment), { merchantRequestId: "merchant-1", checkoutRequestId: "checkout-1" });
  await client.push(payment);
  assert.equal(calls.filter(call => call.url.includes("oauth")).length, 1);
  assert.equal(calls[0].options.headers.Authorization, `Basic ${Buffer.from("consumer:secret").toString("base64")}`);
  assert.equal(calls[1].url, "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.Timestamp, "20261024131530");
  assert.equal(Buffer.from(body.Password, "base64").toString(), "174379passkey20261024131530");
  assert.equal(body.PartyA, payment.phone);
  assert.equal(body.PhoneNumber, payment.phone);
  assert.equal(body.PartyB, "174379");
  assert.equal(body.Amount, 100);
  assert.equal(body.CallBackURL, `${env.DARAJA_CALLBACK_URL}/payment-id/private-token`);
  assert.equal(body.AccountReference, payment.reference);
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-access-token");
  assert.equal(calls[1].options.redirect, "error");
  assert.ok(calls[1].options.signal instanceof AbortSignal);
  time += 3600 * 1000;
  await client.push(payment);
  assert.equal(calls.filter(call => call.url.includes("oauth")).length, 2);
});

test("shares concurrent OAuth requests and supports production Buy Goods with separate PartyB", async () => {
  let authCalls = 0;
  const client = createDarajaClient({ env: { ...env, DARAJA_ENV: "production", DARAJA_TRANSACTION_TYPE: "CustomerBuyGoodsOnline", DARAJA_PARTY_B: "1234567" }, fetchImpl: async (url, options) => {
    assert.ok(url.startsWith("https://api.safaricom.co.ke/"));
    if (url.includes("oauth")) {
      authCalls++;
      return response({ access_token: "token", expires_in: 3599 });
    }
    const body = JSON.parse(options.body);
    assert.equal(body.TransactionType, "CustomerBuyGoodsOnline");
    assert.equal(body.BusinessShortCode, "174379");
    assert.equal(body.PartyB, "1234567");
    return response(accepted);
  } });
  await Promise.all([client.push(payment), client.push(payment)]);
  assert.equal(authCalls, 1);
});

test("supports the configured MPESA environment variables and activation callback path", async () => {
  const aliases = {
    MPESA_ENVIRONMENT: "production", MPESA_CONSUMER_KEY: "key", MPESA_CONSUMER_SECRET: "secret",
    MPESA_SHORTCODE: "174379", MPESA_PASSKEY: "passkey",
    MPESA_STK_CALLBACK_URL: "https://payments.example.com/api/payments/mpesa/activation-callback"
  };
  const client = createDarajaClient({ env: aliases, fetchImpl: async (url, options) => {
    if (url.includes("oauth")) return response({ access_token: "token", expires_in: 3599 });
    const body = JSON.parse(options.body);
    assert.equal(body.TransactionDesc, "Activation");
    assert.ok(body.CallBackURL.startsWith(`${aliases.MPESA_STK_CALLBACK_URL}/`));
    return response(accepted);
  } });
  assert.equal(client.environment, "production");
  await client.push({ ...payment, description: "Activation" });
});

test("distinguishes rejected requests from ambiguous STK outcomes without retrying pushes", async () => {
  for (const [result, uncertain] of [
    [() => response({ errorCode: "bad-request" }, 400), false],
    [() => response({ errorCode: "busy" }, 503), true],
    [() => response({ ResponseCode: "1" }), false],
    [() => response({ ResponseCode: "0" }), true],
    [() => new Response("invalid json"), true],
    [() => { throw new Error("network timeout"); }, true]
  ]) {
    let pushes = 0;
    const client = createDarajaClient({ env, fetchImpl: async url => {
      if (url.includes("oauth")) return response({ access_token: "token", expires_in: 3599 });
      pushes++;
      return result();
    } });
    await assert.rejects(client.push(payment), error => error instanceof DarajaError && error.uncertain === uncertain);
    assert.equal(pushes, 1);
  }
  const client = createDarajaClient({ env, fetchImpl: async () => { throw new Error("secret provider error"); } });
  await assert.rejects(client.push(payment), error => error.uncertain === false && !error.message.includes("secret"));
});

test("refreshes invalidated OAuth credentials on the next request without resending a failed push", async () => {
  let authCalls = 0;
  let pushes = 0;
  const client = createDarajaClient({ env, fetchImpl: async url => {
    if (url.includes("oauth")) {
      authCalls++;
      return response({ access_token: `token-${authCalls}`, expires_in: 3599 });
    }
    pushes++;
    return pushes === 1 ? response({ errorCode: "404.001.03" }, 404) : response(accepted);
  } });
  await assert.rejects(client.push(payment), DarajaError);
  assert.equal(pushes, 1);
  await client.push(payment);
  assert.equal(authCalls, 2);
  assert.equal(pushes, 2);
});
