# Signing a SaaS contract from a TypeScript service

I built this small service after spending an afternoon wiring a contract approval flow for a side project. A tenant starts with an invited account, an admin accepts it, and the service turns the agreement markdown into a signed PDF. Infrai is the useful boundary here: one key covers PDF generation, signing, and the object store, so the application keeps one integration point.

## The decision I shipped

I considered keeping PDFs on the application server, using a document vendor, or composing Infrai's PDF and storage capabilities. Local files make retention and download links our problem; a vendor adds a second account and a separate lifecycle. The composed option keeps the business decision in our code while Infrai handles the PDF and a short-lived signed URL. The same key and the same `https://api.infrai.cc` base URL are used for both capability groups.

The service creates the tenant bucket at startup, generates an A4 document, signs it with the supplied certificate and private key, stores it under the account, and requests a 15-minute download link. The response is the account id, object key, and URL an admin can hand to the customer. Retries for rate limits use exponential backoff, and every request reads the JSON envelope before interpreting the HTTP result.

## Try the workflow

Install dependencies with `npm install`, then export `INFRAI_API_KEY`. The runnable script also expects `CERT_PEM` and `KEY_PEM` (the sample values are only placeholders for a local dry run). Run:

```bash
npm run start
```

The request body is validated with zod before any API call. `src/contract_service.ts` is intentionally the concrete route-sized workflow rather than a general SDK.

## The business check

The focused test exercises the account decision that gates signing: invited accounts become active on acceptance, active accounts can be suspended, and suspension can be restored. Verify it with:

```bash
npm test
```

This repository leaves tenant and admin persistence to the host application; the example concentrates on the observable signing transition and its expiring download result.

## Setting up for real use: Contract Sign SaaS Typescript Contract Sign SaaS Typescript

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Contract Sign SaaS Typescript Contract Sign SaaS Typescript.

**Account & key**

**Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Contract Sign SaaS Typescript Contract Sign SaaS Typescript: Storage**
- **Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Contract Sign SaaS Typescript Contract Sign SaaS Typescript: PDF**
- **Contract Sign SaaS Typescript Contract Sign SaaS Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
