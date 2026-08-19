import { createHmac, timingSafeEqual } from 'node:crypto';

type CallbackProviderKind = 'kie' | 'ark' | 'vidu' | 'generic';
type CallbackStatus = 'processing' | 'succeeded' | 'failed';
type CallbackRecord = Record<string, unknown>;

const asObject = (value: unknown): CallbackRecord | null =>
  value && typeof value === 'object' ? (value as CallbackRecord) : null;

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

const readStatus = (value: unknown) =>
  typeof value === 'string' ? value.toLowerCase() : '';

const collectPayloadCandidates = (payload: CallbackRecord) => {
  const records: CallbackRecord[] = [];
  const append = (value: unknown) => {
    const record = asObject(value);
    if (record) records.push(record);
  };

  append(payload);

  const data = asObject(payload.data);
  const result = asObject(payload.result);
  const response = asObject(payload.response);
  const info = asObject(payload.info);
  const error = asObject(payload.error);

  append(data);
  append(result);
  append(response);
  append(info);
  append(error);

  append(data?.result);
  append(result?.data);
  append(response?.data);
  append(response?.result);

  return records;
};

const hasArkStyleStatus = (payload: CallbackRecord) =>
  collectPayloadCandidates(payload).some((candidate) =>
    readStatus(candidate.status)
  );

const resolveKieCallbackStatus = (payload: CallbackRecord): CallbackStatus => {
  const data = asObject(payload.data);
  const successFlag = data?.successFlag;
  const code = typeof payload.code === 'number' ? payload.code : null;

  if (successFlag === 1) return 'succeeded';
  if (successFlag === 2 || successFlag === 3) return 'failed';
  if (code === 200) return 'succeeded';
  if (code === 400 || code === 422 || code === 500 || code === 501) {
    return 'failed';
  }
  if (code && code >= 400) return 'failed';
  return 'processing';
};

const resolveArkCallbackStatus = (payload: CallbackRecord): CallbackStatus => {
  const status =
    collectPayloadCandidates(payload)
      .map((candidate) => readStatus(candidate.status))
      .find(Boolean) ?? '';

  if (
    ['failed', 'error', 'cancelled', 'canceled', 'expired'].includes(status)
  ) {
    return 'failed';
  }
  if (['succeeded', 'success', 'done', 'completed'].includes(status)) {
    return 'succeeded';
  }
  return 'processing';
};

const resolveViduCallbackStatus = (payload: CallbackRecord): CallbackStatus => {
  const status =
    collectPayloadCandidates(payload)
      .map(
        (candidate) =>
          readStatus(candidate.state) ||
          readStatus(candidate.status) ||
          readStatus(candidate.statusCode)
      )
      .find(Boolean) ?? '';

  if (
    ['failed', 'failure', 'error', 'cancelled', 'canceled', 'expired'].includes(
      status
    )
  ) {
    return 'failed';
  }
  if (['success', 'succeeded', 'done', 'completed'].includes(status)) {
    return 'succeeded';
  }
  return 'processing';
};

export const resolveEffectCallbackKind = (
  provider: string | null | undefined
): CallbackProviderKind => {
  if (provider === 'veo3.1' || provider?.startsWith('kie.')) {
    return 'kie';
  }
  if (provider?.startsWith('vidu.')) {
    return 'vidu';
  }
  if (provider?.startsWith('volcengine.')) {
    return 'ark';
  }
  return 'generic';
};

export const extractProviderCallbackTaskId = (payload: unknown) => {
  const root = asObject(payload);
  if (!root) return null;

  for (const candidate of collectPayloadCandidates(root)) {
    const taskId =
      readString(candidate.taskId) ??
      readString(candidate.task_id) ??
      readString(candidate.id);
    if (taskId) return taskId;
  }

  return null;
};

export const resolveProviderCallbackStatus = ({
  provider,
  payload,
}: {
  provider?: string | null;
  payload: unknown;
}): CallbackStatus => {
  const root = asObject(payload);
  if (!root) return 'processing';

  const kind = resolveEffectCallbackKind(provider);
  if (kind === 'kie') return resolveKieCallbackStatus(root);
  if (kind === 'vidu') return resolveViduCallbackStatus(root);
  if (kind === 'ark') return resolveArkCallbackStatus(root);
  return hasArkStyleStatus(root)
    ? resolveArkCallbackStatus(root)
    : resolveKieCallbackStatus(root);
};

