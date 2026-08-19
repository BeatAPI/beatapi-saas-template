type PricingPrimitive = string | number | boolean;

export type PricingInput = Record<string, unknown>;

type LegacyInputField = 'required' | 'optional';

type EnumFieldSchema = {
  type: 'enum';
  required?: boolean;
  values: PricingPrimitive[];
};

type BooleanFieldSchema = {
  type: 'boolean';
  required?: boolean;
};

type StringFieldSchema = {
  type: 'string';
  required?: boolean;
};

type NumberFieldSchema = {
  type: 'number';
  required?: boolean;
};

type AnyFieldSchema = {
  type: 'any';
  required?: boolean;
};

export type EffectInputFieldSchema =
  | EnumFieldSchema
  | BooleanFieldSchema
  | StringFieldSchema
  | NumberFieldSchema
  | AnyFieldSchema;

export type EffectInputSchema = Record<
  string,
  LegacyInputField | EffectInputFieldSchema
>;

type PricingRule = {
  when: Record<string, PricingPrimitive>;
  credits: number;
};

type FixedPricingSchema = {
  version: 1;
  strategy: 'fixed';
  credits: number;
};

type MatrixPricingSchema = {
  version: 1;
  strategy: 'matrix';
  fallbackCredits?: number;
  rules: PricingRule[];
};

type PerSecondPricingSchema = {
  version: 1;
  strategy: 'per-second';
  durationField: string;
  durationCapField?: string;
  durationMultiplier?: number;
  rounding?: 'ceil' | 'floor' | 'round';
  fixedRate?: number;
  rates: Record<string, Record<string, number>>;
  fallbackCredits?: number;
};

export type EffectPricingSchema =
  | FixedPricingSchema
  | MatrixPricingSchema
  | PerSecondPricingSchema;

export type EstimateCreditsResult = {
  handled: boolean;
  credits: number | null;
  error?: string;
};

export type PricingEffectLike = {
  id?: number | null;
  credit?: number | null;
  provider?: string | null;
  inputSchema?: unknown;
  pricingSchema?: unknown;
};

type EstimateCreditsForEffectParams = {
  effect: PricingEffectLike;
  input: PricingInput;
  mode?: 'estimate' | 'submit';
};

type EstimateCreditsByProviderParams = {
  provider: string;
  input: PricingInput;
  baseCredit: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const VEO31_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'matrix',
  fallbackCredits: 10,
  rules: [
    {
      when: {
        mode: 'fast',
        wmDuration: '8s',
        wmOutputQuality: '1080p',
      },
      credits: 15,
    },
    {
      when: {
        mode: 'fast',
        wmDuration: '8s',
        wmOutputQuality: '4k',
      },
      credits: 30,
    },
    {
      when: {
        mode: 'quality',
        wmDuration: '8s',
        wmOutputQuality: '1080p',
      },
      credits: 60,
    },
    {
      when: {
        mode: 'quality',
        wmDuration: '8s',
        wmOutputQuality: '4k',
      },
      credits: 80,
    },
  ],
};

const GROK_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'matrix',
  fallbackCredits: 6,
  rules: [
    { when: { wmDuration: '6s', wmOutputQuality: '480p' }, credits: 6 },
    { when: { wmDuration: '10s', wmOutputQuality: '480p' }, credits: 12 },
    { when: { wmDuration: '15s', wmOutputQuality: '480p' }, credits: 18 },
    { when: { wmDuration: '6s', wmOutputQuality: '720p' }, credits: 12 },
    { when: { wmDuration: '10s', wmOutputQuality: '720p' }, credits: 18 },
    { when: { wmDuration: '15s', wmOutputQuality: '720p' }, credits: 24 },
  ],
};

const KLING_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'matrix',
  fallbackCredits: 30,
  rules: [
    { when: { wmDuration: '5s', wmSound: false }, credits: 30 },
    { when: { wmDuration: '10s', wmSound: false }, credits: 60 },
    { when: { wmDuration: '5s', wmSound: true }, credits: 60 },
    { when: { wmDuration: '10s', wmSound: true }, credits: 120 },
  ],
};

const SEEDANCE20_DURATION_OPTIONS = [
  '4s',
  '5s',
  '6s',
  '7s',
  '8s',
  '9s',
  '10s',
  '11s',
  '12s',
  '13s',
  '14s',
  '15s',
] as const;

