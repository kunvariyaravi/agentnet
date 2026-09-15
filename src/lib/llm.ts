// Multi-provider LLM abstraction: calls any OpenAI-compatible chat completions endpoint

export interface LLMConfig {
  provider: string;       // 'nvidia' | 'openai' | 'anthropic' | 'groq' | 'custom'
  model: string;          // model identifier (e.g. 'meta/llama-3.2-11b-vision-instruct')
  apiKey: string;         // API key (falls back to env NVIDIA_API_KEY)
  baseUrl: string;        // base URL (falls back to env NVIDIA_BASE_URL)
  temperature: number;    // 0.0 - 2.0
  maxTokens: number;      // max output tokens
}

// Known provider defaults — user only needs to supply an API key
export const PROVIDER_PRESETS: Record<string, { name: string; baseUrl: string; models: string[]; defaultModel: string }> = {
   nvidia: {
     name: 'NVIDIA AI',
     baseUrl: 'https://integrate.api.nvidia.com/v1',
     models: [
       'meta/llama-3.2-11b-vision-instruct',
       'meta/llama-3.1-70b-instruct',
       'meta/llama-3.1-405b-instruct',
       'mistralai/mixtral-8x7b-instruct-v0.1',
       'google/gemma-2-9b-it',
       // ── Best image generation models available today (NIM) ──
       // Falcon-dev: open-source 72B vision, best open-source image understanding at launch
       'tiiuae/falcon-dev-72b-instruct',
       // Llama-Guard-3 (NIM): safety guard for generated images
       'meta/llama-guard-3-8b',
       // NVIDIA Cosmos/EuroCP Vision (NIM vision endpoints)
       'nvidia/mt-av-3b-0910',
       // Flux.1 dev via NIM (latest best open-image model)
       'black-forest-labs/FLUX.1-dev',
     ],
     defaultModel: 'meta/llama-3.2-11b-vision-instruct',
   },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    name: 'Anthropic (via OpenAI-compatible gateway)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta/Llama-3.3-70B-Instruct-Turbo', 'meta/Llama-3.1-405B-Instruct-Turbo'],
    defaultModel: 'meta/Llama-3.3-70B-Instruct-Turbo',
  },
  custom: {
    name: 'Custom Endpoint',
    baseUrl: '',
    models: [],
    defaultModel: '',
  },
};

function resolveConfig(config: LLMConfig): { apiKey: string; baseUrl: string; model: string } {
  const apiKey = config.apiKey || '';
  const baseUrl = config.baseUrl || 'https://integrate.api.nvidia.com/v1';
  const model = config.model || 'meta/llama-3.2-11b-vision-instruct';
  return { apiKey, baseUrl, model };
}

// ─ Image models ─
// These models do NOT serve /v1/chat/completions. Sending them to the chat
// endpoint returns `LLM API error 404`.
const IMAGE_MODEL_HINTS = [
  'flux', 'stable-diffusion', 'sdxl', 'sd3', 'qwen-image',
  'hunyuan', 'kolors', 'sana', 'trellis',
];

export function isImageModel(model: string): boolean {
  const m = (model || '').toLowerCase();
  return IMAGE_MODEL_HINTS.some(h => m.includes(h));
}

// ── NVIDIA hosted catalog (build.nvidia.com) ──
// NVIDIA's OpenAI-compatible gateway (integrate.api.nvidia.com/v1) does NOT serve
// image models: POST …/v1/images/generations answers with a plain-text
// `404 page not found`. Image models live on a different host and path, with a
// different request and response shape:
//
//   POST https://ai.api.nvidia.com/v1/genai/{catalog-id}
//     body: { prompt, mode: 'base', cfg_scale, seed, steps, samples: 1 }
//     → { "artifacts": [ { "base64": "...", "finishReason": "SUCCESS", "seed": 0 } ] }
//
// Catalog ids are lowercase (`black-forest-labs/flux.1-dev`); the mixed-case form
// used by the model picker (`black-forest-labs/FLUX.1-dev`) 404s, so both are tried.
const NVIDIA_GENAI_BASE_URL = 'https://ai.api.nvidia.com/v1/genai';

// NIM defaults for FLUX: steps 5-100 (default 50), cfg_scale ≤ 9 (default 5),
// seed 0 = pick a random seed. Schnell is distilled and wants a short schedule.
const NVIDIA_IMAGE_DEFAULTS = { cfgScale: 5, seed: 0, steps: 50 };
const NVIDIA_IMAGE_STEPS_OVERRIDES: Record<string, number> = { schnell: 4 };
const NVIDIA_IMAGE_MAX_ATTEMPTS = 3;

function nvidiaImageSteps(model: string): number {
  const m = (model || '').toLowerCase();
  for (const [hint, steps] of Object.entries(NVIDIA_IMAGE_STEPS_OVERRIDES)) {
    if (m.includes(hint)) return steps;
  }
  return NVIDIA_IMAGE_DEFAULTS.steps;
}

// Route to the NIM catalog only when actually talking to NVIDIA's hosted API.
// A self-hosted NIM (custom base URL) keeps the OpenAI-compatible image path.
function usesNvidiaImageCatalog(config: LLMConfig, baseUrl: string): boolean {
  const provider = (config.provider || '').toLowerCase();
  return provider === 'nvidia' && /^https?:\/\/[^/]*nvidia\.com/i.test(baseUrl);
}

