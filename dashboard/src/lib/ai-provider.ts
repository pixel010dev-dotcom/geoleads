export type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AIRequest = {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type AIResponse = {
  content: string;
  provider: string;
  model: string;
  latency: number;
  fromFallback: boolean;
};

export type AIProviderConfig = {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  priority: number;
  timeout: number;
};

const API_KEY_PATTERNS: RegExp[] = [
  /sk-or-v1-[a-zA-Z0-9]{20,}/gi,
  /gsk_[a-zA-Z0-9]{30,}/gi,
  /csk-[a-zA-Z0-9]{30,}/gi,
  /nvapi-[a-zA-Z0-9_-]{30,}/gi,
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/gi,
  /ghp_[a-zA-Z0-9]{30,}/gi,
  /gho_[a-zA-Z0-9]{30,}/gi,
  /ghu_[a-zA-Z0-9]{30,}/gi,
  /ghs_[a-zA-Z0-9]{30,}/gi,
  /ghr_[a-zA-Z0-9]{30,}/gi,
  /AIzaSy[a-zA-Z0-9_-]{30,}/gi,
  /APP_USR-[a-zA-Z0-9]{30,}/gi,
  /sk-[a-zA-Z0-9]{30,}/gi,
  /(?:password|senha|passwd)\s*[:=]\s*['"]?\w+['"]?/gi,
];

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|above|your)\s+(?:instructions|directions|prompts?)/gi,
  /you\s+are\s+(?:now|not\s+(?:required\s+to\s+follow|bound\s+by))/gi,
  /forget\s+(?:everything|all\s+previous)/gi,
  /new\s+(?:instruction|prompt|rule|role):/gi,
  /act\s+as\s+(?:if|though)\s+you\s+are/gi,
  /system\s+(?:prompt|instruction|message):/gi,
  /do\s+(?:not\s+)?(?:follow|obey|listen)\s+(?:the\s+)?(?:above|previous)/gi,
  /respond\s+in\s+(?:a\s+)?language\s+(?:other\s+than|different\s+from)/gi,
  /output\s+(?:your|the)\s+(?:instructions|prompt|system)/gi,
  /reveal\s+(?:your|the)\s+(?:instructions|prompt|system|secret)/gi,
];

const sanitizeInput = (text: string): string => {
  let cleaned = text.slice(0, 4000);
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '[REDACTED]');
    }
  }

  return cleaned.trim();
};

const sanitizeOutput = (text: string): string => {
  let cleaned = text.slice(0, 4000);

  for (const pattern of API_KEY_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[KEY_REDACTED]');
  }

  cleaned = cleaned.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_REDACTED]');
  cleaned = cleaned.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ_REDACTED]');

  return cleaned;
};

const DETECTED_KEYWORDS = [
  'instrução', 'instrucoes', 'system prompt', 'prompt do sistema',
  'ignore', 'reveal', 'mostre', 'exiba', 'esqueça', 'esqueca',
];

const detectInjection = (text: string): boolean => {
  const lower = text.toLowerCase();
  let score = 0;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) score += 3;
  }

  for (const kw of DETECTED_KEYWORDS) {
    if (lower.includes(kw)) score += 1;
  }

  return score >= 4;
};

let cachedProviders: AIProviderConfig[] | null = null;

const buildProviders = (): AIProviderConfig[] => {
  if (cachedProviders) return cachedProviders;

  const nvidiaKeys = [
    process.env.NVIDIA_API_KEY_1,
    process.env.NVIDIA_API_KEY_2,
    process.env.NVIDIA_API_KEY_3,
    process.env.NVIDIA_API_KEY_4,
  ].filter((k): k is string => !!k);

  const providers: AIProviderConfig[] = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      apiKey: process.env.GROQ_API_KEY,
      priority: 1,
      timeout: 15000,
    });
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      apiKey: process.env.GEMINI_API_KEY,
      priority: 2,
      timeout: 15000,
    });
  }

  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      name: 'Cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      model: 'llama3.1-8b',
      apiKey: process.env.CEREBRAS_API_KEY,
      priority: 3,
      timeout: 10000,
    });
  }

  for (let i = 0; i < nvidiaKeys.length; i++) {
    providers.push({
      name: `NVIDIA-${i + 1}`,
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'meta/llama-3.1-70b-instruct',
      apiKey: nvidiaKeys[i],
      priority: 4 + i * 0.1,
      timeout: 12000,
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openrouter/free',
      apiKey: process.env.OPENROUTER_API_KEY,
      priority: 5,
      timeout: 15000,
    });
  }

  providers.sort((a, b) => a.priority - b.priority);
  cachedProviders = providers;
  return providers;
};

const callProvider = async (
  config: AIProviderConfig,
  request: AIRequest
): Promise<AIResponse> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  const startTime = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1024,
    };

    if (config.name === 'OpenRouter') {
      body.route = 'fallback';
    }

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        ...(config.name === 'OpenRouter' ? {
          'HTTP-Referer': 'https://geoleads-production.up.railway.app',
          'X-Title': 'GeoLeads',
        } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`${config.name} ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content: sanitizeOutput(content),
      provider: config.name,
      model: config.model,
      latency: Date.now() - startTime,
      fromFallback: false,
    };
  } finally {
    clearTimeout(timer);
  }
};

let loggedFallback = new Set<string>();

export class AIProvider {
  static async generate(request: AIRequest): Promise<AIResponse> {
    const providers = buildProviders();

    if (providers.length === 0) {
      return {
        content: '',
        provider: 'none',
        model: 'none',
        latency: 0,
        fromFallback: true,
      };
    }

    const sanitizedMessages = request.messages.map((msg) => ({
      ...msg,
      content: sanitizeInput(msg.content),
    }));

    for (let i = 0; i < sanitizedMessages.length; i++) {
      const msg = sanitizedMessages[i];
      if (msg.role === 'user' && detectInjection(msg.content)) {
        return {
          content: 'Não posso processar esta solicitação.',
          provider: 'security_filter',
          model: 'injection_detected',
          latency: 0,
          fromFallback: true,
        };
      }
    }

    const safeRequest = { ...request, messages: sanitizedMessages };
    const fallbackProvider = providers[providers.length - 1];
    const triedProviders: string[] = [];

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      triedProviders.push(provider.name);

      try {
        const result = await callProvider(provider, safeRequest);
        console.log(`[AIProvider] ${provider.name} respondeu em ${result.latency}ms`);
        return result;
      } catch (err) {
        const isLast = i === providers.length - 1;
        const msg = err instanceof Error ? err.message : String(err);

        console.warn(`[AIProvider] ${provider.name} falhou: ${msg}`);

        const logKey = `${provider.name}:${msg.slice(0, 60)}`;
        if (!loggedFallback.has(logKey)) {
          loggedFallback.add(logKey);
          console.warn(
            `[AIProvider] ${provider.name} -> pulando para ${isLast ? 'fallback final' : providers[i + 1]?.name || 'nenhum'}`
          );
        }

        if (isLast) {
          return {
            content: '',
            provider: `${fallbackProvider.name}_failed`,
            model: fallbackProvider.model,
            latency: 0,
            fromFallback: true,
          };
        }
      }
    }

    return {
      content: '',
      provider: 'all_failed',
      model: 'none',
      latency: 0,
      fromFallback: true,
    };
  }

  static resetProviders(): void {
    cachedProviders = null;
  }

  static getAvailableProviders(): string[] {
    return buildProviders().map((p) => `${p.name} (${p.model})`);
  }
}
