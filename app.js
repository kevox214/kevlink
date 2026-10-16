(() => {
  "use strict";

  const navigation = [
    { group: "Main", items: [
      ["dashboard", "Dashboard", "⌂"], ["tournaments", "Tournaments", "♜"], ["team", "Team", "♧"],
      ["site-tasks", "Site Tasks", "✓"], ["hotel-reviews", "Hotel Reviews", "⌂"], ["teach-swahili", "Teach Swahili", "文"],
      ["chat-foreigners", "Chat Foreigners", "◌"], ["instant-loans", "Instant Loans", "▤"], ["products", "Products", "◇"],
      ["tiktok-earn", "TikTok Earn", "♪"], ["youtube-earn", "YouTube Earn", "▷"], ["apps-rating", "Apps Rating", "▦"],
      ["site-surveys", "Site Surveys", "☷"], ["walk-and-earn", "Walk & Earn", "↗"], ["ai-training", "AI Training", "✳"],
      ["spin-wheel", "Spin Wheel", "◉"], ["forex-trading", "Forex Trading", "⌁"], ["y99", "Y99", "◎"],
      ["dating-site", "Dating Site", "♡"], ["fix-odds", "Fix Odds", "◈"]
    ] },
    { group: "Wallet", items: [
      ["wallet-overview", "Wallet Overview", "▣"], ["withdraw", "Withdraw", "↗"], ["payout-history", "Payout History", "↶"],
      ["deposit", "Deposit", "+"], ["transactions", "Transactions", "⇄"], ["bonuses", "Bonuses", "✧"], ["my-commissions", "My Commissions", "%"]
    ] },
    { group: "Account", items: [
      ["profile", "Profile", "♙"], ["pay-for-a-client", "Pay for a Client", "▤"], ["accounts", "Accounts", "▣"],
      ["notifications", "Notifications", "♧"], ["help-and-support", "Help and Support", "?"], ["sign-out", "Sign Out", "↪"]
    ] }
  ];

  const opportunities = [
    { title: "Swahili conversation practice", category: "LEARNING", icon: "文", reward: "KES 250", description: "Practice with a learner and build your tutoring experience.", time: "20–30 min", page: "teach-swahili" },
    { title: "Test a new mobile app", category: "APP TESTING", icon: "▦", reward: "KES 120", description: "Explore a product prototype and share honest usability feedback.", time: "10–15 min", page: "apps-rating" },
    { title: "Short research survey", category: "SURVEYS", icon: "☷", reward: "KES 80", description: "Share your opinion in a short, eligibility-based research survey.", time: "5–8 min", page: "site-surveys" }
  ];

  const pageDetails = {
    tournaments: ["Compete & win", "Join community challenges, follow the rules, and track verified results.", "Browse tournaments", "♜", "No tournaments available yet", "Approved competitions will appear here when they are published."],
    team: ["Grow your network", "Invite friends and see eligible referral activity and commissions in one place.", "Copy referral link", "♧", "Your team starts here", "Your personal referral link is ready. Referral rewards are only credited for verified, eligible activity."],
    "site-tasks": ["Small tasks, meaningful progress", "Explore approved tasks, review their instructions, and submit work for review.", "Browse tasks", "✓", "No tasks available", "New tasks will appear here when they are published. Rewards are subject to review."],
    "hotel-reviews": ["Share genuine travel experiences", "Browse stays and provide honest feedback based on a real visit.", "Explore stays", "⌂", "No review opportunities", "There are no properties available to review right now. We never ask for fabricated or misleading reviews."],
    "teach-swahili": ["Share the beauty of Swahili", "Learn, teach, and practice through lessons and language exchanges.", "Explore lessons", "文", "No lessons scheduled", "Lessons and tutor profiles will appear here when available."],
    "chat-foreigners": ["Connect across languages", "Practice a language with respectful conversation and clear safety controls.", "Find a conversation", "◌", "No conversations yet", "When you connect with a language partner, your conversations will appear here."],
    "instant-loans": ["Understand your options", "Learn about application requirements and see clear terms before applying.", "Learn about eligibility", "▤", "No loan applications", "There are no loan applications in this demo. Any real lending service requires an authorized provider and separate compliance review."],
    products: ["Discover the marketplace", "Browse approved products, services, and digital goods from sellers.", "Browse products", "◇", "The marketplace is getting ready", "Approved products and services will appear here when sellers are onboarded."],
    "tiktok-earn": ["Creator campaigns", "Take part in legitimate, approved creator campaigns and submit eligible evidence.", "View campaigns", "♪", "No campaigns available", "Approved campaigns will appear here when available. Artificial engagement, fake followers, and spam are not supported."],
    "youtube-earn": ["Create with purpose", "Explore eligible creator challenges and educational content campaigns.", "View campaigns", "▷", "No creator campaigns yet", "Campaigns will appear here when available. Fake views, subscribers, and engagement are not supported."],
    "apps-rating": ["Test products honestly", "Help teams improve apps through genuine testing and actionable feedback.", "View testing projects", "▦", "No testing projects", "App testing projects will appear here when available. This is usability testing, not paid app-store ratings."],
    "site-surveys": ["Your opinion matters", "Review survey topics, estimated time, eligibility, and reward details before starting.", "Find a survey", "☷", "No eligible surveys", "Survey opportunities will appear here when a provider makes them available."],
    "walk-and-earn": ["Make every step count", "Track activity from a supported health platform and explore daily challenges.", "View activity", "↗", "No activity recorded", "Connect an authorized health or fitness service to track your steps. No health data is read in this demo."],
    "ai-training": ["Help improve AI responsibly", "Contribute to clearly scoped annotation, evaluation, and language projects.", "Explore projects", "✳", "No projects available", "Approved projects will appear here. Only contribute data that you are authorized to share."],
    "spin-wheel": ["Daily rewards", "Review participation rules and eligible rewards before each daily spin.", "View reward rules", "◉", "Your next spin awaits", "A real reward would only be credited after server-side eligibility checks and transaction confirmation."],
    "forex-trading": ["Learn the markets", "Explore risk-aware lessons, market concepts, and a practice trading journal.", "Start learning", "⌁", "Your learning journey starts here", "Educational content only. No live market data, real-money trading, or investment advice is provided in this demo."],
    y99: ["Y99 community", "A configurable destination for an authorized Y99 service or community.", "View safety guide", "◎", "Service destination not configured", "An administrator can set an authorized destination and publish account-safety guidance."],
    "dating-site": ["Meet with care", "A social discovery space designed around consent, privacy, and safety.", "Explore profiles", "♡", "No profiles to show", "Profiles appear only after age, privacy, and moderation controls are configured."],
    "fix-odds": ["Sports information", "Explore fixture information and analysis from authorized data providers.", "View fixtures", "◈", "No fixtures available", "Authorized sports information is not connected. No odds or predictions are fabricated in this demo."],
    "wallet-overview": ["Your wallet", "See verified balance activity, available funds, and financial records.", "Download statement", "▣", "No wallet activity yet", "Your available and pending balances are KES 0.00 until confirmed transactions are recorded."],
    withdraw: ["Withdraw funds", "Review supported payout methods, minimums, fees, and request status.", "Request a withdrawal", "↗", "No withdrawal requests", "Payouts are disabled in this prototype. A live service needs a verified ledger and authorized payment provider."],
    "payout-history": ["Payout history", "Review the status and references of your withdrawal requests.", "View payout history", "↶", "No payouts yet", "Completed and pending payouts will appear here after verified transactions."],
    deposit: ["Add funds", "Review secure payment methods and track confirmed deposits.", "View payment methods", "+", "No deposits recorded", "Deposits are disabled in this prototype. Never send money to an unverified payment destination."],
    transactions: ["Transaction history", "A clear record of wallet credits, debits, and reversals.", "View transactions", "⇄", "No transactions yet", "Confirmed wallet activity will appear here with a unique transaction reference."],
    bonuses: ["Rewards & bonuses", "See bonus rules, eligibility, expiry dates, and approved reward history.", "Explore rewards", "✧", "No available bonuses", "Eligible bonuses will appear here when configured by an authorized administrator."],
    "my-commissions": ["Commission statements", "Track direct and indirect commissions and their review status.", "View commission rules", "%", "No commissions yet", "Commissions are only recorded for eligible, verified activity."],
    profile: ["Your profile", "Manage personal details, account verification, and privacy settings.", "Edit profile", "♙", "Profile settings", "Your profile information is stored only in this browser demo and is not submitted to a server."],
    "pay-for-a-client": ["Client payments", "Create an authorized payment request with a clear audit trail.", "Create payment request", "▤", "No client payments", "Client payments are disabled in this prototype. A live workflow must verify authorization and payment provider callbacks."],
    accounts: ["Account security", "Manage linked accounts, sessions, and security preferences.", "Review security", "▣", "No linked accounts", "Authentication and linked-account management require a secure backend and are not active in this prototype."],
    notifications: ["Stay in the loop", "Manage updates about security, tasks, payouts, and community activity.", "Manage preferences", "♧", "You're all caught up", "There are no notifications in this new demo account."],
    "help-and-support": ["How can we help?", "Find answers, get account guidance, or contact the support team.", "Create a support ticket", "?", "No support tickets", "Support messages are not sent in this prototype. Connect a support service before launch."]
  };

  const STORAGE_KEY = "mulalink-prototype-state-v1";
  const defaults = { range: "week", transactions: [], profile: { name: "Jane Mwangi", email: "", phone: "", country: "Kenya", currency: "KES" }, notifications: { security: true, activity: true, product: false } };
  let state = loadState();
  let accountUser = null;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved && typeof saved === "object" ? { ...defaults, ...saved, profile: { ...defaults.profile, ...(saved.profile || {}) }, notifications: { ...defaults.notifications, ...(saved.notifications || {}) }, transactions: Array.isArray(saved.transactions) ? saved.transactions : [] } : structuredClone(defaults);
    } catch (error) {
      console.error("Could not load MULALINK demo state:", error);
      return structuredClone(defaults);
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { console.error("Could not save MULALINK demo state:", error); toast("Changes could not be saved in this browser."); }
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
  function money(amount) { return `KES ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0)}`; }
  function currentPage() {
    const key = location.hash.replace(/^#/, "");
    return navigation.flatMap(group => group.items).some(item => item[0] === key) ? key : "dashboard";
  }
  function nameFor(page) {
    for (const group of navigation) {
      const match = group.items.find(item => item[0] === page);
      if (match) return match[1];
    }
    return "Dashboard";
  }
  function renderNav(active) {
    document.getElementById("sidebar-nav").innerHTML = navigation.map(group => `<div class="nav-group"><div class="nav-group-title">${esc(group.group)}</div>${group.items.map(([id, label, icon]) => `<a class="nav-link${active === id ? " active" : ""}" href="#${id}"${active === id ? ' aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${esc(label)}</span></a>`).join("")}</div>`).join("");
  }
  function pageHeading(title, description, action = "") {
    return `<div class="page-heading"><div><div class="eyebrow">MULALINK WORKSPACE</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
  }
  function safeButton(label, action, style = "button-secondary", icon = "") {
    return `<button class="button ${style}" data-action="${esc(action)}">${icon ? `<span class="button-icon">${icon}</span>` : ""}${esc(label)}</button>`;
  }
  function totalFor(type) {
    return state.transactions.filter(tx => tx.type === type && tx.status === "confirmed").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }
  function statCard(label, value, icon, color, note) {
    return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon ${color}">${icon}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-note">${note}</div></article>`;
  }
  function chartSvg(range) {
    const count = range === "month" ? 30 : range === "year" ? 12 : 7;
    const grouped = Array(count).fill(0);
    const now = new Date();
    const start = new Date(now);
    if (range === "month") start.setDate(now.getDate() - count + 1);
    else if (range === "year") start.setMonth(now.getMonth() - count + 1, 1);
    else start.setDate(now.getDate() - count + 1);
    for (const tx of state.transactions) {
      if (tx.type !== "earning" || tx.status !== "confirmed") continue;
      const date = new Date(tx.date);
      const index = range === "month" ? Math.floor((date - start) / 86400000) : range === "year" ? (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth() : Math.floor((date - start) / 86400000);
      if (index >= 0 && index < count) grouped[index] += Number(tx.amount) || 0;
    }
    const max = Math.max(...grouped, 1);
    const points = grouped.map((amount, index) => `${18 + index * (564 / Math.max(1, count - 1))},${100 - amount / max * 72}`).join(" ");
    const labels = range === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : range === "month" ? ["1", "5", "10", "15", "20", "25", "30"] : ["Jan", "Mar", "May", "Jul", "Sep", "Nov"];
    return `<svg class="chart" viewBox="0 0 600 125" preserveAspectRatio="none" role="img" aria-label="Earnings over selected period"><defs><linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#5c7cea" stop-opacity=".18"/><stop offset="100%" stop-color="#5c7cea" stop-opacity="0"/></linearGradient></defs><line class="chart-grid" x1="10" y1="28" x2="590" y2="28"/><line class="chart-grid" x1="10" y1="64" x2="590" y2="64"/><line class="chart-grid" x1="10" y1="100" x2="590" y2="100"/><polygon class="chart-area" points="18,112 ${points} 582,112"/><polyline class="chart-line" points="${points}"/>${labels.map((label, index) => `<text class="chart-label" x="${18 + index * (564 / Math.max(1, labels.length - 1))}" y="123" text-anchor="middle">${label}</text>`).join("")}</svg>`;
  }
  function dashboardPage() {
    const available = totalFor("earning") - totalFor("withdrawal");
    const earnings = totalFor("earning");
    const firstName = state.profile.name.trim().split(/\s+/)[0] || "there";
    const items = opportunities.map(item => `<article class="opportunity-card"><div class="opportunity-top"><span class="opportunity-category">${item.icon} &nbsp;${item.category}</span><span class="opportunity-reward">${item.reward}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="opportunity-footer"><span>DEMO EXAMPLE · ${item.time}</span><button class="button button-soft button-sm" data-page="${item.page}">Explore</button></div></article>`).join("");
    return `${pageHeading(`Good morning, ${firstName}`, "Here’s a snapshot of your MULALINK activity. Your dashboard updates as confirmed records are added.", safeButton("Start earning", "go-tasks", "button-primary", "＋"))}
      <section class="banner"><div class="banner-copy"><div class="banner-tag">✦ &nbsp;YOUR NEXT CHAPTER STARTS HERE</div><h2>Small steps. Real opportunities.</h2><p>Explore learning, product testing, and research opportunities at your own pace. Start with what interests you.</p>${safeButton("Explore opportunities", "go-tasks", "button-primary", "→")}</div><div class="banner-art" aria-hidden="true"><span class="banner-coin">M</span></div></section>
      <section class="stats-grid" aria-label="Account summary">${statCard("Available balance", money(available), "▣", "", "Based on confirmed demo records")}${statCard("Lifetime earnings", money(earnings), "↗", "green", `${state.transactions.filter(tx => tx.type === "earning" && tx.status === "confirmed").length} confirmed records`)}${statCard("Pending earnings", money(totalFor("pending")), "◷", "gold", "Awaiting review")}${statCard("Referral earnings", money(totalFor("commission")), "%", "violet", "Verified commissions only")}</section>
      <section class="dashboard-grid"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Earnings overview</h2><p class="panel-subtitle">Confirmed earnings from your activity</p></div><select class="select-small" id="chart-range" aria-label="Chart time range"><option value="week" ${state.range === "week" ? "selected" : ""}>This week</option><option value="month" ${state.range === "month" ? "selected" : ""}>This month</option><option value="year" ${state.range === "year" ? "selected" : ""}>This year</option></select></div><div class="chart-wrap"><div class="chart-summary"><strong class="chart-total">${money(earnings)}</strong><span class="chart-range">all-time confirmed</span></div><div id="chart-holder">${chartSvg(state.range)}</div></div></article>
      <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Quick actions</h2><p class="panel-subtitle">Pick up where you left off</p></div></div><div class="quick-list"><button class="quick-row" data-page="site-tasks"><span class="quick-icon">✓</span><span class="quick-copy"><strong>Browse opportunities</strong><small>Find something that fits you</small></span><span class="quick-arrow">›</span></button><button class="quick-row" data-page="wallet-overview"><span class="quick-icon" style="color:#168a67;background:#e9f7f1">▣</span><span class="quick-copy"><strong>View your wallet</strong><small>${money(available)} available balance</small></span><span class="quick-arrow">›</span></button><button class="quick-row" data-page="team"><span class="quick-icon" style="color:#9b741d;background:#fff6e3">♧</span><span class="quick-copy"><strong>Invite your community</strong><small>Share your referral link</small></span><span class="quick-arrow">›</span></button></div></article></section>
      <section class="lower-grid"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Recent activity</h2><p class="panel-subtitle">Your latest confirmed wallet records</p></div><a href="#transactions" style="color:#4169e1;font-size:9px;font-weight:600">View all →</a></div>${recentActivity()}</article><article class="panel"><div class="panel-head"><div><h2 class="panel-title">From MULALINK</h2><p class="panel-subtitle">A quick note for your journey</p></div></div><div class="announcement"><span class="announcement-icon">✦</span><div><strong>Welcome to MULALINK</strong><p>This is a demo workspace. Explore the prototype and discover what the platform can do.</p><time>Welcome message</time></div></div></article></section>
      <div class="section-heading"><h2>Explore opportunities</h2><a href="#site-tasks">See all opportunities →</a></div><section class="opportunity-grid">${items}</section>`;
  }
  function recentActivity() {
    const items = state.transactions.filter(tx => tx.status === "confirmed").slice(-4).reverse();
    if (!items.length) return `<div class="activity-empty"><span class="empty-icon">↗</span><strong>No activity just yet</strong><span>When a transaction is confirmed, it will appear here.</span></div>`;
    return `<div class="inline-list" style="padding:0 16px">${items.map(tx => `<div class="inline-list-row"><div><strong>${esc(tx.label || tx.type)}</strong><small>${new Date(tx.date).toLocaleDateString("en-KE", { dateStyle: "medium" })} · ${esc(tx.reference)}</small></div><strong>${tx.type === "withdrawal" ? "−" : "+"}${money(tx.amount)}</strong></div>`).join("")}</div>`;
  }
  function emptyPage(page) {
    const [, description, button, icon, emptyTitle, emptyDescription] = pageDetails[page];
    const callToAction = page === "team" ? safeButton(button, "copy-referral", "button-primary") : page === "profile" ? safeButton(button, "edit-profile", "button-primary") : page === "notifications" ? safeButton(button, "go-preferences", "button-secondary") : ["spin-wheel", "forex-trading", "instant-loans", "fix-odds", "y99"].includes(page) ? safeButton(button, "info", "button-secondary") : safeButton(button, "info", "button-primary");
    const caution = ["instant-loans", "deposit", "withdraw", "pay-for-a-client", "forex-trading", "fix-odds", "spin-wheel"].includes(page);
    return `${pageHeading(pageDetails[page][0], description, safeButton("Overview", "go-dashboard", "button-secondary", "⌂"))}${caution ? `<div class="notice"><span class="notice-icon">ⓘ</span><span><strong>Demo mode:</strong> ${page === "forex-trading" ? "Educational information only; no real-money trading is offered." : page === "fix-odds" ? "No live odds, wagering, or predictions are available." : "No real funds are moved and no financial service is connected."}</span></div>` : ""}<section class="panel"><div class="empty-state"><span class="empty-icon">${icon}</span><h2>${esc(emptyTitle)}</h2><p>${esc(emptyDescription)}</p>${callToAction}</div></section><section class="content-panel panel"><h2>What you can do here</h2><p>${esc(description)} MULALINK will show relevant listings, activity, and clear status updates when the necessary verified services are connected.</p><div class="divider"></div><div class="row-between"><span style="color:#68738a;font-size:9px">Account status</span><span class="badge">Demo account</span></div></section>`;
  }
  function profilePage() {
    const status = accountUser?.accountStatus || "demo account";
    const initials = (accountUser?.fullName || "NM").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    const createdAt = accountUser?.createdAt ? new Date(accountUser.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "";
    const headingAction = accountUser
      ? safeButton("Account details", "info", "button-secondary")
      : safeButton("Save changes", "save-profile", "button-primary");
    const profileNotice = accountUser
      ? "These details are loaded from your saved MULALINK account. To change sensitive account details, contact support."
      : "Profile details are saved in this browser only. No account, authentication, or verification service is connected.";
    return `${pageHeading("Your profile", accountUser ? "Your saved MULALINK account details." : "Manage the details shown in your local demo account.", headingAction)}<div class="notice"><span class="notice-icon">ⓘ</span><span>${profileNotice}</span></div><section class="panel content-panel"><div class="row-between"><div style="display:flex;align-items:center;gap:12px"><span class="avatar" style="width:43px;height:43px;font-size:12px">${esc(initials)}</span><div><h2 style="margin-bottom:3px">${esc(state.profile.name || "New member")}</h2><p style="margin:0">${accountUser ? "MULALINK account" : "Demo account"} · <span class="badge">${esc(status.replaceAll("_", " "))}</span></p></div></div>${accountUser ? "" : safeButton("Change photo", "info")}</div><div class="divider"></div><div class="field-grid">${accountUser ? `<label class="field">Username<input value="${esc(accountUser.username || "")}" autocomplete="username" readonly></label>` : ""}<label class="field">Full name<input id="profile-name" value="${esc(state.profile.name)}" autocomplete="name" ${accountUser ? "readonly" : ""}></label><label class="field">Email address<input id="profile-email" type="email" value="${esc(state.profile.email)}" autocomplete="email" placeholder="you@example.com" ${accountUser ? "readonly" : ""}></label><label class="field">Phone number<input id="profile-phone" type="tel" value="${esc(state.profile.phone)}" autocomplete="tel" placeholder="+254 7XX XXX XXX" ${accountUser ? "readonly" : ""}></label>${accountUser ? `<label class="field">Personal referral code<input value="${esc(accountUser.personalReferralCode || "")}" readonly></label>` : `<label class="field">Country<select id="profile-country"><option ${state.profile.country === "Kenya" ? "selected" : ""}>Kenya</option><option ${state.profile.country === "Uganda" ? "selected" : ""}>Uganda</option><option ${state.profile.country === "Tanzania" ? "selected" : ""}>Tanzania</option><option ${state.profile.country === "Other" ? "selected" : ""}>Other</option></select></label>`}${accountUser && createdAt ? `<label class="field">Account created<input value="${esc(createdAt)}" readonly></label>` : ""}</div><div class="divider"></div><div class="row-between"><div><strong style="display:block;margin-bottom:4px;font-size:10px">Account status</strong><span style="color:#939cad;font-size:9px">${accountUser ? "This is the status stored on your account." : "This demo profile is not verified."}</span></div><span class="badge">${accountUser ? esc(status.replaceAll("_", " ")) : "Not verified"}</span></div></section>`;
  }
  function preferencesPage() {
    return `${pageHeading("Notification preferences", "Choose which updates you'd like to see in this local demo.", safeButton("Save preferences", "save-preferences", "button-primary"))}<section class="panel content-panel"><h2>Choose your updates</h2><p>In a live account, these preferences control consent-based notifications.</p>${Object.entries({ security: ["Security alerts", "Important account and sign-in activity."], activity: ["Account activity", "Task reviews and account updates."], product: ["Product updates", "News and optional platform announcements."] }).map(([key, [title, text]]) => `<div class="toggle-row"><div class="toggle-copy"><strong>${title}</strong><small>${text}</small></div><button class="switch ${state.notifications[key] ? "on" : ""}" role="switch" aria-checked="${state.notifications[key]}" data-toggle="${key}" aria-label="${title}"></button></div>`).join("")}</section><section class="panel content-panel"><h2>Delivery channels</h2><p>Email, SMS, and messaging delivery require authorized providers and explicit consent. They are not enabled in this prototype.</p></section>`;
  }
  function teamPage() {
    const code = accountUser?.personalReferralCode || "DEMO";
    const referral = `${location.origin}/register?ref=${encodeURIComponent(code)}`;
    return `${pageHeading("Grow your network", "Invite friends and track eligible referrals and commissions.", safeButton("Copy referral link", "copy-referral", "button-primary"))}<section class="stats-grid">${statCard("Team members", "0", "♧", "", "No referrals yet")}${statCard("Direct referrals", "0", "↗", "green", "Verified members")}${statCard("Active this month", "0", "◷", "gold", "Eligible activity")}${statCard("Commission earned", money(totalFor("commission")), "%", "violet", "Confirmed only")}</section><section class="panel content-panel"><h2>Your referral link</h2><p>Share your unique link with people you know. Rewards, if offered, depend on eligible and verified activity.</p><div class="row-between" style="gap:8px"><input id="referral-link" class="search-field" style="width:100%" readonly value="${esc(referral)}">${safeButton("Copy", "copy-referral", "button-secondary")}</div><div class="divider"></div><div class="row-between"><span style="font-size:9px;color:#7e899c">Your referral code</span><strong style="font-size:10px">${esc(code)}</strong></div></section><section class="panel content-panel"><h2>Your team</h2><p>Members who join with your referral link will appear here.</p>${emptyTable(["Member", "Joined", "Status", "Eligible activity"], "No team members yet")}</section>`;
  }
  function walletPage(page) {
    const rows = state.transactions.filter(tx => page === "payout-history" ? tx.type === "withdrawal" : page === "my-commissions" ? tx.type === "commission" : true);
    const rowsHtml = rows.length ? rows.map(tx => `<tr><td>${esc(tx.reference)}</td><td>${esc(tx.label || tx.type)}</td><td>${new Date(tx.date).toLocaleDateString("en-KE", { dateStyle: "medium" })}</td><td>${esc(tx.status)}</td><td>${money(tx.amount)}</td></tr>`).join("") : `<tr><td class="table-empty" colspan="5">No confirmed records. Wallet activity appears after server-confirmed transactions.</td></tr>`;
    return `${pageHeading(pageDetails[page][0], pageDetails[page][1], safeButton("View wallet overview", "go-wallet", "button-secondary"))}<div class="notice"><span class="notice-icon">ⓘ</span><span><strong>Read-only demo wallet.</strong> No deposit, withdrawal, or payment provider is connected. Figures are calculated from confirmed browser-demo records only.</span></div><section class="stats-grid">${statCard("Available balance", money(totalFor("earning") - totalFor("withdrawal")), "▣", "", "Confirmed demo activity")}${statCard("Total earnings", money(totalFor("earning")), "↗", "green", "Confirmed records")}${statCard("Pending", money(totalFor("pending")), "◷", "gold", "Awaiting review")}${statCard("Commissions", money(totalFor("commission")), "%", "violet", "Eligible and confirmed")}</section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">${page === "payout-history" ? "Payout history" : page === "my-commissions" ? "Commission statement" : "Recent transactions"}</h2><p class="panel-subtitle">Unique references and verified transaction status</p></div></div><div class="table-wrap"><table><thead><tr><th>REFERENCE</th><th>DESCRIPTION</th><th>DATE</th><th>STATUS</th><th>AMOUNT</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></section>`;
  }
  function accountsPage() {
    return `${pageHeading("Accounts & security", "Your account is stored on the MULALINK server and protected by sign-in.", safeButton("Security options", "info", "button-secondary"))}<div class="notice"><span class="notice-icon">ⓘ</span><span>Your MULALINK account uses server-backed sign-in. Password recovery, two-factor authentication, and payment-provider connections are not configured.</span></div><section class="panel content-panel"><h2>Sign-in security</h2><p>Your password is stored as a secure hash and your session is managed by the server.</p><div class="inline-list">${[["Password", "Password recovery requires a secure email or SMS provider.", "Recovery unavailable"], ["Two-factor authentication", "Add a second step for privileged or sensitive actions.", "Not configured"], ["Active sessions", "This browser has an authenticated server session.", "Current session active"], ["Linked payment accounts", "Payment methods require an authorized provider.", "None linked"]].map(([title, text, status]) => `<div class="inline-list-row"><div><strong>${title}</strong><small>${text}</small></div><span class="badge">${status}</span></div>`).join("")}</div></section>`;
  }
  function helpPage() {
    const supportAddress = "kevox122@gmail.com";
    const supportLink = `mailto:${supportAddress}?subject=MULALINK%20Support%20Ticket`;
    const questions = [["Is this a live earning platform?", "No. This is a static front-end prototype. It does not provide real tasks, payouts, loans, trading, or account verification."], ["Are the displayed balances real?", "No balances are hardcoded as available funds. The demo starts at KES 0.00 and calculates figures from locally stored confirmed records."], ["Can I deposit or withdraw money?", "No. No payment provider is connected and this prototype cannot move money."], ["How do I report a safety concern?", `Email ${supportAddress} with the details of your concern.`]];
    return `${pageHeading("Help & support", "Browse quick answers and contact us by email.", `<a class="button button-primary" href="${supportLink}">Email support</a>`)}<section class="panel content-panel"><h2>Send a support ticket</h2><p>Use your email app to contact our support team. Include your username, a description of the issue, and any relevant steps. Do not include your password or payment details.</p><p><a href="${supportLink}">${supportAddress}</a></p></section><section class="panel content-panel"><h2>Frequently asked questions</h2><div class="inline-list">${questions.map(([question, answer]) => `<details class="faq-item"><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join("")}</div></section>`;
  }
  function emptyTable(headers, message) {
    return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${esc(header.toUpperCase())}</th>`).join("")}</tr></thead><tbody><tr><td colspan="${headers.length}" class="table-empty">${esc(message)}</td></tr></tbody></table></div>`;
  }
  function signOutPage() {
    if (accountUser) return `${pageHeading("Sign out", "Sign out of your MULALINK account on this device.", safeButton("Sign out", "logout", "button-primary"))}<section class="panel"><div class="empty-state"><span class="empty-icon">↪</span><h2>Signed in as ${esc(accountUser.fullName)}</h2><p>Your active session will be removed from this browser when you sign out.</p>${safeButton("Sign out securely", "logout", "button-primary")}</div></section>`;
    return `${pageHeading("Sign out", "This prototype does not create a real authenticated session.", safeButton("Return to dashboard", "go-dashboard", "button-primary"))}<div class="notice"><span class="notice-icon">ⓘ</span><span>There is no active login session to end. Authentication must be implemented on a secure backend before launch.</span></div><section class="panel"><div class="empty-state"><span class="empty-icon">↪</span><h2>You're in demo mode</h2><p>No credentials or private account data are stored in a server session.</p>${safeButton("Back to dashboard", "go-dashboard", "button-primary")}</div></section>`;
  }
  async function loadAccount() {
    if (!["http:", "https:"].includes(location.protocol)) return;
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (response.status === 401) {
        if (location.pathname === "/") window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error(`Account lookup failed (${response.status}).`);
      const data = await response.json();
      accountUser = data.user;
      state.profile.name = accountUser.fullName;
      state.profile.email = accountUser.email;
      state.profile.phone = accountUser.phone;
      render();
    } catch (error) {
      console.error("Could not load the signed-in account:", error);
    }
  }
  function render() {
    const page = currentPage();
    document.title = `${nameFor(page)} · MULALINK`;
    document.getElementById("page-title").textContent = nameFor(page);
    document.querySelectorAll("[data-auth-entry]").forEach(link => { link.hidden = Boolean(accountUser); });
    document.querySelectorAll("[data-auth-session]").forEach(link => { link.hidden = !accountUser; });
    const demoPill = document.querySelector(".demo-pill");
    demoPill.innerHTML = accountUser ? "<span></span> ACCOUNT" : "<span></span> DEMO MODE";
    renderNav(page);
    const content = page === "dashboard" ? dashboardPage() : page === "profile" ? profilePage() : page === "notifications" ? preferencesPage() : page === "team" ? teamPage() : ["wallet-overview", "transactions", "payout-history", "my-commissions"].includes(page) ? walletPage(page) : page === "accounts" ? accountsPage() : page === "help-and-support" ? helpPage() : page === "sign-out" ? signOutPage() : emptyPage(page);
    document.getElementById("page-content").innerHTML = content;
    document.querySelectorAll(".profile-name").forEach(element => { element.textContent = state.profile.name || "New member"; });
    const initials = (state.profile.name || "NM").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    document.querySelectorAll(".profile-initials").forEach(element => { element.textContent = initials; });
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
  }
  function toast(message) {
    const region = document.getElementById("toast-region");
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;
    region.append(item);
    setTimeout(() => item.remove(), 3600);
  }
  function modal(title, message, action = "Close") {
    document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${esc(title)}</h2><p>${esc(message)}</p></div><button class="modal-close" data-close-modal aria-label="Close dialog">×</button></div><div class="modal-actions"><button class="button button-primary" data-close-modal>${esc(action)}</button></div></section></div>`;
    document.querySelector(".modal-close").focus();
  }
  function handleAction(action) {
    if (action === "go-tasks") location.hash = "site-tasks";
    else if (action === "go-dashboard") location.hash = "dashboard";
    else if (action === "go-wallet") location.hash = "wallet-overview";
    else if (action === "go-preferences") location.hash = "notifications";
    else if (action === "edit-profile") document.getElementById("profile-name")?.focus();
    else if (action === "save-profile") {
      state.profile.name = document.getElementById("profile-name")?.value.trim() || "";
      state.profile.email = document.getElementById("profile-email")?.value.trim() || "";
      state.profile.phone = document.getElementById("profile-phone")?.value.trim() || "";
      state.profile.country = document.getElementById("profile-country")?.value || "Kenya";
      saveState();
      toast("Profile saved on this device.");
      render();
    } else if (action === "save-preferences") {
      saveState();
      toast("Notification preferences saved on this device.");
    } else if (action === "copy-referral") {
      const value = document.getElementById("referral-link")?.value || `${location.origin}/register?ref=${encodeURIComponent(accountUser?.personalReferralCode || "DEMO")}`;
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(() => toast("Demo referral link copied.")).catch(error => { console.error("Could not copy referral link:", error); modal("Referral link", value); });
      else modal("Referral link", value);
    }
    else if (action === "logout") {
      fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
        .then(response => {
          if (!response.ok) throw new Error(`Sign out failed (${response.status}).`);
          accountUser = null;
          window.location.assign("/login");
        })
        .catch(error => {
          console.error("Could not sign out:", error);
          modal("Couldn't sign out", "The server could not end this session. Please try again.");
        });
    }
    else if (action === "info") modal("Not connected in demo mode", "This section is a front-end prototype only. It does not connect to external services, process payments, or confirm rewards.");
  }
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-page], [data-action], [data-toggle], [data-close-modal]");
    if (!target) return;
    if (target.hasAttribute("data-page")) { location.hash = target.dataset.page; return; }
    if (target.hasAttribute("data-toggle")) {
      const key = target.dataset.toggle;
      state.notifications[key] = !state.notifications[key];
      saveState();
      render();
      return;
    }
    if (target.hasAttribute("data-close-modal")) {
      if (target === event.target || target.classList.contains("modal-close") || target.tagName === "BUTTON") document.getElementById("modal-root").innerHTML = "";
      return;
    }
    if (target.dataset.action) handleAction(target.dataset.action);
  });
  document.addEventListener("change", event => {
    if (event.target.id === "chart-range") {
      state.range = event.target.value;
      saveState();
      document.getElementById("chart-holder").innerHTML = chartSvg(state.range);
    }
  });
  document.getElementById("menu-toggle").addEventListener("click", event => {
    const open = document.getElementById("sidebar").classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("hashchange", render);
  if (!location.hash) history.replaceState(null, "", "#dashboard");
  render();
  loadAccount();
})();
