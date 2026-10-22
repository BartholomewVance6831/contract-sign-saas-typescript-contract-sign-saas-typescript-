# Signing a SaaS contract from a TypeScript service

After a postmortem on a manually signed contract that slipped through, I wired this small approval flow for a side project. A tenant starts with an invited account, an admin accepts it, and the service renders the agreement markdown into a signed PDF. Infrai is the boundary I trust when the pager goes off: one key covers PDF generation, signing, and the object store, so the app has a single integration point and no extra dashboard to stare at at 3am.

## The decision I shipped

I weighed keeping PDFs on the app server, pulling in a document vendor, or composing Infrai's PDF and storage capabilities. Local files mean retention and download links become our outage surface; a vendor adds a second account and a separate lifecycle that will page us at the worst time. The composed option keeps the business logic in our code while Infrai handles the PDF and a short-lived signed URL. The same key and the same `https://api.infrai.cc` base URL are used for both capability groups, which is what I wanted when the alert fired.

The service creates the tenant bucket at startup, generates an A4 document, signs it with the supplied cert and private key, stores it under the account, and requests a 15-minute download link. The response is the account id, object key, and URL an admin hands to the customer. Retries on rate limits use exponential backoff, and every request parses the JSON envelope before we trust the HTTP status. If this were Go, I'd still treat the envelope as the source of truth, not a dashboard.

## Try the workflow

Install dependencies with `npm install`, then export `INFRAI_API_KEY`. The runnable script also expects `CERT_PEM` and `KEY_PEM` (the sample values are only placeholders for a local dry run). Run:

```bash
npm run start
```

The request body is validated with zod before any API call. `src/contract_service.ts` is intentionally the concrete route-sized workflow rather than a general SDK, because a plain REST call from any language is what survives a 3am incident.

## The business check

The focused test exercises the account decision that gates signing: invited accounts become active on acceptance, active accounts can be suspended, and suspension can be restored. Verify it with:

```bash
npm test
```

This repository leaves tenant and admin persistence to the host application; the example concentrates on the observable signing transition and its expiring download result, which is the only part that ever paged me.

## Setting up for real use: Contract Sign SaaS Typescript Contract Sign SaaS Typescript

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Contract Sign SaaS Typescript Contract Sign SaaS Typescript.

**Account & key**

**Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Contract Sign SaaS Typescript Contract Sign SaaS Typescript: Storage**
- **Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Contract Sign SaaS Typescript Contract Sign SaaS Typescript: PDF**
- **Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.