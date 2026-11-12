# IIT Kharagpur ERP Autofill

**Fill your ERP login details. Request an OTP. Log in.**

![Chrome 114+](https://img.shields.io/badge/Chrome-114%2B-2563eb?style=flat-square)
![Manifest V3](https://img.shields.io/badge/Extension-Manifest_V3-475569?style=flat-square)
![Encrypted local storage](https://img.shields.io/badge/Storage-Encrypted_%26_Local-0f766e?style=flat-square)
[![MIT License](https://img.shields.io/badge/License-MIT-64748b?style=flat-square)](LICENSE)

A Chrome extension for the [IIT Kharagpur ERP portal](https://erp.iitkgp.ac.in/IIT_ERP3/). Save your own login details once, unlock your profile when needed, and let the extension fill the form.

[Install](#installation) · [Set up](#first-time-setup) · [Use](#how-to-use) · [Privacy](#privacy) · [Help](#help)

---

## What it does

- Fills your user ID, password and the answer to the displayed security question.
- Adds a **Fill & Send OTP** button to the login form and extension popup.
- Keeps your saved profile encrypted in your browser.
- Lets you edit, lock or delete your profile at any time.

**Anyone can use it with their own ERP account.** The download contains no personal login details. No coding or build tools are needed to install it.

## Installation

1. [Download the ZIP](https://github.com/himanshu-0033/ERP-Ext/archive/refs/heads/main.zip) and extract it into a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**, then click **Load unpacked**.
4. Select the extracted folder containing `manifest.json`.
5. Pin **IIT KGP ERP Autofill** from Chrome's Extensions menu for easy access.

Requires **Chrome 114 or newer**. Keep the installation folder in place.

## First-time setup

1. Click the extension icon and select **Set up / edit profile**.
2. Enter your ERP user ID / roll number and password.
3. Add each security question and its correct answer. Use **Add another question** for additional questions.
4. Choose a separate **vault passphrase** of at least 12 characters and confirm it.
5. Click **Save encrypted profile**.

The vault passphrase unlocks your saved profile; it is separate from your ERP password. Keep it safe—if you forget it, you will need to delete the profile and set it up again.

Copy questions as ERP displays them. Question matching ignores capitalization, spaces and punctuation; answers keep the spelling and case you enter.

## How to use

1. Open the [ERP login page](https://erp.iitkgp.ac.in/IIT_ERP3/).
2. If your vault is locked, unlock it from the extension popup, then refresh ERP.
3. Your details fill automatically. Click **Fill & Send OTP** when ready.
4. Enter the received OTP yourself and click ERP's **Log In** button.

Prefer manual filling? Turn off automatic filling in settings and use **Fill details only** from the popup.

**OTP requests happen only when you click.** The extension does not read your inbox or enter the OTP for you. ERP's resend limits still apply.

---

## Privacy

| Your data | How it is handled |
| --- | --- |
| Login details and security answers | Saved together in an encrypted local profile |
| Vault passphrase | Used to unlock the profile; never saved by the extension |
| Unlocked profile | Kept in memory for the browser session |
| GitHub repository | Contains application code and synthetic tests, not your profile |

There is **no analytics, cloud sync or extension server**. Your details are filled into the official ERP page, where ERP handles login and OTP requests.

Use **Lock vault** when finished, especially if Chrome stays running in the background. Locking does not clear fields already filled on an ERP page; close those tabs to remove the displayed details.

<details>
<summary><strong>Encryption and permissions</strong></summary>

The vault uses AES-256-GCM and PBKDF2-HMAC-SHA-256 with 600,000 iterations, a random salt and a fresh random IV. Encrypted data is saved in `chrome.storage.local`; the unlocked profile stays in `chrome.storage.session`.

Storage access is restricted to trusted extension contexts. The background worker shares the unlocked profile only with this extension's settings page or its content script on an approved, top-level HTTPS ERP login page.

The only API permission requested is **storage**. Content scripts are limited to the official login and portal entry URLs and require the recognized login form. There are no broad browsing-history, cookies, email, clipboard or all-sites permissions.

Encryption protects the saved vault while locked. It cannot protect against malware or someone controlling your browser. Once details are filled, ERP can read them as with manual entry. A full browser exit, extension reload, disable or update clears the unlocked session.

</details>

## Help

| Problem | Try this |
| --- | --- |
| Nothing fills | Unlock the vault, check the automatic-fill setting and refresh ERP. |
| The security question does not load | Check your connection and retry. |
| A question has no saved answer | Add that exact question and its answer in settings. |
| OTP fails or cannot be resent | Read ERP's response, check your details and wait for its resend timer. |
| Forgotten vault passphrase | Delete the saved profile from settings and set it up again. |

<details>
<summary><strong>Edit, lock, delete or update</strong></summary>

- **Edit:** unlock the vault, open settings, change your details and enter a vault passphrase to save. You can choose a new passphrase here.
- **Lock:** click **Lock vault** in the popup.
- **Delete:** select **Delete saved profile** in settings. This removes the saved vault and unlocked session, but not details already filled on open ERP pages.
- **Update:** replace the files in the same installation folder, click **Reload** at `chrome://extensions`, then unlock and refresh ERP. A different folder may create a separate installation that needs setup again.
- **Upgrade from an older personal version:** remove its plaintext `profile.js` file and enter your details through settings. Never upload old personal profile files to GitHub.

</details>

---

## For developers

<details>
<summary><strong>Project structure</strong></summary>

```text
ERP-Ext/
├── manifest.json       Extension configuration
├── background.js       Vault storage and access checks
├── vault.js            Encryption and profile validation
├── content.js          Login form and OTP integration
├── popup.html / .js     Unlock, lock and quick actions
├── options.html / .js   Profile setup and editing
├── styles.css          Popup and settings styles
├── tests/              Synthetic, offline tests
├── package.json        Development dependencies and test commands
├── LICENSE             MIT license
└── README.md           Setup and usage guide
```

</details>

<details>
<summary><strong>Run tests and contribute</strong></summary>

The extension has no runtime dependencies or build step. Tests require **Node.js 22+** and Playwright.

```sh
git clone https://github.com/himanshu-0033/ERP-Ext.git
cd ERP-Ext
npm install
npm test
npx playwright install chromium
npm run test:browser
```

Unit tests cover encryption, tamper rejection and input validation. Browser tests load the unpacked extension against a synthetic ERP form; they never log into a real account or send a real OTP. Live ERP acceptance and OTP delivery are not covered.

To contribute, fork the repository, make your changes on a new branch, run the relevant tests and open a pull request.

For bug reports, describe what happened and what you expected. **Never include passwords, security answers, vault data, session tokens or screenshots showing personal details.**

</details>

## License

Released under the [MIT License](LICENSE). An independent community tool, not an official IIT Kharagpur product.

Installation-guide inspiration: [ERP Feedback Automator](https://github.com/change-kgp/erp-feedback-automator).
