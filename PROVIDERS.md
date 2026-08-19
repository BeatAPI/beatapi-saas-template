# Provider Matrix

## Support levels

- **Default:** primary setup path, automated contract tests, and owned release gate.
- **Optional:** maintained adapter, settings schema, webhook verification, and manual sandbox checklist.
- **Add-on:** isolated regional integration that can be removed without affecting the default build.

Compilation alone is not proof that a provider works. Public documentation should say **verified** only after the relevant sandbox or paid end-to-end record exists.

## Email

| Provider | Level | Required values |
| --- | --- | --- |
| Resend | Default | `RESEND_API_KEY`, `RESEND_SENDER_EMAIL` |
| Mailgun | Optional | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_SENDER_EMAIL`, `MAILGUN_REGION` |

Set `DEFAULT_EMAIL_PROVIDER` to `resend` or `mailgun`. Better Auth sends verification and password-reset mail through the shared email manager.

## Payments

| Provider | Level | Catalog behavior |
| --- | --- | --- |
| Stripe | Default | Dynamic checkout pricing from the local plan |
| Creem | Optional | External product mapping |
| Lemon Squeezy | Optional | External variant mapping |
| Paddle | Optional | External price mapping |
| PayPal | Optional | Provider adapter mapping |
| Alipay | Add-on | China payments boundary |
| WeChat Pay | Add-on | China payments boundary |

For optional hosted-checkout providers, configure a JSON map from the starter's local product IDs to provider-owned catalog IDs:

```env
PAYMENT_CATALOG_JSON={"lemonsqueezy":{"starter_monthly":"123456"},"paddle":{"starter_monthly":"pri_..."}}
```

Every payment adapter must:

1. Create a provider-scoped hosted checkout.
2. Preserve the local order number and product ID in provider metadata.
3. Verify the raw webhook payload before parsing trusted fields.
4. Normalize a stable external event ID.
5. Claim `(provider, externalEventId)` before fulfillment.
6. Match the local order inside the same provider boundary.

## Database and storage

- PostgreSQL is the supported production database.
- Cloudflare Workers connect through Hyperdrive.
- SQLite is limited to local tests and previews.
- Cloudflare R2 stores uploads and generated output.
- Supabase Auth and Supabase Storage are intentionally not part of this starter.

## Verification record

Before release, record the environment, date, provider mode, checkout/task ID, webhook result, and final local order/task state. Keep secrets and customer data out of the record.
