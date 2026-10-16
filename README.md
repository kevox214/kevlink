# MULALINK

**Earn more. Every day.**

A responsive MULALINK prototype with a Node.js/Express authentication foundation and PostgreSQL account storage.

## Run locally

1. Install Node.js 20+ and PostgreSQL 13+.
2. Create a PostgreSQL database and user, for example in `psql`:
   ```sql
   CREATE USER mulalink WITH PASSWORD 'replace-with-a-strong-password';
   CREATE DATABASE mulalink OWNER mulalink;
   ```
3. Copy `.env.example` to `.env` and set `DATABASE_URL` to the local PostgreSQL connection string.
4. In PowerShell, run `npm.cmd install`, then `npm.cmd start`.
5. Open `http://localhost:3000/register` to create an account, or `http://localhost:3000/login` to sign in.

The server applies the SQL migrations on startup. Keep `.env` private and use a strong database password. Admins sign in from the same login page by selecting **Sign in as admin**; a signed-in administrator is sent to `/admin`.
Run `npm.cmd test` to run the validation and API tests. API tests use a database mock; configure PostgreSQL to run the server against a real database.

## Prototype features

- Responsive dashboard and collapsible mobile navigation.
- Dedicated pages for the requested earning, marketplace, wallet, and account sections.
- PostgreSQL registration/login endpoints, password hashing, input validation, login throttling, and HTTP-only session cookies.
- Newly registered member accounts remain pending and cannot access the dashboard or account APIs until an administrator activates them.
- Role-protected admin console for member search/status management and internal payment, payout, commission, and transaction records.
- Admin task listings with editable prices/status and a client purchase register with quantity and price snapshots.
- Administrator audit log for account-status, task/pricing, financial-record, and purchase-record changes.
- A separate, centered login design and split-layout registration page.
- Empty states, safety disclosures, and demo-mode indicators.
- Profile and notification preference edits saved to browser `localStorage` in demo mode.
- Earnings summary and chart derived from confirmed demo ledger records; a fresh profile starts at **KES 0.00**.
- No payment gateway, loan provider, betting, email/SMS verification, or social-platform integration.
- Admin financial records are internal tracking entries only. Approvals and rejections do not transfer money or update member wallet balances.
- Admin-created task prices are listings only; client-purchase entries are manually recorded internal reports, not proof of payment or a checkout flow.

## Production-readiness

The registration and administration backend is an initial foundation, **not a production-ready platform**. Email/phone verification, password recovery, account deletion, and operational monitoring are not implemented. Admin financial records are not a payment ledger and do not verify or execute real payments. The linked Terms and Privacy pages are explicit draft placeholders and must be replaced with legally reviewed documents before collecting real user details.

Wallet, earnings, payments, tasks, loans, and other product features remain demo-only. A production implementation needs a transactional financial ledger, provider-verified payment callbacks, data-protection controls, moderation, and operational support. Lending, payments, social campaigns, health data, dating, and betting-related features require appropriate legal review and authorized providers before they are enabled. Never use this front-end or its internal admin records as the authority for balances, eligibility, approvals, or payouts.
