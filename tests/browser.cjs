const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const extension = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'erp-fixture.html'), 'utf8');
const profile = {userId: 'DEMO-ACCOUNT', password: 'synthetic-password', autoFill: true, answers: [
  {question: 'Which demo color?', answer: 'test-blue'},
  {question: 'Which demo animal?', answer: 'test-otter'},
  {question: 'Which demo season?', answer: 'test-spring'}
]};
const passphrase = 'synthetic vault phrase only';
const checks = [];
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-extension-test-'));

(async () => {
  let context;
  const errors = [];
  try {
    context = await chromium.launchPersistentContext(userData, {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', {timeout: 15000});
    const id = new URL(worker.url()).host;
    // Intercept every ERP request; no test talks to the live ERP service.
    await context.route('https://erp.iitkgp.ac.in/**', route => route.fulfill({contentType: 'text/html', body: fixture}));
    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${id}/options.html`);
    if (process.env.ERP_TEST_SCREENSHOTS === '1') {
      fs.mkdirSync(path.join(extension, 'test-results'), {recursive: true});
      await settings.screenshot({path: path.join(extension, 'test-results', 'settings.png'), fullPage: true});
    }
    const message = (type, data = {}) => settings.evaluate(payload => chrome.runtime.sendMessage(payload), {type, ...data});
    const openERP = async params => {
      const page = await context.newPage();
      await page.goto('https://erp.iitkgp.ac.in/SSOAdministration/login.htm?' + new URLSearchParams(params));
      await page.waitForSelector('#iitkgp-erp-autofill');
      return page;
    };
    async function sendTo(page, type = 'ERP_SEND_OTP') {
      // The test obtains tab IDs in the worker, without exposing real browsing data.
      const targetId = await worker.evaluate(async url => {
        const tabs = await chrome.tabs.query({});
        const matching = tabs.find(tab => tab.url === url);
        if (matching) return matching.id;
        // URLs for matched hosts may be redacted without tabs permission. Match
        // this newly opened fixture tab by activation instead.
        return tabs.find(tab => tab.active).id;
      }, page.url());
      return settings.evaluate(({targetId, type}) => chrome.tabs.sendMessage(targetId, {type}), {targetId, type});
    }

    const lockedPage = await openERP({case: 'locked'});
    await lockedPage.waitForTimeout(650);
    assert.equal(await lockedPage.locator('#password').inputValue(), '');
    checks.push('Unconfigured vault never fills credentials');
    await lockedPage.close();

    // Exercise the real settings form rather than just the background API.
    await settings.locator('#user-id').fill(profile.userId);
    await settings.locator('#erp-password').fill(profile.password);
    for (let i = 0; i < profile.answers.length; i++) {
      if (i) await settings.locator('#add-question').click();
      await settings.locator('.question').nth(i).fill(profile.answers[i].question);
      await settings.locator('.answer').nth(i).fill(profile.answers[i].answer);
    }
    await settings.locator('#vault-passphrase').fill(passphrase);
    await settings.locator('#confirm-passphrase').fill(passphrase);
    await settings.locator('button[type=submit]').click();
    await settings.waitForFunction(() => document.querySelector('#status').textContent.includes('Encrypted profile saved'));
    const stored = await worker.evaluate(() => chrome.storage.local.get(null));
    for (const value of [profile.userId, profile.password, ...profile.answers.flatMap(a => [a.question, a.answer]), passphrase]) assert.ok(!JSON.stringify(stored).includes(value));
    assert.equal(await settings.locator('#erp-password').inputValue(), '');
    checks.push('Settings save an encrypted vault and clear the form');

    for (const entry of profile.answers) {
      const page = await openERP({question: entry.question, delay: '600'});
      await page.waitForFunction(answer => document.querySelector('#answer').value === answer, entry.answer);
      assert.equal(await page.locator('#user_id').inputValue(), profile.userId);
      assert.equal(await page.locator('#password').inputValue(), profile.password);
      assert.equal(await page.evaluate(() => otpRequests), 0);
      assert.equal((await sendTo(page)).ok, true);
      assert.equal((await sendTo(page)).ok, false);
      assert.equal(await page.evaluate(() => otpRequests), 1);
      assert.equal(await page.evaluate(() => loginRequests), 0);
      await page.close();
    }
    checks.push('All three synthetic questions fill; OTP is explicit, single, and never logs in');

    const unknown = await openERP({question: 'Unconfigured demo question?'});
    await unknown.waitForTimeout(750);
    assert.equal((await sendTo(unknown)).ok, false);
    assert.equal(await unknown.locator('#answer').inputValue(), '');
    assert.equal(await unknown.evaluate(() => otpRequests), 0);
    await unknown.close();
    checks.push('Unknown questions cannot trigger OTP');

    const cooldown = await openERP({case: 'cooldown'});
    await cooldown.waitForFunction(() => document.querySelector('#answer').value.length > 0);
    await cooldown.evaluate(() => { document.querySelector('#getotp').disabled = true; });
    assert.equal((await sendTo(cooldown)).ok, false);
    assert.equal(await cooldown.evaluate(() => otpRequests), 0);
    await cooldown.close();
    checks.push('An existing ERP resend cooldown is respected');

    const pending = await openERP({delay: '1500'});
    await pending.waitForTimeout(650);
    assert.equal((await message('LOCK')).ok, true);
    await pending.waitForTimeout(1800);
    assert.equal(await pending.locator('#answer').inputValue(), '');
    assert.equal(await pending.evaluate(() => otpRequests), 0);
    await pending.close();
    assert.equal((await message('UNLOCK', {passphrase: 'wrong passphrase'})).ok, false);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('#passphrase').fill(passphrase);
    await popup.locator('button[type=submit]').click();
    await popup.waitForFunction(() => !document.querySelector('#actions').hidden);
    assert.equal(await popup.locator('#passphrase').inputValue(), '');
    await popup.close();
    checks.push('Lock cancels pending fill; wrong passphrase fails; popup unlock works');

    assert.equal((await message('SAVE_PROFILE', {profile: {...profile, autoFill: false}, passphrase})).ok, true);
    const manual = await openERP({case: 'manual'});
    await manual.waitForTimeout(650);
    assert.equal(await manual.locator('#password').inputValue(), '');
    assert.equal((await sendTo(manual, 'ERP_FILL')).ok, true);
    assert.equal(await manual.evaluate(() => otpRequests), 0);
    await manual.close();
    checks.push('Automatic fill can be disabled while manual fill still works');

    const timeoutPage = await openERP({timeout: '1'});
    await timeoutPage.waitForTimeout(650);
    const timedOut = await sendTo(timeoutPage, 'ERP_SEND_OTP');
    assert.equal(timedOut.ok, false);
    assert.match(timedOut.message, /did not load/);
    assert.equal(await timeoutPage.evaluate(() => otpRequests), 0);
    await timeoutPage.close();
    checks.push('Question lookup timeout never sends OTP');

    const denied = await worker.evaluate(async () => {
      const fake = {id: chrome.runtime.id, tab: {id: 999}, frameId: 0, url: 'https://example.org/'};
      return {
        profile: await handle({type: 'GET_PROFILE'}, fake),
        settings: await handle({type: 'GET_SETTINGS'}, fake),
        iframe: await handle({type: 'GET_PROFILE'}, {...fake, frameId: 1, url: 'https://erp.iitkgp.ac.in/SSOAdministration/login.htm'}),
        wrongPath: await handle({type: 'GET_PROFILE'}, {...fake, url: 'https://erp.iitkgp.ac.in/other.htm'})
      };
    });
    assert.ok(Object.values(denied).every(result => result.ok === false && !result.profile));
    checks.push('Wrong origins, unrelated paths and subframes cannot retrieve credentials');

    assert.equal((await message('DELETE_PROFILE')).ok, true);
    const empty = await worker.evaluate(async () => ({local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null)}));
    assert.deepEqual(empty, {local: {}, session: {}});
    checks.push('Delete removes encrypted and unlocked profiles');
    assert.deepEqual(errors, []);

    // Full browser exit must retain encrypted data but discard the unlock.
    assert.equal((await message('SAVE_PROFILE', {profile, passphrase})).ok, true);
    await context.close();
    context = await chromium.launchPersistentContext(userData, {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    const fresh = await context.newPage();
    await fresh.goto(`chrome-extension://${id}/popup.html`);
    const afterRestart = await fresh.evaluate(() => chrome.runtime.sendMessage({type: 'GET_STATUS'}));
    assert.equal(afterRestart.configured, true);
    assert.equal(afterRestart.unlocked, false);
    await fresh.waitForFunction(() => !document.querySelector('#unlock-form').hidden);
    if (process.env.ERP_TEST_SCREENSHOTS === '1') {
      await fresh.setViewportSize({width: 360, height: 620});
      await fresh.screenshot({path: path.join(extension, 'test-results', 'popup.png')});
    }
    checks.push('Browser restart retains the encrypted vault but requires unlocking again');
    console.log(checks.map(check => 'PASS ' + check).join('\n'));
  } finally {
    if (context) await context.close();
    // Only the temporary directory created by this test is removed.
    assert.equal(path.dirname(path.resolve(userData)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(userData).startsWith('erp-extension-test-'));
    fs.rmSync(userData, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
