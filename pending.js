"use strict";

document.getElementById("sign-out-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("Unable to sign out. Please try again.");
    window.location.assign("/login");
  } catch (error) {
    button.disabled = false;
    button.textContent = error.message;
  }
});
