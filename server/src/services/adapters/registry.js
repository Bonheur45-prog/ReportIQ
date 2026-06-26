// ── Provider Registry ─────────────────────────────────────────────────────────
// To add a new provider: add an entry here and create its adapter file.
// Nothing else needs to change anywhere in the codebase.

const PROVIDERS = {
  claude: {
    id:          'claude',
    name:        'Claude (Anthropic)',
    description: 'Best quality. Vision support (photos analysed). Paid only.',
    supportsVision: true,
    models: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (fast, cheap)' },
      { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6 (best quality)' },
    ],
    defaultModel: 'claude-haiku-4-5-20251001',
    keyLabel:    'Anthropic API Key',
    keyHint:     'Get yours at console.anthropic.com',
    keyPrefix:   'sk-ant-',
  },

  gemini: {
    id:          'gemini',
    name:        'Gemini (Google)',
    description: 'Free tier available. Vision support. Good multilingual.',
    supportsVision: true,
    models: [
      { id: 'gemini-2.0-flash',       name: 'Gemini 2.0 Flash (recommended)' },
      { id: 'gemini-1.5-flash',       name: 'Gemini 1.5 Flash' },
      { id: 'gemini-2.5-flash',       name: 'Gemini 2.5 Flash (Recommended Free)' },
      { id: 'gemini-2.5-pro',         name: 'Gemini 2.5 Pro' },
      { id: 'gemini-1.5-pro',         name: 'Gemini 1.5 Pro (slower, higher quality)' },
    ],
    defaultModel: 'gemini-2.0-flash',
    keyLabel:    'Google AI Studio API Key',
    keyHint:     'Get yours free at aistudio.google.com',
    keyPrefix:   'AIza',
  },

  nvidia: {
    id:          'nvidia',
    name:        'NVIDIA NIM',
    description: 'Free credits. Text only — no photo analysis. Good for tight budgets.',
    supportsVision: false,
    models: [
      { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B (recommended)' },
      { id: 'meta/llama-3.1-405b-instruct',           name: 'Llama 3.1 405B' },
      { id: 'mistralai/mistral-large-2-instruct',     name: 'Mistral Large 2 (good multilingual)' },
      { id: 'google/gemma-3-27b-it',                  name: 'Gemma 3 27B' },
    ],
    defaultModel: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    keyLabel:    'NVIDIA NIM API Key',
    keyHint:     'Get 1000 free credits at build.nvidia.com',
    keyPrefix:   'nvapi-',
    baseURL:     'https://integrate.api.nvidia.com/v1',
  },

  openai: {
    id:          'openai',
    name:        'OpenAI (ChatGPT)',
    description: 'Vision support. Good quality. Paid only.',
    supportsVision: true,
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (fast, cheap)' },
      { id: 'gpt-4o',      name: 'GPT-4o (best quality)' },
    ],
    defaultModel: 'gpt-4o-mini',
    keyLabel:    'OpenAI API Key',
    keyHint:     'Get yours at platform.openai.com',
    keyPrefix:   'sk-',
    baseURL:     'https://api.openai.com/v1',
  },
};

// What the company DB field looks like when no AI is configured
const DEFAULT_AI_CONFIG = {
  provider:    'claude',
  model:       PROVIDERS.claude.defaultModel,
  // keys stored per provider so switching back doesn't require re-entering
  keys: {
    claude: null,
    gemini: null,
    nvidia: null,
    openai: null,
  },
};

module.exports = { PROVIDERS, DEFAULT_AI_CONFIG };