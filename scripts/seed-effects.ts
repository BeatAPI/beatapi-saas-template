import { getDb } from '../src/core/workspace-lib/db-adapter';
import { effect } from '../src/config/db/schema';


const aspectRatioField = {
  type: 'enum',
  required: false,
  values: ['16:9', '9:16', '1:1', '2:3', '3:2', 'auto'],
} as const;

const imageUrlsField = {
  type: 'any',
  required: false,
} as const;

const videoUrlsField = {
  type: 'any',
  required: false,
} as const;

const audioUrlsField = {
  type: 'any',
  required: false,
} as const;

const lastFrameField = {
  type: 'any',
  required: false,
} as const;

const optionalStringField = {
  type: 'string',
  required: false,
} as const;

const optionalBooleanField = {
  type: 'boolean',
  required: false,
} as const;

const optionalNumberField = {
  type: 'number',
  required: false,
} as const;

const seedanceDurations = [
  '4s',
  '5s',
  '6s',
  '7s',
  '8s',
  '9s',
  '10s',
  '11s',
  '12s',
] as const;

const seedance20Durations = [
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

const kling30Durations = [
  '3s',
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

const wanDurations = [
  '2s',
  '3s',
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

const wanEditDurations = [
  '2s',
  '3s',
  '4s',
  '5s',
  '6s',
  '7s',
  '8s',
  '9s',
  '10s',
] as const;

const wanOutputQualities = ['720p', '1080p'] as const;

const viduAdFilmDurations = ['10s', '15s', '20s', '30s', '45s', '60s'] as const;

const viduAdFilmPricingRules = [
  { when: { wmDuration: '10s' }, credits: 20 },
  { when: { wmDuration: '15s' }, credits: 20 },
  { when: { wmDuration: '20s' }, credits: 20 },
  { when: { wmDuration: '30s' }, credits: 20 },
  { when: { wmDuration: '45s' }, credits: 20 },
  { when: { wmDuration: '60s' }, credits: 20 },
] as const;

const wanCreditsPerSecond = {
  '720p': 10,
  '1080p': 15,
} as const;

const kling30CreditsPerSecond = {
  '720p': {
    silent: 12,
    audio: 18,
  },
  '1080p': {
    silent: 18,
    audio: 24,
  },
} as const;

const klingMotionControlCreditsPerSecond = {
  '720p': 6,
  '1080p': 12,
} as const;

const seedanceOutputQualities = ['480p', '720p', '1080p'] as const;

const seedanceAudioCreditsByQuality = {
  '480p': [8, 10, 12, 14, 16, 18, 20, 22, 24],
  '720p': [18, 22, 26, 30, 34, 38, 42, 46, 50],
  '1080p': [40, 50, 60, 70, 80, 90, 100, 110, 120],
} as const satisfies Record<
  (typeof seedanceOutputQualities)[number],
  readonly number[]
>;

const createSeedancePricingRules = () =>
  seedanceOutputQualities.flatMap((wmOutputQuality) =>
    seedanceDurations.flatMap((wmDuration, index) => {
      const audioCredits =
        seedanceAudioCreditsByQuality[wmOutputQuality][index];
      const silentCredits = audioCredits / 2;

      return [
        {
          when: { wmOutputQuality, wmSound: false, wmDuration },
          credits: silentCredits,
        },
        {
          when: { wmOutputQuality, wmSound: true, wmDuration },
          credits: audioCredits,
        },
      ];
    })
  );

const seedance20OutputQualities = ['480p', '720p'] as const;

const seedance20CreditsByMode = {
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
    Record<(typeof seedance20OutputQualities)[number], readonly number[]>
  >
>;

const createSeedance20PricingRules = () =>
  (['quality', 'fast'] as const).flatMap((mode) =>
    ([true, false] as const).flatMap((wmHasVideoInput) => {
      const videoKey = wmHasVideoInput ? 'withVideo' : 'withoutVideo';

      return seedance20OutputQualities.flatMap((wmOutputQuality) =>
        seedance20Durations.map((wmDuration, index) => ({
          when: {
            mode,
            wmHasVideoInput,
            wmOutputQuality,
            wmDuration,
          },
          credits:
            seedance20CreditsByMode[mode][videoKey][wmOutputQuality][index],
        }))
      );
    })
  );

const createKling30PricingRules = () =>
  kling30Durations.flatMap((wmDuration) => {
    const seconds = Number.parseInt(wmDuration.replace('s', ''), 10);

    return [
      {
        when: {
          wmOutputQuality: '720p',
          wmSound: false,
          wmDuration,
        },
        credits: kling30CreditsPerSecond['720p'].silent * seconds,
      },
      {
        when: {
          wmOutputQuality: '720p',
          wmSound: true,
          wmDuration,
        },
        credits: kling30CreditsPerSecond['720p'].audio * seconds,
      },
      {
        when: {
          wmOutputQuality: '1080p',
          wmSound: false,
          wmDuration,
        },
        credits: kling30CreditsPerSecond['1080p'].silent * seconds,
      },
      {
        when: {
          wmOutputQuality: '1080p',
          wmSound: true,
          wmDuration,
        },
        credits: kling30CreditsPerSecond['1080p'].audio * seconds,
      },
    ];
  });

const effectSeeds = [
  {
    id: 1,
    name: 'Veo 3.1 Video Generation',
    type: 1,
    model: 'veo-3.1',
    version: '3.1',
    credit: 10,
    linkName: 'veo-3-1',
    prePrompt: null,
    description:
      'Google Veo 3.1 model supporting text-to-video and image-to-video.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/videos/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['16:9', '9:16', 'auto'],
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
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
    },
  },
  {
    id: 2,
    name: 'Grok Imagine',
    type: 1,
    model: 'grok-imagine',
    version: '1',
    credit: 20,
    linkName: 'grok-imagine',
    prePrompt: null,
    description:
      'Grok Imagine video generation supporting text-to-video and image-to-video.',
    platform: 'kie',
    api: 'https://api.kie.ai/api/v1/jobs/createTask',
    isOpen: 1,
    provider: 'kie.grok-imagine',
    inputSchema: {
      prompt: { type: 'string', required: true },
      wmDuration: {
        type: 'enum',
        required: true,
        values: ['6s', '10s', '15s'],
      },
      wmOutputQuality: {
        type: 'enum',
        required: true,
        values: ['std', 'pro', '4k'],
      },
      aspect_ratio: aspectRatioField,
      image_urls: imageUrlsField,
    },
    pricingSchema: {
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
    },
  },
  {
    id: 3,
    name: 'Sora2',
    type: 1,
    model: 'sora-2',
    version: '2',
    credit: 30,
    linkName: 'sora-2',
    prePrompt: null,
    description:
      'Sora2 and Sora2 Pro video generation supporting text-to-video and image-to-video.',
    platform: 'kie',
    api: 'https://api.kie.ai/api/v1/jobs/createTask',
    isOpen: 1,
    provider: 'kie.sora2',
    inputSchema: {
      prompt: { type: 'string', required: true },
      modelVariant: {
        type: 'enum',
        required: true,
        values: ['sora2', 'sora2-pro'],
      },
      size: {
        type: 'enum',
        required: false,
        values: ['standard', 'high'],
      },
      wmDuration: {
        type: 'enum',
        required: true,
        values: ['10s', '15s'],
      },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['portrait', 'landscape'],
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 12,
      rules: [
        {
          when: { modelVariant: 'sora2', wmDuration: '10s' },
          credits: 12,
        },
        {
          when: { modelVariant: 'sora2', wmDuration: '15s' },
          credits: 18,
        },
        {
          when: {
            modelVariant: 'sora2-pro',
            size: 'standard',
            wmDuration: '10s',
          },
          credits: 40,
        },
        {
          when: {
            modelVariant: 'sora2-pro',
            size: 'standard',
            wmDuration: '15s',
          },
          credits: 70,
        },
        {
          when: {
            modelVariant: 'sora2-pro',
            size: 'high',
            wmDuration: '10s',
          },
          credits: 85,
        },
        {
          when: {
            modelVariant: 'sora2-pro',
            size: 'high',
            wmDuration: '15s',
          },
          credits: 150,
        },
      ],
    },
  },
  {
    id: 4,
    name: 'Nano Banana 2',
    type: 2,
    model: 'nano-banana-2',
    version: '2',
    credit: 3,
    linkName: 'nano-banana-2',
    prePrompt: null,
    description: 'Google Nano Banana 2 image generation.',
    platform: 'kie',
    api: 'https://api.kie.ai/api/v1/jobs/createTask',
    isOpen: 1,
    provider: 'kie.nano-banana-2',
    inputSchema: {
      prompt: { type: 'string', required: true },
      aspect_ratio: aspectRatioField,
      wmOutputQuality: {
        type: 'enum',
        required: true,
        values: ['1k', '2k', '4k'],
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 3,
      rules: [
        { when: { wmOutputQuality: '1k' }, credits: 3 },
        { when: { wmOutputQuality: '2k' }, credits: 5 },
        { when: { wmOutputQuality: '4k' }, credits: 8 },
      ],
    },
  },
  {
    id: 5,
    name: 'Nano Banana',
    type: 2,
    model: 'nano-banana',
    version: '1',
    credit: 2,
    linkName: 'nano-banana',
    prePrompt: null,
    description: 'Google Nano Banana image generation.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/images/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      aspect_ratio: aspectRatioField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'fixed',
      credits: 2,
    },
  },
  {
    id: 6,
    name: 'Nano Banana Pro',
    type: 2,
    model: 'nano-banana-pro',
    version: '1',
    credit: 5,
    linkName: 'nano-banana-pro',
    prePrompt: null,
    description: 'Nano Banana Pro image generation and image-to-image.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/images/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      aspect_ratio: aspectRatioField,
      wmOutputQuality: {
        type: 'enum',
        required: true,
        values: ['1k', '2k', '4k'],
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 5,
      rules: [
        { when: { wmOutputQuality: '1k' }, credits: 3 },
        { when: { wmOutputQuality: '2k' }, credits: 5 },
        { when: { wmOutputQuality: '4k' }, credits: 9 },
      ],
    },
  },
  {
    id: 7,
    name: 'Seedance 1.5 Pro',
    type: 1,
    model: 'doubao-seedance-1-5-pro-251215',
    version: '1.5',
    credit: 4,
    linkName: 'seedance-1-5-pro',
    prePrompt: null,
    description:
      'Seedance 1.5 Pro video generation for text-to-video and image-to-video.',
    platform: 'volcengine',
    api: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
    isOpen: 1,
    provider: 'volcengine.seedance-1.5-pro',
    inputSchema: {
      prompt: { type: 'string', required: true },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive'],
      },
      wmDuration: {
        type: 'enum',
        required: false,
        values: [...seedanceDurations],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: [...seedanceOutputQualities],
      },
      wmSound: {
        type: 'boolean',
        required: false,
      },
      image_urls: imageUrlsField,
      last_frame: lastFrameField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 4,
      rules: createSeedancePricingRules(),
    },
  },
  {
    id: 8,
    name: 'Kling 2.6',
    type: 1,
    model: 'kling-2.6',
    version: '2.6',
    credit: 20,
    linkName: 'kling-2-6',
    prePrompt: null,
    description:
      'Kling 2.6 video generation supporting text-to-video and image-to-video.',
    platform: 'kie',
    api: 'https://api.kie.ai/api/v1/jobs/createTask',
    isOpen: 1,
    provider: 'kie.kling-2.6',
    inputSchema: {
      prompt: { type: 'string', required: true },
      wmDuration: {
        type: 'enum',
        required: true,
        values: ['5s', '10s'],
      },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['1:1', '16:9', '9:16'],
      },
      wmSound: {
        type: 'boolean',
        required: false,
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 30,
      rules: [
        { when: { wmDuration: '5s', wmSound: false }, credits: 30 },
        { when: { wmDuration: '10s', wmSound: false }, credits: 60 },
        { when: { wmDuration: '5s', wmSound: true }, credits: 60 },
        { when: { wmDuration: '10s', wmSound: true }, credits: 120 },
      ],
    },
  },
  {
    id: 9,
    name: 'Seedance 2',
    type: 1,
    model: 'seedance-2',
    version: '2.0',
    credit: 30,
    linkName: 'seedance-2-0',
    prePrompt: null,
    description:
      'Seedance 2 multimodal video generation with image, video, and audio references.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/videos/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      mode: {
        type: 'enum',
        required: false,
        values: ['quality', 'fast'],
      },
      wmDuration: {
        type: 'enum',
        required: false,
        values: [...seedance20Durations],
      },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: ['480p', '720p', '1080p', '4k'],
      },
      image_urls: imageUrlsField,
      last_frame: lastFrameField,
      video_urls: videoUrlsField,
      audio_urls: audioUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 30,
      rules: createSeedance20PricingRules(),
    },
  },
  {
    id: 10,
    name: 'Kling 3',
    type: 1,
    model: 'kling-3',
    version: '3.0',
    credit: 20,
    linkName: 'kling-3-0',
    prePrompt: null,
    description:
      'Kling 3.0 video generation supporting text and image guided video.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/videos/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      wmDuration: {
        type: 'enum',
        required: true,
        values: [...kling30Durations],
      },
      aspect_ratio: {
        type: 'enum',
        required: true,
        values: ['1:1', '16:9', '9:16'],
      },
      wmOutputQuality: {
        type: 'enum',
        required: true,
        values: ['720p', '1080p'],
      },
      wmSound: {
        type: 'boolean',
        required: false,
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 36,
      rules: createKling30PricingRules(),
    },
  },
  {
    id: 11,
    name: 'Kling Motion Control',
    type: 1,
    model: 'kling-motion-control',
    version: '1',
    credit: 6,
    linkName: 'kling-motion-control',
    prePrompt: null,
    description:
      'Kling motion control video generation with reference image and source video guidance.',
    platform: 'kie',
    api: 'https://api.kie.ai/api/v1/jobs/createTask',
    isOpen: 1,
    provider: 'kie.kling-motion-control',
    inputSchema: {
      prompt: { type: 'string', required: true },
      wmOutputQuality: {
        type: 'enum',
        required: true,
        values: ['720p', '1080p'],
      },
      sourceVideoDurationSeconds: {
        type: 'number',
        required: true,
      },
      image_urls: imageUrlsField,
      video_urls: videoUrlsField,
      characterOrientation: {
        type: 'enum',
        required: false,
        values: ['video', 'image'],
      },
      backgroundSource: {
        type: 'enum',
        required: false,
        values: ['input_video', 'input_image'],
      },
    },
    pricingSchema: {
      version: 1,
      strategy: 'per-second',
      durationField: 'sourceVideoDurationSeconds',
      rounding: 'ceil',
      rates: {
        wmOutputQuality: klingMotionControlCreditsPerSecond,
      },
      fallbackCredits: 6,
    },
  },
  {
    id: 12,
    name: 'GPT Image 2',
    type: 2,
    model: 'gpt-image-2',
    version: '2',
    credit: 2,
    linkName: 'gpt-image-2',
    prePrompt: null,
    description:
      'GPT Image 2 image generation supporting text-to-image and image-to-image.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/images/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: [
          'auto',
          '1:1',
          '1:2',
          '2:1',
          '1:3',
          '3:1',
          '2:3',
          '3:2',
          '3:4',
          '4:3',
          '4:5',
          '5:4',
          '9:16',
          '16:9',
          '9:21',
          '21:9',
        ],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: ['1k', '2k', '4k'],
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 2,
      rules: [
        { when: { wmOutputQuality: '1k' }, credits: 2 },
        { when: { wmOutputQuality: '2k' }, credits: 4 },
        { when: { wmOutputQuality: '4k' }, credits: 6 },
      ],
    },
  },
  {
    id: 13,
    name: 'Wan 2.7 I2V',
    type: 1,
    model: 'wan2.7-i2v',
    version: '2.7',
    credit: 75,
    linkName: 'wan-2-7-i2v',
    prePrompt: null,
    description:
      'Wan 2.7 image-to-video generation with first/last frame and driving audio control.',
    platform: 'alibaba',
    api: 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    isOpen: 1,
    provider: 'alibaba.wan2.7-i2v',
    inputSchema: {
      prompt: { type: 'string', required: true },
      negative_prompt: optionalStringField,
      wmDuration: {
        type: 'enum',
        required: false,
        values: [...wanDurations],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: [...wanOutputQualities],
      },
      image_urls: imageUrlsField,
      video_urls: videoUrlsField,
      audio_urls: audioUrlsField,
      last_frame: lastFrameField,
      prompt_extend: optionalBooleanField,
      watermark: optionalBooleanField,
      seed: optionalNumberField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'per-second',
      durationField: 'wmDuration',
      rounding: 'ceil',
      rates: {
        wmOutputQuality: wanCreditsPerSecond,
      },
      fallbackCredits: 75,
    },
  },
  {
    id: 14,
    name: 'Wan 2.7 Video Edit',
    type: 1,
    model: 'wan2.7-videoedit',
    version: '2.7',
    credit: 150,
    linkName: 'wan-2-7-videoedit',
    prePrompt: null,
    description:
      'Wan 2.7 instruction-based video editing with source video and reference image inputs.',
    platform: 'alibaba',
    api: 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    isOpen: 1,
    provider: 'alibaba.wan2.7-videoedit',
    inputSchema: {
      prompt: { type: 'string', required: true },
      negative_prompt: optionalStringField,
      wmDuration: {
        type: 'enum',
        required: false,
        values: [...wanEditDurations],
      },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['16:9', '9:16', '1:1', '4:3', '3:4'],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: [...wanOutputQualities],
      },
      image_urls: imageUrlsField,
      video_urls: videoUrlsField,
      audio_setting: {
        type: 'enum',
        required: false,
        values: ['auto', 'origin'],
      },
      prompt_extend: optionalBooleanField,
      watermark: optionalBooleanField,
      seed: optionalNumberField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'per-second',
      durationField: 'wmDuration',
      rounding: 'ceil',
      rates: {
        wmOutputQuality: wanCreditsPerSecond,
      },
      fallbackCredits: 150,
    },
  },
  {
    id: 15,
    name: 'Vidu One Click AD-Film',
    type: 1,
    model: 'ad-one-click',
    version: '1',
    credit: 20,
    linkName: 'vidu-ad-film',
    prePrompt: null,
    description:
      'Vidu One Click AD-Film ecommerce video generation from 1-7 product reference images.',
    platform: 'vidu',
    api: 'https://api.vidu.com/ent/v2/ad-one-click',
    isOpen: 1,
    provider: 'vidu.ad-one-click',
    inputSchema: {
      prompt: { type: 'string', required: true },
      image_urls: imageUrlsField,
      wmDuration: {
        type: 'enum',
        required: false,
        values: [...viduAdFilmDurations],
      },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['16:9', '9:16', '1:1'],
      },
      language: {
        type: 'enum',
        required: false,
        values: ['en', 'zh'],
      },
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 20,
      rules: [...viduAdFilmPricingRules],
    },
  },
  {
    id: 16,
    name: 'Seedream 5 Pro',
    type: 2,
    model: 'seedream-5-pro',
    version: '5',
    credit: 3,
    linkName: 'seedream-5-pro',
    prePrompt: null,
    description:
      'Seedream 5 Pro image generation supporting text-to-image and image-to-image.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/images/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: [
          'auto',
          '1:1',
          '4:3',
          '3:4',
          '16:9',
          '9:16',
          '3:2',
          '2:3',
          '21:9',
        ],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: ['1k', '2k'],
      },
      image_urls: imageUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'matrix',
      fallbackCredits: 3,
      rules: [
        { when: { wmOutputQuality: '1k' }, credits: 3 },
        { when: { wmOutputQuality: '2k' }, credits: 5 },
      ],
    },
  },
  {
    id: 17,
    name: 'MiniMax H3',
    type: 1,
    model: 'minimax-h3',
    version: '3',
    credit: 25,
    linkName: 'minimax-h3',
    prePrompt: null,
    description:
      'MiniMax H3 video generation from text, first/last frames, or multimodal references.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/videos/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      wmDuration: {
        type: 'enum',
        required: false,
        values: [...seedance20Durations],
      },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: ['768p', '2k'],
      },
      image_urls: imageUrlsField,
      video_urls: videoUrlsField,
      audio_urls: audioUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'fixed',
      credits: 25,
    },
  },
  {
    id: 18,
    name: 'Seedance 2.5',
    type: 1,
    model: 'seedance-2.5',
    version: '2.5',
    credit: 30,
    linkName: 'seedance-2-5',
    prePrompt: null,
    description:
      'Seedance 2.5 multimodal video generation with 4-30 second 720p output.',
    platform: 'beatapi',
    api: 'https://api.beatapi.io/v1/videos/tasks',
    isOpen: 1,
    provider: 'beatapi',
    inputSchema: {
      prompt: { type: 'string', required: true },
      wmDuration: {
        type: 'enum',
        required: false,
        values: [
          ...seedance20Durations,
          '16s',
          '17s',
          '18s',
          '19s',
          '20s',
          '21s',
          '22s',
          '23s',
          '24s',
          '25s',
          '26s',
          '27s',
          '28s',
          '29s',
          '30s',
        ],
      },
      aspect_ratio: {
        type: 'enum',
        required: false,
        values: ['adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
      },
      wmOutputQuality: {
        type: 'enum',
        required: false,
        values: ['720p'],
      },
      image_urls: imageUrlsField,
      video_urls: videoUrlsField,
      audio_urls: audioUrlsField,
    },
    pricingSchema: {
      version: 1,
      strategy: 'fixed',
      credits: 30,
    },
  },
] as const;

async function seedEffects() {
  const db = await getDb();
  for (const item of effectSeeds) {
    await db
      .insert(effect)
      .values(item)
      .onConflictDoUpdate({
        target: effect.id,
        set: {
          name: item.name,
          type: item.type,
          model: item.model,
          version: item.version,
          credit: item.credit,
          linkName: item.linkName,
          prePrompt: item.prePrompt,
          description: item.description,
          platform: item.platform,
          api: item.api,
          isOpen: item.isOpen,
          provider: item.provider,
          inputSchema: item.inputSchema,
          pricingSchema: item.pricingSchema,
        },
      });
  }

  console.log(
    `Effect seed complete: ${effectSeeds
      .map((item) => `${item.linkName}(id=${item.id})`)
      .join(', ')}`
  );
}

seedEffects().catch((error) => {
  console.error('Effect seed failed:', error);
  process.exit(1);
});
