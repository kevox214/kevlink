(() => {
  "use strict";
  const endpoint = "/api/payments/mpesa/activation";
  const form = document.getElementById("activation-form");
  const phone = document.getElementById("activation-phone");
  const submit = document.getElementById("activation-submit");
  const message = document.getElementById("activation-message");
  const receipt = document.getElementById("activation-receipt");
  const check = document.getElementById("check-activation");
  let settings;
  let loading = false;
  let submitting = false;
  let attempt;

  const currentPayment = () => settings?.payments.find(payment => payment.environment === settings.environment);
  const awaitingPayment = () => ["initiating", "pending", "unknown"].includes(currentPayment()?.status);
  const settled = () => currentPayment()?.status === "succeeded";
  function update() {
    submit.disabled = !settings?.enabled || loading || submitting || awaitingPayment() || settled();
    submit.textContent = submitting ? "Sending M-PESA prompt…" : "Resend KES 1 prompt";
    check.disabled = loading;
  }
  async function loadStatus() {
    if (loading) return;
    loading = true;
    update();
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check your activation status.");
      settings = data;
      if (settings.user.accountStatus === "active") {
        message.textContent = "Payment confirmed. Opening your dashboard…";
        window.location.assign("/");
        return;
      }
      if (!phone.value) phone.value = settings.user.phone || "";
      document.getElementById("activation-environment").textContent = settings.environment === "sandbox"
        ? "M-PESA sandbox: this is a test payment. A test confirmation does not activate an account."
        : "Check your registered phone for the KES 1 M-PESA activation test prompt.";
      const payment = currentPayment();
      receipt.hidden = !payment?.receipt;
      receipt.textContent = payment?.receipt ? `M-PESA receipt: ${payment.receipt}` : "";
      message.textContent = !settings.enabled ? "M-PESA activation payments are not configured yet. Please contact support."
        : settled() ? "Sandbox payment confirmed. Your account remains pending until a live activation payment is confirmed."
        : payment?.status === "unknown" ? "Your payment is awaiting confirmation. Check your M-PESA messages and refresh the status before paying again."
        : awaitingPayment() ? `A KES ${payment.amount} payment is awaiting confirmation for ${payment.phone}. Approve the M-PESA prompt on that phone.`
        : payment?.status === "failed" && [2002, 2029].includes(payment.resultCode) ? "The payment provider could not complete this request. Please contact support before trying again."
        : payment?.status === "failed" ? `${payment.resultDescription || "Payment was not completed."} You can try again.`
        : "Ready to send a KES 1 M-PESA prompt to your registered phone.";
    } catch (error) { message.textContent = error.message; }
    finally { loading = false; update(); }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled || !form.reportValidity()) return;
    const number = phone.value.trim();
    const storageKey = `mulalink-activation-${settings.user.id}`;
    try { attempt = JSON.parse(sessionStorage.getItem(storageKey) || "null") || attempt; } catch { /* Use the in-memory retry key if storage is unavailable. */ }
    if (!attempt || attempt.phone !== number) attempt = { key: crypto.randomUUID(), phone: number };
    try { sessionStorage.setItem(storageKey, JSON.stringify(attempt)); } catch { /* The in-memory key still prevents an automatic duplicate request. */ }
    submitting = true;
    update();
    message.textContent = "Sending a KES 1 M-PESA test prompt to your registered phone…";
    let failure;
    try {
      const response = await fetch(`${endpoint}/stk-push`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": attempt.key },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.payment) {
        settings.payments = [data.payment, ...settings.payments.filter(payment => payment.id !== data.payment.id)];
        attempt = null;
        try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
      }
      if (!response.ok) throw new Error(data.error || "Could not request the activation payment.");
    } catch (error) { failure = error.message; }
    finally {
      submitting = false;
      await loadStatus();
      if (failure) message.textContent = `${failure} Check your payment status before trying again.`;
      update();
    }
  });

  check.addEventListener("click", loadStatus);
  setInterval(() => { if (!document.hidden && awaitingPayment()) loadStatus(); }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadStatus(); });
  document.getElementById("sign-out-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Unable to sign out. Please try again.");
      window.location.assign("/login");
    } catch (error) { button.disabled = false; message.textContent = error.message; }
  });
  loadStatus();
})();
