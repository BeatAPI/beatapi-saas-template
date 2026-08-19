/**
 * Client-safe spec definitions for settings tests.
 * The server-side runner lives in settings-test.ts and imports these specs.
 *
 * Kept in its own file so the client bundle doesn't pull in provider SDKs.
 */

export interface TestField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea';
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface TestSpec {
  group: string;
  fields: TestField[];
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, string>;
}

export const testSpecs: Record<string, TestSpec> = {
  resend: {
    group: 'resend',
    fields: [
      { name: 'to', label: 'Recipient email', type: 'email', placeholder: 'you@example.com', required: true },
    ],
  },
  mailgun: {
    group: 'mailgun',
    fields: [
      { name: 'to', label: 'Recipient email', type: 'email', placeholder: 'you@example.com', required: true },
    ],
  },
  creem: {
    group: 'creem',
    fields: [
      { name: 'productId', label: 'Creem product ID', type: 'text', placeholder: 'prod_xxx', required: true },
      { name: 'description', label: 'Description', type: 'text', defaultValue: 'Test checkout' },
    ],
  },
  lemonsqueezy: {
    group: 'lemonsqueezy',
    fields: [
      { name: 'variantId', label: 'Variant ID', type: 'text', placeholder: '12345', required: true },
    ],
  },
  paddle: {
    group: 'paddle',
    fields: [
      { name: 'priceId', label: 'Price ID', type: 'text', placeholder: 'pri_xxx', required: true },
    ],
  },
  paypal: {
    group: 'paypal',
    fields: [
      { name: 'amount', label: 'Amount (cents)', type: 'number', defaultValue: '100', required: true },
      { name: 'currency', label: 'Currency', type: 'text', defaultValue: 'USD', required: true },
      { name: 'description', label: 'Description', type: 'text', defaultValue: 'Test checkout' },
    ],
  },
  alipay: {
    group: 'alipay',
    fields: [
      { name: 'amount', label: 'Amount (fen)', type: 'number', defaultValue: '1', required: true },
      { name: 'description', label: 'Description', type: 'text', defaultValue: 'Test checkout' },
    ],
  },
  wechat: {
    group: 'wechat',
    fields: [
      { name: 'amount', label: 'Amount (fen)', type: 'number', defaultValue: '1', required: true },
      { name: 'description', label: 'Description', type: 'text', defaultValue: 'Test checkout' },
    ],
  },
  r2: {
    group: 'r2',
    fields: [
      { name: 'filename', label: 'Test filename', type: 'text', defaultValue: 'beatapi-settings-test.txt' },
    ],
  },
  replicate: {
    group: 'replicate',
    fields: [
      { name: 'model', label: 'Model', type: 'text', defaultValue: 'black-forest-labs/flux-schnell', required: true },
      { name: 'prompt', label: 'Prompt', type: 'textarea', defaultValue: 'a small red cube, product photography', required: true },
    ],
  },
  gemini: {
    group: 'gemini',
    fields: [
      { name: 'model', label: 'Model', type: 'text', defaultValue: 'gemini-2.5-flash-image', required: true },
      { name: 'prompt', label: 'Prompt', type: 'textarea', defaultValue: 'a small red cube, product photography', required: true },
    ],
  },
  fal: {
    group: 'fal',
    fields: [
      { name: 'model', label: 'Model', type: 'text', defaultValue: 'fal-ai/flux/schnell', required: true },
      { name: 'prompt', label: 'Prompt', type: 'textarea', defaultValue: 'a small red cube, product photography', required: true },
    ],
  },
};

export function getTestSpec(group: string): TestSpec | undefined {
  return testSpecs[group];
}

export function getTestableGroups(): string[] {
  return Object.keys(testSpecs);
}
