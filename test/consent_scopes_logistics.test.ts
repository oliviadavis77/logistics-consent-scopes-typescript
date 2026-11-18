import assert from "node:assert/strict";
import { test } from "node:test";
import { decideShipment } from "../src/consent_scopes_logistics.ts";

test("a revoked consent holds the shipment workflow", async () => {
  const calls: string[] = [];
  const client = {
    check: async () => { calls.push("check"); return { granted: false }; },
    grant: async () => { calls.push("grant"); },
    revoke: async () => { calls.push("revoke"); }
  };
  const result = await decideShipment({ userId: "u-7", consentCategory: "shipment-events", shipmentId: "s-9", eventType: "exception", proofOfDeliveryKey: "pod/s-9.pdf", exceptionCode: "ADDRESS_REVIEW" }, client);
  assert.equal(result.decision, "hold-for-consent");
  assert.deepEqual(calls, ["check"]);
});
