"use strict";
const form = document.querySelector("#profile-form");
const questions = document.querySelector("#questions");
const status = document.querySelector("#status");
let nextId = 0;
function addQuestion(question = "", answer = "") {
  if (questions.children.length >= 20) { status.textContent = "You can save up to 20 questions."; return; }
  const id = ++nextId;
  const row = document.createElement("fieldset");
  row.innerHTML = `<legend>Security question</legend>
    <label for="q-${id}">Question shown by ERP</label><input id="q-${id}" class="question" required maxlength="500" autocomplete="off">
    <label for="a-${id}">Your answer</label><input id="a-${id}" class="answer" type="password" required maxlength="500" autocomplete="off">
    <button type="button" class="remove">Remove question</button>`;
  row.querySelector(".question").value = question;
  row.querySelector(".answer").value = answer;
  row.querySelector(".remove").addEventListener("click", () => {
    if (questions.children.length === 1) { status.textContent = "Keep at least one question."; return; }
    row.remove();
  });
  questions.append(row);
}
function clearForm() {
  form.reset();
  questions.replaceChildren();
  addQuestion();
}
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.message || "Unable to access the vault.");
  return result;
}
async function load() {
  const result = await request({type: "GET_SETTINGS"});
  clearForm();
  document.querySelector("#notice").textContent = result.profile ? "Vault unlocked. Edit your profile below and enter the vault passphrase to save." : result.configured ? "Vault locked. Unlock it from the toolbar popup, then reload this settings page to edit." : "Welcome. Add your own ERP details to create an encrypted local vault.";
  if (result.profile) {
    document.querySelector("#user-id").value = result.profile.userId;
    document.querySelector("#erp-password").value = result.profile.password;
    document.querySelector("#auto-fill").checked = result.profile.autoFill;
    questions.replaceChildren();
    result.profile.answers.forEach(entry => addQuestion(entry.question, entry.answer));
  }
}
document.querySelector("#add-question").addEventListener("click", () => addQuestion());
document.querySelector("#clear-form").addEventListener("click", clearForm);
form.addEventListener("submit", async event => {
  event.preventDefault();
  const passphrase = document.querySelector("#vault-passphrase").value;
  if (passphrase !== document.querySelector("#confirm-passphrase").value) { status.textContent = "Vault passphrases do not match."; return; }
  const profile = {
    userId: document.querySelector("#user-id").value,
    password: document.querySelector("#erp-password").value,
    autoFill: document.querySelector("#auto-fill").checked,
    answers: [...questions.children].map(row => ({question: row.querySelector(".question").value, answer: row.querySelector(".answer").value}))
  };
  document.querySelectorAll("button").forEach(button => { button.disabled = true; });
  status.textContent = "Encrypting your profile…";
  try {
    const result = await request({type: "SAVE_PROFILE", profile, passphrase});
    clearForm();
    document.querySelector("#notice").textContent = "Profile saved and unlocked. Reload this settings page if you want to edit it.";
    status.textContent = result.message;
  } catch (error) { status.textContent = error.message; }
  finally {
    document.querySelector("#vault-passphrase").value = "";
    document.querySelector("#confirm-passphrase").value = "";
    document.querySelectorAll("button").forEach(button => { button.disabled = false; });
  }
});
document.querySelector("#delete-profile").addEventListener("click", async () => {
  if (!confirm("Delete your saved ERP profile from this extension? You will need to enter it again.")) return;
  try { status.textContent = (await request({type: "DELETE_PROFILE"})).message; await load(); }
  catch (error) { status.textContent = error.message; }
});
// Clear any displayed details if the vault is locked/deleted in another view.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.unlocked && !changes.unlocked.newValue) {
    clearForm();
    document.querySelector("#notice").textContent = "Vault locked or changed. Reload settings after unlocking.";
  }
});
load().catch(error => { status.textContent = error.message; });
