"use strict";

(() => {
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const dateLabel = value => value ? new Date(value).toLocaleString() : "—";
  const amountLabel = (amount, currency) => `${escapeHtml(currency)} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const errorBox = $("#page-error");
  let members = [];
  let tasks = [];

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
      ...options
    });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.assign("/login");
      throw new Error("Your session ended. Please sign in again.");
    }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }

  function showError(error, target = errorBox) {
    target.textContent = error.message;
    target.hidden = false;
  }

  async function loadSummary() {
    const { summary } = await api("/api/admin/summary");
    $("#summary").innerHTML = [
      ["Total members", summary.total_users, "All registered member accounts"],
      ["Active members", summary.active_users, "Accounts with active status"],
      ["Pending review", summary.pending_records, "Internal financial records"],
      ["Approved records", summary.approved_records, (summary.approved_totals || []).length
        ? summary.approved_totals.map(total => `${total.type} ${amountLabel(total.amount, total.currency)}`).join(" · ")
        : "No approved internal records"]
    ].map(([label, value, detail]) => `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join("");
  }

  async function loadUsers(search = "") {
    const { users } = await api(`/api/admin/users?search=${encodeURIComponent(search)}`);
    members = users;
    $("#users-body").innerHTML = users.length ? users.map(user => `<tr>
      <td><strong>${escapeHtml(user.full_name)}</strong><small>@${escapeHtml(user.username || "—")}</small></td>
      <td>${escapeHtml(user.email)}<small>${escapeHtml(user.phone)}</small></td>
      <td><span class="status ${escapeHtml(user.account_status)}">${escapeHtml(user.account_status.replaceAll("_", " "))}</span></td>
      <td>${escapeHtml(dateLabel(user.created_at))}</td>
      <td><div class="row-actions"><select aria-label="Status for ${escapeHtml(user.full_name)}" data-user-status="${escapeHtml(user.id)}">
        ${["pending_verification", "active", "restricted", "suspended"].map(status => `<option value="${status}"${status === user.account_status ? " selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("")}
      </select><button class="button button-secondary" data-save-user="${escapeHtml(user.id)}">Save</button></div></td>
    </tr>`).join("") : '<tr><td colspan="5" class="empty">No matching member accounts.</td></tr>';
    $("#record-user").innerHTML = '<option value="">No member linked</option>' + users.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.full_name)} · ${escapeHtml(user.email)}</option>`).join("");
  }

  async function loadRecords() {
    const type = $("#record-type-filter").value;
    const status = $("#record-status-filter").value;
    const query = new URLSearchParams();
    if (type) query.set("type", type);
    if (status) query.set("status", status);
    const { records } = await api(`/api/admin/financial-records?${query}`);
    $("#records-body").innerHTML = records.length ? records.map(record => `<tr>
      <td><strong>${escapeHtml(record.record_type)}</strong><small>${escapeHtml(record.reference)}</small><small>${escapeHtml(record.description || "No description")}</small></td>
      <td>${escapeHtml(record.user_name || "Unlinked")}<small>${escapeHtml(record.user_email || "")}</small></td>
      <td>${amountLabel(record.amount, record.currency)}</td>
      <td><span class="status ${escapeHtml(record.status)}">${escapeHtml(record.status)}</span></td>
      <td>${escapeHtml(dateLabel(record.created_at))}</td>
      <td>${record.status === "pending" ? `<div class="row-actions"><button class="button button-secondary" data-review="${escapeHtml(record.id)}" data-status="approved">Approve</button><button class="button button-secondary button-danger" data-review="${escapeHtml(record.id)}" data-status="rejected">Reject</button></div>` : "Reviewed"}</td>
    </tr>`).join("") : '<tr><td colspan="6" class="empty">No financial records match these filters.</td></tr>';
  }

  async function loadTasks() {
    const { tasks: taskRows } = await api("/api/admin/tasks");
    tasks = taskRows;
    $("#tasks-body").innerHTML = tasks.length ? tasks.map(task => `<tr>
      <td><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.description || "No description")}</small></td>
      <td>${amountLabel(task.price, task.currency)}</td>
      <td><span class="status ${escapeHtml(task.status)}">${escapeHtml(task.status)}</span></td>
      <td>${escapeHtml(dateLabel(task.created_at))}</td>
      <td><button class="button button-secondary" data-edit-task="${escapeHtml(task.id)}">Edit / price</button></td>
    </tr>`).join("") : '<tr><td colspan="5" class="empty">No tasks created yet.</td></tr>';
    $("#purchase-task").innerHTML = '<option value="">Select an active task</option>' + tasks
      .filter(task => task.status === "active")
      .map(task => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)} · ${amountLabel(task.price, task.currency)}</option>`)
      .join("");
  }

  async function loadPurchases() {
    const status = $("#purchase-status-filter").value;
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    const { purchases } = await api(`/api/admin/purchases?${query}`);
    $("#purchases-body").innerHTML = purchases.length ? purchases.map(purchase => `<tr>
      <td><strong>${escapeHtml(purchase.reference)}</strong></td>
      <td>${escapeHtml(purchase.client_name || "Deleted client")}<small>${escapeHtml(purchase.client_email || "")}</small></td>
      <td>${escapeHtml(purchase.task_title)}</td>
      <td>${escapeHtml(purchase.quantity)} × ${amountLabel(purchase.unit_price, purchase.currency)}</td>
      <td>${amountLabel(purchase.total_amount, purchase.currency)}</td>
      <td><span class="status ${escapeHtml(purchase.status)}">${escapeHtml(purchase.status)}</span></td>
      <td>${escapeHtml(dateLabel(purchase.created_at))}</td>
      <td>${purchase.status === "pending" ? `<div class="row-actions"><button class="button button-secondary" data-purchase-status="recorded" data-purchase-id="${escapeHtml(purchase.id)}">Record</button><button class="button button-secondary button-danger" data-purchase-status="cancelled" data-purchase-id="${escapeHtml(purchase.id)}">Cancel</button></div>` : "—"}</td>
    </tr>`).join("") : '<tr><td colspan="8" class="empty">No client purchases match this filter.</td></tr>';
  }

  async function loadAudit() {
    const { entries } = await api("/api/admin/audit-log");
    $("#audit-body").innerHTML = entries.length ? entries.map(entry => `<tr>
      <td>${escapeHtml(dateLabel(entry.created_at))}</td><td>${escapeHtml(entry.actor_name || "Former administrator")}</td>
      <td><strong>${escapeHtml(entry.action.replaceAll(".", " "))}</strong></td>
      <td>${escapeHtml(entry.entity_type)}<small>${escapeHtml(entry.entity_id)}</small></td>
      <td>${escapeHtml(JSON.stringify(entry.details || {}))}</td>
    </tr>`).join("") : '<tr><td colspan="5" class="empty">No administrator activity has been recorded.</td></tr>';
  }

  async function refresh() {
    errorBox.hidden = true;
    try {
      await Promise.all([loadSummary(), loadUsers(), loadRecords(), loadTasks(), loadPurchases(), loadAudit()]);
    } catch (error) {
      showError(error);
    }
  }

  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", async () => {
    document.querySelectorAll("[data-tab]").forEach(tab => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".tab-panel").forEach(panel => { panel.hidden = panel.id !== `${button.dataset.tab}-panel`; });
    try {
      if (button.dataset.tab === "audit") await loadAudit();
      if (button.dataset.tab === "records") await loadRecords();
      if (button.dataset.tab === "users") await loadUsers($("#user-search").elements.search.value);
      if (button.dataset.tab === "tasks") await loadTasks();
      if (button.dataset.tab === "purchases") await Promise.all([loadPurchases(), loadUsers(), loadTasks()]);
    } catch (error) { showError(error); }
  }));

  $("#user-search").addEventListener("submit", async event => {
    event.preventDefault();
    try { await loadUsers(event.currentTarget.elements.search.value.trim()); }
    catch (error) { showError(error); }
  });

  $("#users-body").addEventListener("click", async event => {
    const button = event.target.closest("[data-save-user]");
    if (!button) return;
    const id = button.dataset.saveUser;
    const status = $(`[data-user-status="${CSS.escape(id)}"]`).value;
    button.disabled = true;
    try {
      await api(`/api/admin/users/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await Promise.all([loadUsers($("#user-search").elements.search.value.trim()), loadSummary(), loadAudit()]);
    } catch (error) { showError(error); }
    finally { button.disabled = false; }
  });

  $("#records-body").addEventListener("click", async event => {
    const button = event.target.closest("[data-review]");
    if (!button) return;
    button.disabled = true;
    try {
      await api(`/api/admin/financial-records/${encodeURIComponent(button.dataset.review)}/status`, {
        method: "PATCH", body: JSON.stringify({ status: button.dataset.status })
      });
      await Promise.all([loadRecords(), loadSummary(), loadAudit()]);
    } catch (error) { showError(error); }
  });

  $("#record-type-filter").addEventListener("change", () => loadRecords().catch(showError));
  $("#record-status-filter").addEventListener("change", () => loadRecords().catch(showError));
  $("#purchase-status-filter").addEventListener("change", () => loadPurchases().catch(showError));

  const taskDialog = $("#task-dialog");
  const taskForm = $("#task-form");
  function openTaskDialog(task = null) {
    taskForm.reset();
    taskForm.elements.taskId.value = task?.id || "";
    taskForm.elements.title.value = task?.title || "";
    taskForm.elements.description.value = task?.description || "";
    taskForm.elements.price.value = task?.price || "";
    taskForm.elements.currency.value = task?.currency || "KES";
    taskForm.elements.status.value = task?.status || "active";
    $("#task-dialog-title").textContent = task ? "Edit task and pricing" : "Create task";
    $("#task-form-error").hidden = true;
    taskDialog.showModal();
  }
  $("#new-task").addEventListener("click", () => openTaskDialog());
  $("#close-task-dialog").addEventListener("click", () => taskDialog.close());
  $("#cancel-task-dialog").addEventListener("click", () => taskDialog.close());
  taskDialog.addEventListener("click", event => { if (event.target === taskDialog) taskDialog.close(); });
  $("#tasks-body").addEventListener("click", event => {
    const button = event.target.closest("[data-edit-task]");
    if (button) openTaskDialog(tasks.find(task => task.id === button.dataset.editTask));
  });
  taskForm.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = taskForm.querySelector('[type="submit"]');
    const taskId = taskForm.elements.taskId.value;
    const taskFormError = $("#task-form-error");
    taskFormError.hidden = true;
    submit.disabled = true;
    try {
      const values = new FormData(taskForm);
      const body = JSON.stringify({
        title: values.get("title"),
        description: values.get("description"),
        price: Number(values.get("price")),
        currency: values.get("currency"),
        status: values.get("status")
      });
      await api(taskId ? `/api/admin/tasks/${encodeURIComponent(taskId)}` : "/api/admin/tasks", {
        method: taskId ? "PATCH" : "POST",
        body
      });
      taskDialog.close();
      await Promise.all([loadTasks(), loadAudit()]);
    } catch (error) { showError(error, taskFormError); }
    finally { submit.disabled = false; }
  });

  const purchaseDialog = $("#purchase-dialog");
  const purchaseForm = $("#purchase-form");
  $("#new-purchase").addEventListener("click", async () => {
    const purchaseError = $("#purchase-form-error");
    purchaseError.hidden = true;
    try {
      await Promise.all([loadUsers(), loadTasks()]);
      if (!members.length) throw new Error("Create a client account before recording a purchase.");
      if (!tasks.some(task => task.status === "active")) throw new Error("Create or activate a task before recording a purchase.");
      purchaseForm.reset();
      purchaseForm.elements.quantity.value = "1";
      purchaseDialog.showModal();
    } catch (error) { showError(error); }
  });
  $("#close-purchase-dialog").addEventListener("click", () => purchaseDialog.close());
  $("#cancel-purchase-dialog").addEventListener("click", () => purchaseDialog.close());
  purchaseDialog.addEventListener("click", event => { if (event.target === purchaseDialog) purchaseDialog.close(); });
  purchaseForm.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = purchaseForm.querySelector('[type="submit"]');
    const purchaseError = $("#purchase-form-error");
    purchaseError.hidden = true;
    submit.disabled = true;
    try {
      const values = new FormData(purchaseForm);
      await api("/api/admin/purchases", {
        method: "POST",
        body: JSON.stringify({
          userId: values.get("userId"),
          taskId: values.get("taskId"),
          quantity: Number(values.get("quantity"))
        })
      });
      purchaseDialog.close();
      await Promise.all([loadPurchases(), loadAudit()]);
    } catch (error) { showError(error, purchaseError); }
    finally { submit.disabled = false; }
  });
  $("#purchases-body").addEventListener("click", async event => {
    const button = event.target.closest("[data-purchase-status]");
    if (!button) return;
    button.disabled = true;
    try {
      await api(`/api/admin/purchases/${encodeURIComponent(button.dataset.purchaseId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: button.dataset.purchaseStatus })
      });
      await Promise.all([loadPurchases(), loadAudit()]);
    } catch (error) { showError(error); }
  });

  const dialog = $("#record-dialog");
  $("#new-record").addEventListener("click", () => { $("#form-error").hidden = true; dialog.showModal(); });
  $("#close-dialog").addEventListener("click", () => dialog.close());
  $("#cancel-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  $("#record-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const formError = $("#form-error");
    formError.hidden = true;
    submit.disabled = true;
    try {
      const values = new FormData(form);
      await api("/api/admin/financial-records", {
        method: "POST",
        body: JSON.stringify({
          type: values.get("type"),
          userId: values.get("userId") || null,
          amount: Number(values.get("amount")),
          currency: values.get("currency"),
          description: values.get("description")
        })
      });
      form.reset();
      dialog.close();
      await Promise.all([loadRecords(), loadSummary(), loadAudit()]);
    } catch (error) { showError(error, formError); }
    finally { submit.disabled = false; }
  });
  $("#sign-out").addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); }
    catch (error) { showError(error); }
  });

  refresh();
})();
