import assert from "node:assert";
import { foldToken, plainValue } from "../argv.js";
import { step, close } from "../argvrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, options: { a: "flag", b: "value" },
  state: { values: [], rest: [], pending: "", literal: false, ledger: [], applied: [] },
  events: [{ id: 1, kind: "arg", text: "-a" }],
  option_error_code: "E_UNKNOWN_OPTION", value_error_code: "E_MISSING_VALUE",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("foldToken returns a state", () => {
  const got = foldToken({ values: [], rest: [], pending: "", literal: false }, "-a", { a: "flag" });
  assert.strictEqual(typeof got, "object");
});

check("plainValue returns a state", () => {
  const got = plainValue({ values: [], rest: [], pending: "", literal: false }, "x");
  assert.strictEqual(typeof got, "object");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