const SEEDANCE20_OUTPUT_QUALITIES = ['480p', '720p'] as const;

const SEEDANCE20_CREDITS_BY_MODE = {
  quality: {
    withVideo: {
      '480p': [22, 28, 33, 39, 44, 50, 56, 61, 67, 72, 77, 82],
      '720p': [50, 61, 72, 84, 95, 106, 117, 128, 139, 150, 161, 172],
    },
    withoutVideo: {
      '480p': [37, 46, 56, 64, 74, 84, 92, 102, 112, 121, 130, 139],
      '720p': [84, 102, 120, 139, 158, 176, 195, 214, 232, 250, 268, 286],
    },
  },
  fast: {
    withVideo: {
      '480p': [17, 22, 26, 31, 36, 40, 44, 48, 53, 57, 61, 65],
      '720p': [40, 48, 58, 67, 76, 84, 93, 102, 112, 121, 130, 139],
    },
    withoutVideo: {
      '480p': [29, 37, 44, 52, 59, 67, 74, 81, 89, 96, 103, 110],
      '720p': [67, 81, 96, 112, 126, 141, 156, 171, 186, 200, 214, 228],
    },
  },
} as const satisfies Record<
  'quality' | 'fast',
  Record<
    'withVideo' | 'withoutVideo',
    Record<(typeof SEEDANCE20_OUTPUT_QUALITIES)[number], readonly number[]>
  >
>;

const createSeedance20PricingRules = () =>
  (['quality', 'fast'] as const).flatMap((mode) =>
    ([true, false] as const).flatMap((wmHasVideoInput) => {
      const videoKey = wmHasVideoInput ? 'withVideo' : 'withoutVideo';

      return SEEDANCE20_OUTPUT_QUALITIES.flatMap((wmOutputQuality) =>
        SEEDANCE20_DURATION_OPTIONS.map((wmDuration, index) => ({
          when: {
            mode,
            wmHasVideoInput,
            wmOutputQuality,
            wmDuration,
          },
          credits:
            SEEDANCE20_CREDITS_BY_MODE[mode][videoKey][wmOutputQuality][index],
        }))
      );
    })
  );

const SEEDANCE20_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'matrix',
  fallbackCredits: 30,
  rules: createSeedance20PricingRules(),
};

const NANO_BANANA_2_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'matrix',
  fallbackCredits: 3,
  rules: [
    { when: { wmOutputQuality: '1k' }, credits: 3 },
    { when: { wmOutputQuality: '2k' }, credits: 5 },
    { when: { wmOutputQuality: '4k' }, credits: 8 },
  ],
};

const NANO_BANANA_PRO_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'matrix',
  fallbackCredits: 5,
  rules: [
    { when: { wmOutputQuality: '2k' }, credits: 5 },
    { when: { wmOutputQuality: '4k' }, credits: 9 },
  ],
};

const NANO_BANANA_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'fixed',
  credits: 2,
};

const GPT_IMAGE_2_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'matrix',
  fallbackCredits: 2,
  rules: [
    { when: { wmOutputQuality: '1k' }, credits: 2 },
    { when: { wmOutputQuality: '2k' }, credits: 4 },
    { when: { wmOutputQuality: '4k' }, credits: 6 },
  ],
};

const ECOMMERCE_VIDEO_PRICING_SCHEMA: EffectPricingSchema = {
  version: 1,
  strategy: 'per-second',
  durationField: 'wmDuration',
  fixedRate: 20,
  rates: {},
  fallbackCredits: 300,
};

const LEGACY_PRICING_BY_PROVIDER: Record<string, EffectPricingSchema> = {
  'veo3.1': VEO31_PRICING_SCHEMA,
  'volcengine.seedance-2.0': SEEDANCE20_PRICING_SCHEMA,
  'kie.gpt-image-2': GPT_IMAGE_2_PRICING_SCHEMA,
  'evolink.gpt-image-2': GPT_IMAGE_2_PRICING_SCHEMA,
  'kie.grok-imagine': GROK_PRICING_SCHEMA,
  'kie.nano-banana-2': NANO_BANANA_2_PRICING_SCHEMA,
  'kie.nano-banana-pro': NANO_BANANA_PRO_PRICING_SCHEMA,
  'kie.nano-banana': NANO_BANANA_PRICING_SCHEMA,
};

