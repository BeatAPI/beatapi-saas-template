type Configs = Record<string, string>;

type PaymentCatalog = Record<string, Record<string, string>>;

export function parsePaymentCatalog(value: string | undefined): PaymentCatalog {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PaymentCatalog;
  } catch {
    throw new Error('PAYMENT_CATALOG_JSON must be valid JSON');
  }
}

export function resolveProviderProductId({
  localProductId,
  provider,
  configs,
}: {
  localProductId: string;
  provider: string;
  configs: Configs;
}): string | undefined {
  if (provider === 'stripe') return undefined;
  const catalog = parsePaymentCatalog(configs.payment_catalog_json);
  const externalId = catalog[localProductId]?.[provider]?.trim();
  if (!externalId) {
    throw new Error(
      `Missing PAYMENT_CATALOG_JSON mapping for ${localProductId}.${provider}`
    );
  }
  return externalId;
}
