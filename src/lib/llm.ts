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
