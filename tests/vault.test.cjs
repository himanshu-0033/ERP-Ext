const {test} = require('node:test');
const assert = require('node:assert/strict');
const vault = require('../vault.js');
const profile = {userId: 'DEMO-ACCOUNT', password: 'synthetic-password', autoFill: true,
  answers: [{question: 'Which demo color?', answer: 'test-blue'}]};
const passphrase = 'synthetic vault phrase only';

test('encrypted profile round-trips without plaintext fields in storage', async () => {
  const stored = await vault.encrypt(profile, passphrase);
  for (const value of [profile.userId, profile.password, profile.answers[0].question, profile.answers[0].answer, passphrase]) {
    assert.ok(!JSON.stringify(stored).includes(value));
  }
  assert.deepEqual(await vault.decrypt(stored, passphrase), profile);
  const second = await vault.encrypt(profile, passphrase);
  assert.notEqual(stored.salt, second.salt);
  assert.notEqual(stored.iv, second.iv);
  assert.notEqual(stored.ciphertext, second.ciphertext);
});
test('wrong passphrase and tampered ciphertext are rejected', async () => {
  const stored = await vault.encrypt(profile, passphrase);
  await assert.rejects(vault.decrypt(stored, 'wrong synthetic phrase'), /Could not unlock/);
  const bytes = Buffer.from(stored.ciphertext, 'base64');
  bytes[0] ^= 1;
  await assert.rejects(vault.decrypt({...stored, ciphertext: bytes.toString('base64')}, passphrase), /Could not unlock/);
  await assert.rejects(vault.decrypt({...stored, iterations: 1}, passphrase), /Could not unlock/);
});
test('empty profiles, missing answers, duplicate questions and short passphrases are rejected', async () => {
  assert.throws(() => vault.validateProfile({}), /Enter a user ID/);
  assert.throws(() => vault.validateProfile({...profile, answers: [{question: 'Demo?', answer: ''}]}), /both/);
  assert.throws(() => vault.validateProfile({...profile, answers: [{question: 'Demo?', answer: 'a'}, {question: 'DEMO', answer: 'b'}]}), /duplicate/);
  await assert.rejects(vault.encrypt(profile, 'short'), /12/);
});
test('question normalization preserves words and answers preserve case', () => {
  assert.equal(vault.normalize('Which DEMO color?'), vault.normalize('which demo color'));
  assert.notEqual(vault.normalize('Which demo color?'), vault.normalize('Which other color?'));
  assert.equal(vault.validateProfile({...profile, answers: [{question: 'Demo?', answer: 'Case Sensitive'}]}).answers[0].answer, 'Case Sensitive');
});