// Providers disagree on the encoding of generated images — NIM returns JPEG for
// FLUX while OpenAI-compatible endpoints return PNG. Trust the bytes, not the API.
function sniffImageMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return 'image/png';
}

function imageFromBase64(b64: string): GeneratedImage {
  const buf = Buffer.from(b64, 'base64');
  return { b64, mime: sniffImageMime(buf) };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface GeneratedImage {
  b64: string; // raw base64 bytes (no data: prefix)
  mime: string; // e.g. 'image/png'
}

async function readError(res: Response): Promise<string> {
  const errText = await res.text();
  try {
    const errJson = JSON.parse(errText);
    return `${errJson.error?.message || errJson.message || errJson.detail || errText}`.slice(0, 500);
  } catch {
    return errText.slice(0, 500);
  }
}

async function callNvidiaGenaiImage(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<GeneratedImage> {
  const candidates = model === model.toLowerCase() ? [model] : [model, model.toLowerCase()];
  const body = {
    prompt,
    mode: 'base',
    cfg_scale: NVIDIA_IMAGE_DEFAULTS.cfgScale,
    seed: NVIDIA_IMAGE_DEFAULTS.seed,
    steps: nvidiaImageSteps(model),
    samples: 1,
  };

  let lastError = '';

  for (const modelId of candidates) {
    const url = `${NVIDIA_GENAI_BASE_URL}/${modelId}`;

    for (let attempt = 1; attempt <= NVIDIA_IMAGE_MAX_ATTEMPTS; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        // Diffusion can be slow — bound it so a hung upstream can't strand the work.
        signal: AbortSignal.timeout(180000),
      });

      if (!res.ok) {
        lastError = `Image API error ${res.status}: ${await readError(res)}`;
        // 404 = wrong catalog id; move on to the next candidate.
        if (res.status === 404) break;
        // The NIM backend intermittently answers 5xx for an otherwise valid
        // request — retry a couple of times before failing the work.
        if (res.status >= 500 && attempt < NVIDIA_IMAGE_MAX_ATTEMPTS) {
          await sleep(1500 * attempt);
          continue;
        }
        throw new Error(lastError);
      }

      const data = await res.json();
      const artifact = data.artifacts?.[0];
      const b64 = artifact?.base64 || data.data?.[0]?.b64_json;
      if (b64) return imageFromBase64(b64);
      throw new Error('Image API returned no image data.');
    }
  }

  throw new Error(lastError || 'Image API request failed.');
}

export async function callImageModel(
  config: LLMConfig,
  prompt: string,
): Promise<GeneratedImage> {
  const { apiKey, baseUrl, model } = resolveConfig(config);

  if (!apiKey) {
    throw new Error(
      'No API key configured. Set an API key in the agent edit page (/agents/{id}/edit).',
    );
  }
  if (!prompt || !prompt.trim()) {
    throw new Error('Empty image prompt — provide a description of the image to generate.');
  }

  // NVIDIA's hosted catalog is not OpenAI-compatible for images (see above).
  if (usesNvidiaImageCatalog(config, baseUrl)) {
    return callNvidiaGenaiImage(apiKey, model, prompt);
  }

  const url = `${baseUrl.replace(/\/$/, '')}/images/generations`;

  // Try the configured model id as-is, then a lowercased variant
  // (NIM catalog ids are lowercase, e.g. black-forest-labs/flux.1-dev).
  const candidates = model === model.toLowerCase() ? [model] : [model, model.toLowerCase()];
  let lastError = '';

  for (const modelId of candidates) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        n: 1,
        response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!res.ok) {
      lastError = `Image API error ${res.status}: ${await readError(res)}`;
      // Only retry with the alternate id on 404; other errors are real failures.
      if (res.status !== 404) throw new Error(lastError);
      continue;
    }

    const data = await res.json();
    const item = data.data?.[0];
    if (item?.b64_json) {
      return imageFromBase64(item.b64_json);
    }
    if (item?.url) {
      // Some endpoints return a URL even when b64_json was requested — fetch it.
      const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(120000) });
      if (!imgRes.ok) throw new Error(`Failed to download generated image (${imgRes.status})`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const mime = imgRes.headers.get('content-type')?.split(';')[0] || 'image/png';
      return { b64: buf.toString('base64'), mime };
    }
    throw new Error('Image API returned no image data.');
  }

  throw new Error(lastError || 'Image API request failed.');
}

export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const { apiKey, baseUrl, model } = resolveConfig(config);

  if (!apiKey) {
    throw new Error(
      'No API key configured. Set an API key in the agent edit page (/agents/{id}/edit).',
    );
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 4096,
  };

  // o1/o3 models don't support system role or temperature
  if (model.startsWith('o1') || model.startsWith('o3')) {
    body.messages = [
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
    ];
    delete body.temperature;
    delete body.max_tokens;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    // Bound the call so a hung upstream can't strand a work order in WORKING forever.
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMessage = `LLM API error ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMessage += `: ${errJson.error?.message || errJson.message || errText}`;
    } catch {
      errMessage += `: ${errText.slice(0, 500)}`;
    }
    throw new Error(errMessage);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || 'No response generated.';
  return content;
}
