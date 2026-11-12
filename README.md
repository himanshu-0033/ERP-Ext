# IIT KGP ERP Autofill

A Chrome extension for the IIT Kharagpur ERP login page. Fill your user ID, password and the answer to the displayed security question, then request an OTP with one click.

**Bring your own account.** The shared extension contains no real user IDs, passwords, personal questions or answers. Enter your details through the settings page; no code editing or build tools are needed.

## Features

- Automatic login filling while your vault is unlocked, with an option to turn it off.
- **Fill & Send OTP** in the ERP form and the extension popup.
- Custom security questions and answers for each user's account.
- An encrypted local profile protected by a separate vault passphrase.
- Manual vault locking, profile editing and deletion.
- OTP entry and final login remain under your control.

## Install in Chrome

1. On [this repository](https://github.com/himanshu-0033/ERP-Ext), click **Code → Download ZIP**.
2. Extract the ZIP into a permanent folder on your computer.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
6. Open Chrome's Extensions menu (the puzzle icon) and pin **IIT KGP ERP Autofill**.

Alternatively, download with Git:

```sh
git clone https://github.com/himanshu-0033/ERP-Ext.git
```

Requires Chrome 114 or newer. Keep the extracted folder in place while the extension is installed.

## Set up your profile

1. Click the extension icon, then **Set up / edit profile**.
2. Enter your own ERP user ID / roll number and ERP password.
3. Enter a security question exactly as ERP displays it and the correct answer. Use **Add another question** for each additional question your account may receive.
4. Choose a **separate vault passphrase** of at least 12 characters and confirm it. Store it somewhere safe: there is no passphrase recovery service.
5. Leave automatic filling enabled, or turn it off if you prefer to fill only on demand.
6. Click **Save encrypted profile**. The vault is now unlocked for this browser session.

Question matching ignores capitalization, spaces and punctuation. Different words still count as different questions. Answers retain the spelling and case you enter. Add every question your account may show; an unknown question is never guessed.

## Use on ERP

1. Open the [official ERP portal](https://erp.iitkgp.ac.in/IIT_ERP3/).
2. If the vault is locked, open the extension popup and enter your vault passphrase. Refresh the ERP login page afterward, or use **Fill details only**.
3. The extension fills the user ID and password, waits for ERP to load the security question, then fills its saved answer.
4. Click **Fill & Send OTP** in the form or popup. This clicks ERP's own **Get OTP** button once.
5. Check ERP's response, enter the received OTP yourself, then click ERP's **Log In** button.

An OTP is never requested merely by opening a page. The extension does not read your email, collect OTPs or bypass two-factor authentication. ERP's resend limits still apply.

## Privacy and security

| Data | Where it lives |
| --- | --- |
| User ID, password, questions and answers | Together inside an encrypted vault in this extension's `chrome.storage.local` |
| Vault passphrase | Used to encrypt/unlock; not saved by the extension |
| Unlocked profile | `chrome.storage.session`, in memory for the browser session |
| Repository / ZIP | Application code and synthetic tests only; no account profile |

The vault uses the browser's Web Crypto API: AES-256-GCM with a fresh random IV and PBKDF2-HMAC-SHA-256 with a random salt and 600,000 iterations. Local and session storage access is restricted to trusted extension contexts. The background worker releases an unlocked profile only to this extension's settings page or its content script on an approved, top-level HTTPS ERP login page.

There is no analytics, extension backend, cloud sync, external JavaScript or credential export feature. The extension fills ERP's form; ERP handles its own security-question, OTP and login requests.

Encryption protects the saved vault while locked; this is not a guarantee against malware or someone controlling your browser. While unlocked, the profile is available to the extension. After filling, the ERP page can read the entered values as with manual entry. **Locking or deleting a vault does not erase fields already filled on open ERP pages.** Close those pages when finished. A full browser exit, extension reload, disable or update clears the unlocked session. If Chrome continues running in the background, use **Lock vault** explicitly.

### Permissions

- **storage**: saves the encrypted vault and keeps the unlocked profile in session memory.
- Static content scripts: run only on the official ERP login URL and portal entry URL, and require the recognized login form before doing anything.

No broad browsing-history, cookies, email, clipboard or all-sites permissions are requested.

## Edit, lock, delete or update

- **Edit:** unlock the vault, open settings, change your details and enter a vault passphrase to save. You can choose a new passphrase during this save.
- **Lock:** click **Lock vault** in the popup.
- **Delete / forgotten passphrase:** open settings and click **Delete saved profile**, then set up your details again. Deletion cannot recover the old profile.
- **Update:** replace the extension files in the same installation folder, click **Reload** on `chrome://extensions`, unlock again and refresh ERP. Loading from a different folder may create a separate extension installation and require setup again.
- **Upgrade from an older personal version:** remove its plaintext `profile.js` file and use settings to enter your details. Do not upload old personal folders or profile files to GitHub.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Nothing fills | Unlock the vault; check the automatic-fill setting; refresh ERP after installing/reloading. |
| Security question does not load | Check the connection and retry. ERP must return the question before an answer can be filled. |
| No saved answer for this question | Add the exact displayed question and its answer in settings. |
| OTP request is refused or fails | Read ERP's own response, verify your account details and wait for its resend timer. |
| Extension says to open the login page | Open the official portal and refresh the login tab. Other ERP pages are intentionally unsupported. |
| Forgot vault passphrase | Delete the vault from settings and set it up again. |

## Development and tests

The extension itself has no runtime dependencies or build step. Node.js 22+ is needed only for tests; Playwright is a development dependency for browser integration tests.

```sh
npm install
npm test
npx playwright install chromium
npm run test:browser
```

Browser tests load the actual unpacked extension in an isolated Chromium profile and use a synthetic ERP form with mocked question/OTP behavior. They never log into a real account or request a real OTP. Unit tests cover encryption, tamper rejection and input validation. Automated tests cannot verify live ERP acceptance or OTP delivery.

```text
manifest.json       Extension configuration and narrow page matches
background.js       Sender checks, vault storage and session handling
vault.js            Encryption and profile validation
content.js          ERP form integration and OTP button
popup.*             Unlock, lock and quick actions
options.*           Profile setup, editing and deletion
styles.css          Popup and settings styles
tests/              Synthetic, offline tests
```

Contributions and bug reports are welcome. Never include your password, security answers, vault, session tokens or screenshots showing personal details in an issue or pull request. The maintainers will never need those details to debug the extension.

## License and affiliation

MIT licensed. An independent community tool, not an official IIT Kharagpur product. The installation guide takes inspiration from the community's [ERP Feedback Automator](https://github.com/change-kgp/erp-feedback-automator); this extension serves the separate login workflow.
