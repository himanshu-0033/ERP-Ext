(() => {
  "use strict";
  if (location.origin !== "https://erp.iitkgp.ac.in" ||
      !["/SSOAdministration/login.htm", "/IIT_ERP3/"].includes(location.pathname) ||
      globalThis.__erpAutofillInstalled) return;
  const form = document.querySelector("#loginForm");
  const user = form?.querySelector("#user_id");
  const password = form?.querySelector("#password");
  const answer = form?.querySelector("#answer");
  const question = form?.querySelector("#question");
  const otpButton = form?.querySelector("#getotp");
  const otp = form?.querySelector("#email_otp1");
  if (![form, user, password, answer, question, otpButton, otp].every(Boolean)) return;
  globalThis.__erpAutofillInstalled = true;
  let busy = false;
  let lastRequest = 0;

  const panel = document.createElement("div");
  panel.id = "iitkgp-erp-autofill";
  const shadow = panel.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { display:block; margin:0 0 18px; }
      .box { font:13px/1.5 system-ui,sans-serif; color:#18375d; padding:12px;
        background:#eef5ff; border:1px solid #d2e2fa; border-radius:10px; }
      .row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      strong { font-size:13px; }
      button { border:0; border-radius:7px; padding:9px 12px; background:#2459c5;
        color:white; font:600 12px system-ui,sans-serif; cursor:pointer; }
      button:disabled { opacity:.6; cursor:wait; }
      button:focus-visible { outline:3px solid #87b9ff; outline-offset:2px; }
      p { margin:8px 0 0; font-size:12px; }
    </style>
    <div class="box">
      <div class="row"><strong>ERP Autofill</strong><button type="button">Fill &amp; Send OTP</button></div>
      <p role="status" aria-live="polite">Preparing your login details…</p>
    </div>`;
  form.prepend(panel);
  const status = shadow.querySelector("p");
  const sendButton = shadow.querySelector("button");

  function setValue(input, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getAnswer(profile) {
    const normalize = text => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return profile.answers.find(entry => normalize(entry.question) === normalize(question.textContent))?.answer || null;
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function fill(sendOtp = false, force = false) {
    if (busy) return { ok: false, message: "Please wait for the current fill to finish." };
    busy = true;
    sendButton.disabled = true;
    try {
      const saved = await chrome.runtime.sendMessage({type: "GET_PROFILE"});
      if (!saved?.ok) throw new Error(saved?.message || "Unlock your vault in ERP Autofill first.");
      const profile = saved.profile;
      if (!force && !profile.autoFill) {
        status.textContent = "Automatic filling is off. Click Fill & Send OTP when ready.";
        return {ok: true, message: status.textContent};
      }
      if (sendOtp && (Date.now() - lastRequest < 60000 ||
          (otpButton.disabled && answer.value.trim() && !answer.readOnly))) {
        throw new Error("OTP is not ready to resend. Wait for ERP's Get OTP button to become available.");
      }
      if (!force && user.value && user.value !== profile.userId) {
        throw new Error("Another user ID is entered. Click Fill & Send OTP to use your saved profile.");
      }
      status.textContent = "Filling details and waiting for the security question…";
      const userChanged = user.value !== profile.userId;
      if (userChanged) setValue(user, profile.userId);
      if (force || !password.value) setValue(password, profile.password);
      if (userChanged || answer.readOnly || !getAnswer(profile)) {
        // The ERP's own blur handler fetches the account's question.
        // Clear the old label so a previous account's question is never used.
        question.textContent = "Security Question";
        setValue(answer, "");
        user.dispatchEvent(new FocusEvent("blur"));
      }
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (user.value !== profile.userId) throw new Error("User ID changed. Autofill stopped.");
        if (!answer.readOnly && !answer.disabled && getAnswer(profile)) break;
        if (!answer.readOnly && question.textContent.trim() !== "Security Question" && !getAnswer(profile)) {
          throw new Error("This security question has no saved answer. Please fill it manually.");
        }
        await delay(100);
      }
      if (answer.readOnly || answer.disabled || !getAnswer(profile)) {
        throw new Error("The security question did not load. Check your connection, then try again.");
      }
      // A lock or profile change during the lookup cancels this operation.
      const current = await chrome.runtime.sendMessage({type: "GET_PROFILE"});
      if (!current?.ok || current.revision !== saved.revision) throw new Error("Vault was locked or changed. Unlock it and try again.");
      if (user.value !== profile.userId) throw new Error("User ID changed. Autofill stopped.");
      if (answer.value !== getAnswer(profile)) setValue(answer, getAnswer(profile));
      if (!sendOtp) {
        status.textContent = "Details filled. Click Fill & Send OTP when ready.";
        return { ok: true, message: status.textContent };
      }
      if (Date.now() - lastRequest < 60000) {
        throw new Error("OTP was already requested. Wait one minute before requesting another.");
      }
      // The ERP controls its own resend cooldown. Never enable its button here.
      if (otpButton.disabled || otpButton.getAttribute("aria-disabled") === "true" || otpButton.hidden) {
        throw new Error("ERP is not ready to send another OTP. Wait for its Get OTP button to become available.");
      }
      lastRequest = Date.now();
      otpButton.click();
      status.textContent = "OTP requested. Check the ERP response, then enter your OTP and click Log In.";
      return { ok: true, message: status.textContent };
    } catch (error) {
      status.textContent = error.message;
      return { ok: false, message: error.message };
    } finally {
      busy = false;
      sendButton.disabled = false;
    }
  }

  sendButton.addEventListener("click", () => fill(true, true));
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type !== "ERP_FILL" && message?.type !== "ERP_SEND_OTP") return;
    fill(message.type === "ERP_SEND_OTP", true).then(respond);
    return true;
  });
  // Let the ERP's ready handlers initialize readonly fields before filling.
  setTimeout(() => fill(), 400);
})();
