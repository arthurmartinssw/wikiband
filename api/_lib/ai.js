// AI provider layer for MusicAI. Files under api/_lib are not exposed as Vercel functions.
//
// To switch provider, set environment variables only:
//   AI_PROVIDER=groq | openai | gemini | openrouter | custom   (default: groq)
//   AI_API_KEY=...    (or the provider's own variable, e.g. GROQ_API_KEY)
//   AI_MODEL=...      (required for every provider except groq)
//   AI_BASE_URL=...   (only for "custom": any OpenAI-compatible endpoint, e.g. Ollama, DeepSeek, Mistral)
//
// For an API that is not OpenAI-compatible, write an adapter with the same signature as
// openAiCompatibleChat, add it to ADAPTERS and point a preset at it.

const PRESETS = {
  groq: {
    adapter: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    defaultModel: "qwen/qwen3-32b"
  },
  openai: {
    adapter: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY"
  },
  gemini: {
    adapter: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY"
  },
  openrouter: {
    adapter: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY"
  },
  custom: {
    adapter: "openai-compatible",
    baseUrl: "",
    keyEnv: ""
  }
};

class AiError extends Error {
  constructor(code, message, statusCode = 502) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function env(name) {
  return String(process.env[name] || "").trim();
}

async function openAiCompatibleChat(config, { messages, temperature, maxTokens, json, signal }) {
  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {})
    }),
    signal
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AiError(
      response.status === 429 ? "RATE_LIMITED" : "AI_UNAVAILABLE",
      data?.error?.message || `AI provider returned ${response.status}`,
      response.status === 429 ? 429 : 502
    );
  }

  return String(data?.choices?.[0]?.message?.content || "");
}

const ADAPTERS = {
  "openai-compatible": openAiCompatibleChat
};

// Returns { name, model, chat(options) } or throws AiError("MISSING_API_KEY" | "AI_MISCONFIGURED").
function getProvider() {
  const name = (env("AI_PROVIDER") || "groq").toLowerCase();
  const preset = PRESETS[name];

  if (!preset) {
    throw new AiError("AI_MISCONFIGURED", `AI_PROVIDER desconhecido: ${name}`, 503);
  }

  const config = {
    baseUrl: env("AI_BASE_URL") || preset.baseUrl,
    apiKey: env("AI_API_KEY") || (preset.keyEnv ? env(preset.keyEnv) : ""),
    model: env("AI_MODEL") || env("MUSICAI_MODEL") || preset.defaultModel || ""
  };

  if (!config.baseUrl || !config.model) {
    throw new AiError("AI_MISCONFIGURED", "Defina AI_MODEL (e AI_BASE_URL para o provedor custom).", 503);
  }

  // Local servers such as Ollama do not need a key; hosted presets do.
  if (!config.apiKey && name !== "custom") {
    throw new AiError("MISSING_API_KEY", "Chave da IA nao configurada.", 503);
  }

  const adapter = ADAPTERS[preset.adapter];

  return {
    name,
    model: config.model,
    chat: (options) => adapter(config, options)
  };
}

module.exports = {
  AiError,
  getProvider
};
