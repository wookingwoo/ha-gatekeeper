import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicIp } from "./publicIp.js";

test("only tunnel loopback peers may supply one valid Cloudflare IP", () => {
  for (const peer of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) {
    assert.equal(resolvePublicIp(peer, "203.0.113.1", true), "203.0.113.1");
    for (const header of [undefined, "", "bad", "203.0.113.1, 203.0.113.2", ["203.0.113.1"]]) {
      assert.equal(resolvePublicIp(peer, header, true), peer === "::ffff:127.0.0.1" ? "127.0.0.1" : peer);
    }
  }
  assert.equal(resolvePublicIp("0:0:0:0:0:ffff:7f00:1", "203.0.113.1", true), "203.0.113.1");
  assert.equal(resolvePublicIp("192.0.2.1", "203.0.113.1", true), "192.0.2.1");
  assert.equal(resolvePublicIp("127.0.0.1", "203.0.113.1", false), "127.0.0.1");
  assert.equal(resolvePublicIp("127.0.0.1", "::ffff:203.0.113.1", true), "203.0.113.1");
});

test("scoped forwarded IPv6 falls back and scoped peers preserve loopback trust", () => {
  assert.equal(resolvePublicIp("127.0.0.1", "fe80::1%eth0", true), "127.0.0.1");
  assert.equal(resolvePublicIp("fe80::1%eth0", "203.0.113.1", true), "fe80::1");
  assert.equal(resolvePublicIp("fe80::1%eth0", undefined, false), "fe80::1");
  assert.equal(resolvePublicIp("::1%lo", "203.0.113.1", true), "203.0.113.1");
});
