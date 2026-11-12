/* Shared by the extension service worker and offline Node tests. */
(() => {
  "use strict";
  const iterations = 600000;
  const encoder = new TextEncoder();
  const normalize = text => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

  function validateProfile(input) {
    if (!input || typeof input.userId !== "string" || !input.userId.trim() || input.userId.length > 100 ||
        typeof input.password !== "string" || !input.password || input.password.length > 256 ||
        !Array.isArray(input.answers) || input.answers.length < 1 || input.answers.length > 20) {
      throw new Error("Enter a user ID, password, and at least one security question and answer.");
    }
    const seen = new Set();
    const answers = input.answers.map(entry => {
      if (typeof entry?.question !== "string" || typeof entry?.answer !== "string" ||
          !normalize(entry.question) || !entry.answer.trim() || entry.question.length > 500 || entry.answer.length > 500) {
        throw new Error("Each security question needs both a question and an answer.");
      }
      const key = normalize(entry.question);
      if (seen.has(key)) throw new Error("Remove duplicate security questions before saving.");
      seen.add(key);
      return {question: entry.question.trim(), answer: entry.answer};
    });
    return {userId: input.userId.trim(), password: input.password, answers, autoFill: input.autoFill !== false};
  }

  const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  async function derive(passphrase, salt) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name: "PBKDF2", hash: "SHA-256", salt, iterations}, material,
      {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]);
  }

  async function encrypt(profile, passphrase) {
    if (typeof passphrase !== "string" || passphrase.length < 12 || passphrase.length > 1024) {
      throw new Error("Use a vault passphrase between 12 and 1,024 characters.");
    }
    const validated = validateProfile(profile);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derive(passphrase, salt);
    const ciphertext = await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, encoder.encode(JSON.stringify(validated)));
    return {version: 1, iterations, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext)};
  }

  async function decrypt(vault, passphrase) {
    try {
      if (vault?.version !== 1 || vault.iterations !== iterations || typeof passphrase !== "string" ||
          passphrase.length > 1024 || typeof vault.ciphertext !== "string" || vault.ciphertext.length > 100000) throw new Error();
      const salt = fromBase64(vault.salt), iv = fromBase64(vault.iv);
      if (salt.length !== 16 || iv.length !== 12) throw new Error();
      const key = await derive(passphrase, salt);
      const plaintext = await crypto.subtle.decrypt({name: "AES-GCM", iv}, key, fromBase64(vault.ciphertext));
      return validateProfile(JSON.parse(new TextDecoder().decode(plaintext)));
    } catch {
      throw new Error("Could not unlock the vault. Check the passphrase; damaged vaults must be reset.");
    }
  }

  const api = Object.freeze({normalize, validateProfile, encrypt, decrypt});
  globalThis.ERPVault = api;
  if (typeof module !== "undefined") module.exports = api;
})();
