"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loginSchema, registrationSchema } = require("./auth-validation");

const validRegistration = {
  fullName: "Amina Wekesa",
  username: "amina_wekesa",
  email: "amina@example.com",
  phone: "+254712345678",
  password: "correct horse battery",
  confirmPassword: "correct horse battery",
  referralCode: "TEAM-2026",
  acceptedTerms: true
};

test("accepts a valid registration", () => {
  assert.equal(registrationSchema.safeParse(validRegistration).success, true);
});

test("normalizes email and trims full name", () => {
  const result = registrationSchema.safeParse({ ...validRegistration, fullName: "  Amina Wekesa ", username: " Amina.WeKesa ", email: " amina@example.com " });
  assert.equal(result.success, true);
  assert.equal(result.data.fullName, "Amina Wekesa");
  assert.equal(result.data.username, "amina.wekesa");
  assert.equal(result.data.email, "amina@example.com");
});

test("accepts a registration without a date of birth", () => {
  assert.equal(registrationSchema.safeParse(validRegistration).success, true);
});

test("rejects mismatched passwords, weak passwords, and missing consent", () => {
  assert.equal(registrationSchema.safeParse({ ...validRegistration, confirmPassword: "different password" }).success, false);
  assert.equal(registrationSchema.safeParse({ ...validRegistration, password: "sht", confirmPassword: "sht" }).success, false);
  assert.equal(registrationSchema.safeParse({ ...validRegistration, acceptedTerms: false }).success, false);
});

test("requires a normalized international phone number", () => {
  assert.equal(registrationSchema.safeParse({ ...validRegistration, phone: "0712345678" }).success, false);
});

test("requires a valid username", () => {
  assert.equal(registrationSchema.safeParse({ ...validRegistration, username: "ab" }).success, false);
  assert.equal(registrationSchema.safeParse({ ...validRegistration, username: "name with spaces" }).success, false);
});

test("validates login credentials", () => {
  assert.equal(loginSchema.safeParse({ identifier: "amina@example.com", password: "secret" }).success, true);
  assert.equal(loginSchema.safeParse({ identifier: "admin@mulalink.com", password: "Admin@2026", role: "admin" }).success, true);
  assert.equal(loginSchema.safeParse({ identifier: "", password: "" }).success, false);
});