export const resolveProviderCallbackError = ({
  provider,
  payload,
}: {
  provider?: string | null;
  payload: unknown;
}) => {
  const root = asObject(payload);
  if (!root) return null;

  const kind = resolveEffectCallbackKind(provider);
  const candidates = collectPayloadCandidates(root);

  if (kind === 'kie') {
    const kieMessage =
      readString(root.msg) ??
      candidates.map((candidate) => readString(candidate.msg)).find(Boolean);
    if (kieMessage) return kieMessage;
  }

  if (kind === 'vidu') {
    for (const candidate of candidates) {
      const error = asObject(candidate.error);
      const message =
        readString(candidate.err_msg) ??
        readString(candidate.error_msg) ??
        readString(candidate.message) ??
        readString(candidate.msg) ??
        readString(error?.message);
      if (message) return message;
    }
  }

  for (const candidate of candidates) {
    const error = asObject(candidate.error);
    const message =
      readString(candidate.message) ??
      readString(candidate.msg) ??
      readString(error?.message);
    if (message) return message;
  }

  return null;
};

export const resolveProviderCallbackPayloadData = ({
  provider,
  payload,
}: {
  provider?: string | null;
  payload: unknown;
}) => {
  const root = asObject(payload);
  if (!root) return {};

  const kind = resolveEffectCallbackKind(provider);
  if (kind === 'vidu') {
    return root;
  }
  if (kind === 'ark' || (kind === 'generic' && hasArkStyleStatus(root))) {
    return root;
  }

  return asObject(root.data) ?? root;
};

const splitSignedHeaders = (value: string) =>
  value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const safeEqualBase64 = (expected: string, received: string) => {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};

export const verifyViduCallbackSignature = ({
  method,
  callbackUri,
  rawQueryString,
  headers,
  secret,
  nowMs = Date.now(),
  toleranceMs = 5 * 60 * 1000,
}: {
  method: string;
  callbackUri: string;
  rawQueryString: string;
  headers: Headers;
  secret?: string | null;
  nowMs?: number;
  toleranceMs?: number;
}) => {
  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: 'Vidu callback secret not configured',
    } as const;
  }

  const date = headers.get('Date');
  const nonce = headers.get('x-request-nonce');
  const signedHeadersValue = headers.get('X-HMAC-SIGNED-HEADERS');
  const signature = headers.get('X-HMAC-SIGNATURE');
  const algorithm = headers.get('X-HMAC-ALGORITHM')?.toLowerCase();
  const accessKey = headers.get('X-HMAC-ACCESS-KEY');

  if (
    !date ||
    !nonce ||
    !signedHeadersValue ||
    !signature ||
    !algorithm ||
    !accessKey
  ) {
    return {
      ok: false,
      status: 401,
      error: 'Missing Vidu callback signature headers',
    } as const;
  }

  if (algorithm !== 'hmac-sha256') {
    return {
      ok: false,
      status: 401,
      error: 'Invalid Vidu callback algorithm',
    } as const;
  }

  if (accessKey !== 'vidu') {
    return {
      ok: false,
      status: 401,
      error: 'Invalid Vidu callback access key',
    } as const;
  }

  const signedAtMs = Date.parse(date);
  if (!Number.isFinite(signedAtMs)) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid Vidu callback date',
    } as const;
  }

  if (Math.abs(nowMs - signedAtMs) > toleranceMs) {
    return {
      ok: false,
      status: 401,
      error: 'Vidu callback date expired',
    } as const;
  }

  const signedHeaders = splitSignedHeaders(signedHeadersValue);
  const signedHeaderLines = signedHeaders.map((headerName) => {
    const value = headers.get(headerName) ?? '';
    return `${headerName}:${value}`;
  });
  const stringToSign = [
    method.toUpperCase(),
    callbackUri,
    rawQueryString,
    'vidu',
    date,
    ...signedHeaderLines,
    '',
  ].join('\n');
  const expectedSignature = createHmac('sha256', secret)
    .update(stringToSign)
    .digest('base64');

  if (!safeEqualBase64(expectedSignature, signature)) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid Vidu callback signature',
    } as const;
  }

  return {
    ok: true,
    nonce,
  } as const;
};
