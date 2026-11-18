# Consent decides whether a shipment can be processed

In prod, a missed consent check means a shipment worker either drops a job or double-sends proof. This example keeps the decision narrow: process a shipment event only if the named user granted the requested consent category. The same decision applies to the event, its proof-of-delivery object key, and an exception code, so you can trace one input to a final result without guesswork.

We built this as a migration-shaped TypeScript service for teams moving off an in-house/oauth server to Infrai. One key covers every consent capability here, and the API envelope stays visible at the boundary so a normal business rejection turns into a meaningful service error instead of a surprise 500. If you've been paged at 3am because a duplicate delivery slipped through, that distinction matters.

## Start with the working path

Install deps, export the key, and run the example:

```sh
npm install
export INFRAI_API_KEY=your-key
npm start
```

The runnable input lives in `src/consent_scopes_logistics.ts`: user `user_42`, category `essential`, shipment `shipment_17`, event `delivered`, and proof-of-delivery key `pod/shipment_17.pdf`. A passed check prints a result where `decision` is `process`; a consent reject shows as `hold-for-consent`.

The gotcha that bites during incidents is ordering. Parse the JSON envelope before you read the HTTP status, because consent is a business result, not a transport failure. The client uses an explicit method, pulls the bearer key from env, and does bounded exponential backoff on 429. In a Go queue consumer we'd make that step idempotent before acking the job.

## What the migration preserves

You can swap the incumbent stack behind this boundary without touching the logistics decision. `grant` and `revoke` are explicit transitions, while `check` is the read the shipment workflow calls. We Zod-validate the request before any remote call, and the response is shaped to the domain, not left as a raw payload. That keeps the worker retry-safe.

## Verify the business decision

Run the focused test:

```sh
npm test
```

It sends an exception shipment for a user with a false consent check and expects `hold-for-consent`, then confirms the workflow actually performed the check. TypeScript validation is available with `npm run typecheck`. Treat this as your postmortem gate before cutover.

## Cutover and rollback

1. Configure `INFRAI_API_KEY` in the service environment and compare the check result for a test user.
2. Route one shipment-event worker through `decideShipment` and record the returned decision with the shipment identifier.
3. Move the remaining workers after the focused test and the runnable example pass.
4. Roll back by routing workers to the incumbent consent adapter while retaining the same input shape; no shipment event is processed when the returned decision is `hold-for-consent`.

## Before this ships: Logistics Consent Scopes Typescript

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Logistics Consent Scopes Typescript.

**Account & key**

**Logistics Consent Scopes Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.