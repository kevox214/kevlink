(() => {
  "use strict";

  const form = document.querySelector("#register-form, #login-form");
  if (!form) return;
  const message = document.getElementById("form-message");
  const submit = form.querySelector('button[type="submit"]');
  const api = async (url, payload) => {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error("Could not reach MULALINK. Start the backend server and open this page at http://localhost:3000.");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
    return result;
  };
  const setMessage = (text, success = false) => {
    message.textContent = text;
    message.classList.toggle("success", success);
  };
  form.addEventListener("submit", async event => {
    event.preventDefault();
    setMessage("");
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const buttonText = submit.querySelector("span");
    submit.disabled = true;
    buttonText.textContent = "Please wait…";
    let destination = "/";
    try {
      if (form.id === "register-form") {
        if (data.password !== data.confirmPassword) throw new Error("Your passwords don't match.");
        if (!form.elements.acceptedTerms.checked) throw new Error("Please accept the terms and privacy policy to continue.");
        const referralCode = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
        await api("/api/auth/register", {
          fullName: data.fullName.trim(),
          username: data.username.trim().toLowerCase(),
          email: data.email.trim(),
          phone: data.phone.replace(/\s+/g, ""),
          password: data.password,
          confirmPassword: data.confirmPassword,
          referralCode: referralCode || undefined,
          acceptedTerms: form.elements.acceptedTerms.checked
        });
        destination = "/account-pending";
        setMessage("Your account was created and is awaiting administrator activation.", true);
      } else {
        const role = form.elements.role && form.elements.role.checked ? "admin" : "user";
        const result = await api("/api/auth/login", { identifier: data.identifier.trim(), password: data.password, role });
        if (role !== "admin" && result.user.accountStatus !== "active") destination = "/account-pending";
        setMessage(destination === "/account-pending"
          ? "Signed in. Your account is awaiting administrator activation."
          : role === "admin" ? "Admin sign-in successful. Opening your workspace…" : "Signed in. Opening your MULALINK workspace…", true);
      }
      window.location.assign(destination);
    } catch (error) {
      setMessage(error.message || "Unable to complete your request.");
      submit.disabled = false;
      buttonText.textContent = form.id === "register-form" ? "Create account" : "Sign in";
    }
  });
})();