const LEGACY_PRICING_BY_EFFECT_ID: Record<number, EffectPricingSchema> = {
  15: ECOMMERCE_VIDEO_PRICING_SCHEMA,
};

const normalizeInputSchema = (schema: unknown): EffectInputSchema | null => {
  if (!isRecord(schema)) return null;
  return schema as EffectInputSchema;
};

const normalizePricingSchema = (
  schema: unknown
): EffectPricingSchema | null => {
  if (!isRecord(schema)) return null;

  const version = schema.version;
  const strategy = schema.strategy;
  if (version !== 1) return null;

  if (strategy === 'fixed' && typeof schema.credits === 'number') {
    return {
      version: 1,
      strategy: 'fixed',
      credits: schema.credits,
    };
  }

  if (strategy === 'matrix' && Array.isArray(schema.rules)) {
    const rules = schema.rules
      .map((rule) => {
        if (!isRecord(rule) || !isRecord(rule.when)) return null;
        if (typeof rule.credits !== 'number') return null;
        const entries = Object.entries(rule.when).every(([, value]) =>
          ['string', 'number', 'boolean'].includes(typeof value)
        );
        if (!entries) return null;

        return {
          when: rule.when as Record<string, PricingPrimitive>,
          credits: rule.credits,
        };
      })
      .filter((rule): rule is PricingRule => rule !== null);

    return {
      version: 1,
      strategy: 'matrix',
      fallbackCredits:
        typeof schema.fallbackCredits === 'number'
          ? schema.fallbackCredits
          : undefined,
      rules,
    };
  }

  if (
    strategy === 'per-second' &&
    typeof schema.durationField === 'string' &&
    isRecord(schema.rates)
  ) {
    const rates = Object.fromEntries(
      Object.entries(schema.rates)
        .map(([field, value]) => {
          if (!isRecord(value)) return null;
          const normalizedFieldRates = Object.fromEntries(
            Object.entries(value).filter(
              ([, rate]) => typeof rate === 'number' && Number.isFinite(rate)
            )
          );
          return [field, normalizedFieldRates];
        })
        .filter(
          (entry): entry is [string, Record<string, number>] => entry !== null
        )
    );

    return {
      version: 1,
      strategy: 'per-second',
      durationField: schema.durationField,
      durationCapField:
        typeof schema.durationCapField === 'string'
          ? schema.durationCapField
          : undefined,
      durationMultiplier:
        typeof schema.durationMultiplier === 'number' &&
        Number.isFinite(schema.durationMultiplier) &&
        schema.durationMultiplier > 0
          ? schema.durationMultiplier
          : undefined,
      rounding:
        schema.rounding === 'floor' || schema.rounding === 'round'
          ? schema.rounding
          : 'ceil',
      fixedRate:
        typeof schema.fixedRate === 'number' && Number.isFinite(schema.fixedRate)
          ? schema.fixedRate
          : undefined,
      rates,
      fallbackCredits:
        typeof schema.fallbackCredits === 'number'
          ? schema.fallbackCredits
          : undefined,
    };
  }

  return null;
};

const normalizeFieldSchema = (
  field: LegacyInputField | EffectInputFieldSchema
): EffectInputFieldSchema => {
  if (field === 'required') {
    return {
      type: 'any',
      required: true,
    };
  }

  if (field === 'optional') {
    return {
      type: 'any',
      required: false,
    };
  }

  return field;
};

const isMissingValue = (value: unknown) =>
  value === undefined || value === null || value === '';

const validateInput = ({
  input,
  inputSchema,
  requireAllRequiredFields,
}: {
  input: PricingInput;
  inputSchema: EffectInputSchema | null;
  requireAllRequiredFields: boolean;
}) => {
  if (!inputSchema) return null;

  for (const [key, fieldSchema] of Object.entries(inputSchema)) {
    const schema = normalizeFieldSchema(fieldSchema);
    const value = input[key];

    if (isMissingValue(value)) {
      if (schema.required && requireAllRequiredFields) {
        return `${key} is required`;
      }
      continue;
    }

    if (schema.type === 'enum') {
      if (!schema.values.includes(value as PricingPrimitive)) {
        return `${key} must be one of: ${schema.values.join(', ')}`;
      }
      continue;
    }

    if (schema.type === 'boolean' && typeof value !== 'boolean') {
      return `${key} must be a boolean`;
    }

    if (schema.type === 'string' && typeof value !== 'string') {
      return `${key} must be a string`;
    }

    if (schema.type === 'number' && typeof value !== 'number') {
      return `${key} must be a number`;
    }
  }

  return null;
};

