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

## Daraja account activation

For testing, registration automatically initiates a **KES 1** STK Push to the phone number saved on the new account, then redirects to **/account-pending** to await confirmation. Their existing sign-in session permits activation status/payment requests, while the dashboard and other account APIs remain locked. Both the registered phone number and KES 1 test amount come from the server. The API rejects client-supplied phones and amounts. The activation fee does not credit the demo wallet.

Configure M-PESA using the following settings in the private .env file:

| Setting | Purpose | Supported alias |
| --- | --- | --- |
| MPESA_ENVIRONMENT | sandbox or production | DARAJA_ENV |
| MPESA_CONSUMER_KEY | Daraja application Consumer Key | DARAJA_CONSUMER_KEY |
| MPESA_CONSUMER_SECRET | Daraja application Consumer Secret | DARAJA_CONSUMER_SECRET |
| MPESA_SHORTCODE | PayBill or HO/store short code | DARAJA_SHORTCODE |
| MPESA_PASSKEY | Lipa na M-PESA passkey | DARAJA_PASSKEY |
| MPESA_STK_CALLBACK_URL | Public HTTPS URL ending in /api/payments/mpesa/activation-callback or /api/payments/mpesa/callback | DARAJA_CALLBACK_URL |
| MPESA_TRANSACTION_TYPE | CustomerPayBillOnline (default) or CustomerBuyGoodsOnline | DARAJA_TRANSACTION_TYPE |
| MPESA_PARTY_B | Till number for Buy Goods; defaults to short code for PayBill | DARAJA_PARTY_B |

Obtain credentials and the M-PESA Express product from the [Safaricom developer portal](https://developer.safaricom.co.ke/apis/MpesaExpressSimulate). Forward the configured callback path, including the payment ID and random token appended by the server, to this Express app. Keep full callback URLs out of access logs and analytics. Restart the server after changing settings; migrations run automatically.

1. Register a member with their M-PESA phone number. Creating the account automatically sends a KES 1 test prompt; no separate payment button is required.
2. The activation page shows the saved phone and payment status. If a request failed or was cancelled, use **Resend KES 1 prompt** to retry on the same registered number.
3. Approve the prompt on the phone. An accepted prompt does not activate the account.
4. A successful production callback must match the payment IDs, phone, amount, and receipt metadata. The server records the successful activation payment and activates the pending account in one PostgreSQL transaction. The page detects activation and opens the dashboard automatically.

Sandbox confirmations are test records and **never unlock an account**. An account suspended/restricted while payment is pending remains restricted after confirmation. Admins cannot mark an unpaid member active; a successful production activation payment is required. Existing active accounts are left unchanged by the migration.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | /api/payments/mpesa/activation | Requires a signed-in, unrestricted session, including unpaid accounts. Returns account status, fixed fee, provider availability, and activation payment history. |
| POST | /api/payments/mpesa/activation/stk-push | Same session requirement, pending member accounts only. JSON body: {}. The server uses the saved registration phone. Requires a UUID Idempotency-Key header. Limited to three requests per member per minute. |
| POST | /api/payments/mpesa/activation-callback/:id/:token | Private callback supplied to Daraja. The original /callback/:id/:token path is also supported. |
| GET | /api/payments/mpesa | Active accounts only. Preserves historical payment records. |

Retry an interrupted request with the same idempotency key. A database uniqueness rule also prevents another unresolved or successful activation request for the same member/environment, even with a new key or phone. Cancelled/failed requests may be retried. Ambiguous provider timeouts remain awaiting confirmation and must not trigger a new charge. Duplicate callbacks cannot apply activation twice. The former generic wallet STK endpoint returns HTTP 410; payments now belong to account activation.

The callback uses a per-payment random secret URL, row locking, and unique receipts. Daraja callbacks are not digitally signed; this is not independent transaction reconciliation. If a callback never arrives, check the M-PESA organization portal/provider records before resolving the payment; there is no background status-query worker. Keep credentials private. Registration and activation tests mock Daraja. A real KES 1 prompt is initiated automatically when a member registers with configured production credentials. Historical KES 100 requests retain their original amount; successful historical activation callbacks remain supported.

For a Till, configure **CustomerBuyGoodsOnline** and use the approved HO/store short code associated with the Daraja passkey as **MPESA_SHORTCODE**. Use the receiving Till as **MPESA_PARTY_B**. A callback reporting **2002: Agent number and Store number entered do not match** means M-PESA rejected the merchant pairing, even if the phone prompt appeared; the account must remain pending. Verify those merchant details before retrying. The local callback tunnel and Express server must both remain running. If a temporary tunnel URL changes, update the private callback setting and restart Express before sending another prompt.

## Prototype features

- Responsive dashboard and collapsible mobile navigation.
- Dedicated pages for the requested earning, marketplace, wallet, and account sections.
- PostgreSQL registration/login endpoints, password hashing, input validation, login throttling, and HTTP-only session cookies.
- Newly registered member accounts remain pending until their one-time KES 1 M-PESA activation payment is confirmed.
- Role-protected admin console for member search/status management and internal payment, payout, commission, and transaction records.
- Admin task listings with editable prices/status and a client purchase register with quantity and price snapshots.
- Administrator audit log for account-status, task/pricing, financial-record, and purchase-record changes.
- A separate, centered login design and split-layout registration page.
- Empty states, safety disclosures, and demo-mode indicators.
- Profile and notification preference edits saved to browser `localStorage` in demo mode.
- Earnings summary and chart derived from confirmed demo ledger records; a fresh profile starts at **KES 0.00**.
- Daraja M-PESA Express account activation with a fixed KES 1 fee, persisted requests, private callbacks, duplicate protection, status polling, and receipts.
- No loan provider, betting, email/SMS verification, or social-platform integration.
- Admin financial records are internal tracking entries only. Approvals and rejections do not transfer money or update member wallet balances.
- Admin-created task prices are listings only; client-purchase entries are manually recorded internal reports, not proof of payment or a checkout flow.

## Production-readiness

The registration and administration backend is an initial foundation, **not a production-ready platform**. Email/phone verification, password recovery, account deletion, and operational monitoring are not implemented. Admin financial records are not a payment ledger and do not verify or execute real payments. The linked Terms and Privacy pages are explicit draft placeholders and must be replaced with legally reviewed documents before collecting real user details.

Wallet balances, earnings, tasks, loans, and other product features remain demo-only. M-PESA STK Push collects the one-time KES 1 account activation fee when configured with production credentials; this does not credit the demo wallet. A production wallet needs a transactional financial ledger, independent payment reconciliation, data-protection controls, moderation, and operational support. Lending, payments, social campaigns, health data, dating, and betting-related features require appropriate legal review and authorized providers before they are enabled. Never use this front-end or its internal admin records as the authority for balances, eligibility, approvals, or payouts.
