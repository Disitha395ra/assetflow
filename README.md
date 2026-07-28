# AssetFlow

AssetFlow is SCOT's Firebase-backed company asset management system.

## Features

- IT and non-IT asset registers
- Employee assignments, returns and clearance records
- Permanent QR pages with current custodian and lifecycle history
- Batch printing of 24 QR labels per A4 sheet
- Time-boxed department requirement forms
- Excel exports and printable handover documents
- Administrator access restricted to `it@scot.lk`

## Run locally

```bash
npm install
npm run dev
```

## Deploy

The application is a standard Next.js project and can be imported directly into
Vercel. Firebase's public web configuration is included as a deployment-safe
fallback; the same values can be overridden with `NEXT_PUBLIC_FIREBASE_*`
environment variables.
