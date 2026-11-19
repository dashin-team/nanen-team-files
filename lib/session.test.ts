import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLoginFailures,
  DEFAULT_GATE_PASSWORD,
  getSessionSecret,
  getTeamPassword,
  loginBlocked,
  passwordsMatch,
  recordLoginFailure,
  resetLoginFailuresForTests,
  signSession,
  verifySession,
} from "./session";

test("password compare keeps Han characters and tolerates phone whitespace", () => {
  assert.equal(passwordsMatch("正確密碼", "正確密碼"), true);
  assert.equal(passwordsMatch("正確密碼", "錯誤密碼"), false);
  assert.equal(passwordsMatch("正確密碼", "正確密碼 "), true);
  assert.equal(passwordsMatch("正確 密碼", "正確密碼"), false);
  assert.equal(passwordsMatch("仕翰", "仕翰"), true);
  assert.equal(passwordsMatch("仕翰\n", "仕翰"), true);
  assert.equal(passwordsMatch("仕\u200b翰", "仕翰"), true);
  assert.equal(passwordsMatch("仕翰".normalize("NFC"), "仕翰".normalize("NFD")), true);
  assert.equal(passwordsMatch("shihan", "仕翰"), false);
  assert.equal(passwordsMatch("仕", "仕翰"), false);
  assert.equal(passwordsMatch("仕翰翰", "仕翰"), false);
});

test("unset TEAM_PASSWORD defaults to 仕翰", () => {
  const previous = process.env.TEAM_PASSWORD;
  try {
    delete process.env.TEAM_PASSWORD;
    assert.equal(getTeamPassword(), DEFAULT_GATE_PASSWORD);
    assert.equal(DEFAULT_GATE_PASSWORD, "仕翰");
    process.env.TEAM_PASSWORD = "  仕翰\u200b ";
    assert.equal(getTeamPassword(), "仕翰");
    process.env.TEAM_PASSWORD = "別的密碼";
    assert.equal(getTeamPassword(), "別的密碼");
    assert.equal(passwordsMatch("仕翰", getTeamPassword()), false);
  } finally {
    if (previous === undefined) delete process.env.TEAM_PASSWORD;
    else process.env.TEAM_PASSWORD = previous;
  }
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
