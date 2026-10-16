"use strict";

const { z } = require("zod");

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(100, "Full name must be 100 characters or fewer."),
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(30, "Username must be 30 characters or fewer.").regex(/^[A-Za-z0-9._]+$/, "Username can only contain letters, numbers, periods, and underscores.").transform(value => value.toLowerCase()),
  email: z.string().trim().email("Enter a valid email address.").max(254, "Email address is too long."),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Enter your phone number in international format, such as +254712345678."),
  password: z.string().min(5, "Password must be at least 5 characters.").refine(value => Buffer.byteLength(value, "utf8") <= 72, "Password must be no more than 72 bytes."),
  confirmPassword: z.string().min(1, "Confirm your password."),
  referralCode: z.string().trim().max(32, "Referral code must be 32 characters or fewer.").regex(/^[A-Za-z0-9_-]*$/, "Referral code contains invalid characters.").optional(),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: "Accept the terms and privacy policy to continue." }) })
}).refine(data => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Your passwords do not match."
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number.").max(254, "Email or phone number is too long."),
  password: z.string().min(1, "Enter your password.").max(128, "Invalid credentials."),
  role: z.enum(["user", "admin"]).optional().default("user")
});

module.exports = { loginSchema, registrationSchema };
