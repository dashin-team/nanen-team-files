import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLoginFailures,
  getSessionSecret,
  loginBlocked,
  passwordsMatch,
  recordLoginFailure,
  resetLoginFailuresForTests,
  signSession,
  verifySession,
} from "./session";

test("password compare does not treat a different string as equal", () => {
  assert.equal(passwordsMatch("正確密碼", "正確密碼"), true);
  assert.equal(passwordsMatch("正確密碼", "錯誤密碼"), false);
  assert.equal(passwordsMatch("正確密碼", "正確密碼 "), false);
});

test("session cookie survives verification and rejects tampering", async () => {
  process.env.TEAM_PASSWORD = "team-demo-2026";
  delete process.env.SESSION_SECRET;
  const secret = getSessionSecret();
  const token = await signSession(secret, Date.now() + 60_000);
  assert.equal(await verifySession(token, secret), true);
  const [payload, signature] = token.split(".");
  const flipped = `${payload}.${signature!.slice(0, -1)}${signature!.endsWith("a") ? "b" : "a"}`;
  assert.equal(await verifySession(flipped, secret), false);
  const expired = await signSession(secret, Date.now() - 1000);
  assert.equal(await verifySession(expired, secret), false);
  assert.equal(await verifySession(undefined, secret), false);
});

test("login lockout starts after ten failures", () => {
  resetLoginFailuresForTests();
  const ip = "203.0.113.10";
  assert.equal(loginBlocked(ip), false);
  for (let count = 0; count < 10; count += 1) recordLoginFailure(ip);
  assert.equal(loginBlocked(ip), true);
  clearLoginFailures(ip);
  assert.equal(loginBlocked(ip), false);
});
