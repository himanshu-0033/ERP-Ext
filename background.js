"use strict";
importScripts("vault.js");

// Content scripts receive only the currently unlocked profile through checked
// messages. Neither storage area is directly exposed to content scripts.
const ready = Promise.all([
  chrome.storage.local.setAccessLevel({accessLevel: "TRUSTED_CONTEXTS"}),
  chrome.storage.session.setAccessLevel({accessLevel: "TRUSTED_CONTEXTS"})
]);
let queue = Promise.resolve();

function isExtensionPage(sender) {
  return sender.id === chrome.runtime.id &&
    ["popup.html", "options.html"].some(file => sender.url === chrome.runtime.getURL(file));
}
function isLoginPage(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return false;
  try {
    const url = new URL(sender.url);
    return url.origin === "https://erp.iitkgp.ac.in" &&
      ["/SSOAdministration/login.htm", "/IIT_ERP3/"].includes(url.pathname);
  } catch { return false; }
}

async function handle(message, sender) {
  await ready;
  const ui = isExtensionPage(sender);
  if (message?.type === "GET_PROFILE" && isLoginPage(sender)) {
    const {unlocked} = await chrome.storage.session.get("unlocked");
    return unlocked ? {ok: true, ...unlocked} : {ok: false, message: "Open ERP Autofill to set up or unlock your vault, then refresh this page."};
  }
  if (!ui) return {ok: false, message: "This request is not allowed."};
  switch (message?.type) {
    case "GET_STATUS": {
      const {vault} = await chrome.storage.local.get("vault");
      const {unlocked} = await chrome.storage.session.get("unlocked");
      return {ok: true, configured: Boolean(vault), unlocked: Boolean(unlocked)};
    }
    case "GET_SETTINGS": {
      if (sender.url !== chrome.runtime.getURL("options.html")) return {ok: false, message: "Open settings to edit your profile."};
      const {vault} = await chrome.storage.local.get("vault");
      const {unlocked} = await chrome.storage.session.get("unlocked");
      return {ok: true, configured: Boolean(vault), profile: unlocked?.profile || null};
    }
    case "SAVE_PROFILE": {
      if (sender.url !== chrome.runtime.getURL("options.html")) return {ok: false, message: "Open settings to save your profile."};
      const {vault: existing} = await chrome.storage.local.get("vault");
      const {unlocked} = await chrome.storage.session.get("unlocked");
      if (existing && !unlocked) return {ok: false, message: "Unlock your existing vault in the popup first, or delete it to start again."};
      const profile = ERPVault.validateProfile(message.profile);
      const vault = await ERPVault.encrypt(profile, message.passphrase);
      await chrome.storage.session.remove("unlocked");
      await chrome.storage.local.set({vault});
      await chrome.storage.session.set({unlocked: {profile, revision: crypto.randomUUID()}});
      return {ok: true, message: "Encrypted profile saved. Refresh the ERP login page to use it."};
    }
    case "UNLOCK": {
      const {vault} = await chrome.storage.local.get("vault");
      if (!vault) return {ok: false, message: "Set up a profile first."};
      const profile = await ERPVault.decrypt(vault, message.passphrase);
      await chrome.storage.session.set({unlocked: {profile, revision: crypto.randomUUID()}});
      return {ok: true, message: "Vault unlocked. Refresh ERP or click Fill & Send OTP."};
    }
    case "LOCK":
      await chrome.storage.session.remove("unlocked");
      return {ok: true, message: "Vault locked. Fields already filled on ERP remain on that page."};
    case "DELETE_PROFILE":
      await chrome.storage.session.clear();
      await chrome.storage.local.clear();
      return {ok: true, message: "Saved profile deleted. Close any ERP tabs containing filled details."};
    default:
      return {ok: false, message: "Unknown request."};
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Serialize changes so a late unlock/save cannot undo a subsequent lock.
  queue = queue.then(() => handle(message, sender)).then(respond, error => {
    respond({ok: false, message: error instanceof Error ? error.message : "Unable to access the vault."});
  });
  return true;
});