const getFallbackCredits = (
  effect: PricingEffectLike,
  schema?: EffectPricingSchema | null
) =>
  (schema?.strategy === 'matrix' || schema?.strategy === 'per-second') &&
  typeof schema.fallbackCredits === 'number'
    ? schema.fallbackCredits
    : typeof effect.credit === 'number'
      ? effect.credit
      : 0;

const getPricingSchemaForEffect = (
  effect: PricingEffectLike
): EffectPricingSchema | null => {
  if (effect.provider && LEGACY_PRICING_BY_PROVIDER[effect.provider]) {
    return LEGACY_PRICING_BY_PROVIDER[effect.provider];
  }

  const explicitSchema = normalizePricingSchema(effect.pricingSchema);
  if (explicitSchema) {
    return explicitSchema;
  }

  if (
    typeof effect.id === 'number' &&
    LEGACY_PRICING_BY_EFFECT_ID[effect.id]
  ) {
    return LEGACY_PRICING_BY_EFFECT_ID[effect.id];
  }

  return null;
};

const readDurationSeconds = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  const match = trimmedValue.match(/^(\d+(?:\.\d+)?)s?$/i);
  if (!match?.[1]) {
    return null;
  }

  const parsedValue = Number.parseFloat(match[1]);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

export const estimateCreditsForEffect = ({
  effect,
  input,
  mode = 'estimate',
}: EstimateCreditsForEffectParams): EstimateCreditsResult => {
  const inputSchema = normalizeInputSchema(effect.inputSchema);
  const validationError = validateInput({
    input,
    inputSchema,
    requireAllRequiredFields: mode === 'submit',
  });
  if (validationError) {
    return {
      handled: true,
      credits: null,
      error: validationError,
    };
  }

  const pricingSchema = getPricingSchemaForEffect(effect);
  if (!pricingSchema) {
    return {
      handled: false,
      credits: getFallbackCredits(effect),
    };
  }

  if (pricingSchema.strategy === 'fixed') {
    return {
      handled: true,
      credits: pricingSchema.credits,
    };
  }

  if (pricingSchema.strategy === 'per-second') {
    const durationRaw = input[pricingSchema.durationField];
    const durationSeconds = readDurationSeconds(durationRaw);
    const durationCapSeconds = pricingSchema.durationCapField
      ? readDurationSeconds(input[pricingSchema.durationCapField])
      : null;
    const [rateField, rateMap] = Object.entries(pricingSchema.rates)[0] ?? [];
    const rateValue =
      typeof pricingSchema.fixedRate === 'number'
        ? pricingSchema.fixedRate
        : typeof rateField === 'string' &&
            rateMap &&
            typeof input[rateField] === 'string'
          ? rateMap[input[rateField] as string]
          : null;

    if (durationSeconds !== null && typeof rateValue === 'number') {
      const cappedDurationSeconds =
        durationCapSeconds !== null
          ? Math.min(durationSeconds, durationCapSeconds)
          : durationSeconds;
      const billableSeconds =
        cappedDurationSeconds * (pricingSchema.durationMultiplier ?? 1);
      const roundedSeconds =
        pricingSchema.rounding === 'floor'
          ? Math.floor(billableSeconds)
          : pricingSchema.rounding === 'round'
            ? Math.round(billableSeconds)
            : Math.ceil(billableSeconds);

      return {
        handled: true,
        credits: Math.max(0, roundedSeconds) * rateValue,
      };
    }

    return {
      handled: true,
      credits: getFallbackCredits(effect, pricingSchema),
    };
  }

  const matchedRule = pricingSchema.rules.find((rule) =>
    Object.entries(rule.when).every(([key, value]) => input[key] === value)
  );

  if (matchedRule) {
    return {
      handled: true,
      credits: matchedRule.credits,
    };
  }

  return {
    handled: true,
    credits: getFallbackCredits(effect, pricingSchema),
  };
};

export const estimateCreditsByProvider = ({
  provider,
  input,
  baseCredit,
}: EstimateCreditsByProviderParams): EstimateCreditsResult =>
  estimateCreditsForEffect({
    effect: {
      provider,
      credit: baseCredit,
    },
    input,
  });
