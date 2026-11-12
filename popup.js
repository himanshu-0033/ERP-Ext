"use strict";
const status = document.querySelector("#status");
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.message || "Unable to access your vault.");
  return result;
}
async function refresh() {
  const state = await request({type: "GET_STATUS"});
  document.querySelector("#state").textContent = state.unlocked ? "Vault unlocked for this browser session" : state.configured ? "Vault locked" : "Set up your private profile";
  document.querySelector("#unlock-form").hidden = !state.configured || state.unlocked;
  document.querySelector("#actions").hidden = !state.unlocked;
}
async function action(task) {
  document.querySelectorAll("button").forEach(button => { button.disabled = true; });
  try { await task(); }
  catch (error) { status.textContent = error.message; }
  finally { document.querySelectorAll("button").forEach(button => { button.disabled = false; }); }
}
async function fill(type) {
  status.textContent = "Waiting for ERP…";
  let result;
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    result = await chrome.tabs.sendMessage(tab.id, {type});
  } catch { throw new Error("Open the ERP login page first. If already open, refresh it after loading the extension."); }
  status.textContent = result?.message || "Refresh the ERP login page and try again.";
}
document.querySelector("#unlock-form").addEventListener("submit", event => {
  event.preventDefault();
  action(async () => {
    const field = document.querySelector("#passphrase");
    const passphrase = field.value;
    field.value = "";
    const result = await request({type: "UNLOCK", passphrase});
    status.textContent = result.message;
    await refresh();
  });
});
document.querySelector("#send").addEventListener("click", () => action(() => fill("ERP_SEND_OTP")));
document.querySelector("#fill").addEventListener("click", () => action(() => fill("ERP_FILL")));
document.querySelector("#lock").addEventListener("click", () => action(async () => {
  status.textContent = (await request({type: "LOCK"})).message;
  await refresh();
}));
document.querySelector("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.querySelector("#open").addEventListener("click", () => chrome.tabs.create({url: "https://erp.iitkgp.ac.in/IIT_ERP3/"}));
refresh().catch(error => { status.textContent = error.message; });
