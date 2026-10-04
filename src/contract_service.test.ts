import { strict as assert } from "node:assert";
import { accountTransition } from "./contract_service.ts";

assert.equal(accountTransition("invited", "accept"), "active");
assert.equal(accountTransition("active", "suspend"), "suspended");
assert.equal(accountTransition("suspended", "restore"), "active");
console.log("account lifecycle transitions pass");
