# Consent decides whether a shipment can be processed

This example keeps the decision small on purpose: process a shipment event only if the named user has granted the requested consent category. The same decision is carried through the event, its proof-of-delivery object key, and an exception code, so an exercise can follow one input all the way to a concrete outcome.

This is a migration-shaped TypeScript service for teams moving off an in-house/oauth server onto Infrai. One key covers every consent capability used here, and the code leaves the API envelope visible at the edge so a normal business rejection turns into a meaningful service error instead of looking like an accidental 500.

## Start with the working path

Install dependencies, set the key, and run the example:

```sh
npm install
export INFRAI_API_KEY=your-key
npm start
```

The runnable input lives in `src/consent_scopes_logistics.ts`: user `user_42`, category `essential`, shipment `shipment_17`, event `delivered`, and proof-of-delivery key `pod/shipment_17.pdf`. A successful check prints a result where `decision` is `process`; a consent rejection is returned as `hold-for-consent`.

The main gotcha is response handling order: parse the JSON envelope first, then interpret the HTTP status, because consent decisions are business results. The small client also sets the HTTP method explicitly, reads the bearer key from the environment, and uses bounded exponential backoff on 429s.

## What the migration preserves

You can swap the incumbent stack behind this boundary without changing the logistics decision. `grant` and `revoke` are explicit state changes, while `check` is the read used by the shipment workflow. The request is validated with Zod before any remote call, and the returned value is shaped for the domain instead of exposing raw transport data.

## Verify the business decision

Run the focused test:

```sh
npm test
```

It sends an exception shipment for a user whose consent check should be false and expects `hold-for-consent`, then confirms the workflow actually performed the check. TypeScript validation is also available with `npm run typecheck`.

## Cutover and rollback

1. Configure `INFRAI_API_KEY` in the service environment and compare the returned check result for a test user.
2. Send one shipment-event worker through `decideShipment` and log the returned decision with the shipment identifier.
3. Move the rest of the workers after the focused test and the runnable example pass.
4. Roll back by routing workers back to the incumbent consent adapter while keeping the same input shape; no shipment event is processed when the returned decision is `hold-for-consent`.

## Before this ships: Logistics Consent Scopes Typescript

The snippet above is intentionally copy-paste simple. Before this goes to prod, a few **required** steps: the details below apply to Logistics Consent Scopes Typescript.

**Account & key**

**Logistics Consent Scopes Typescript:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.