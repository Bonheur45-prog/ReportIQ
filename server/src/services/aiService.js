// ── AI Service — unified interface for all providers ──────────────────────────
// The rest of the app only calls generateReportEntry().
// Provider switching happens here — nothing else needs to change.

const { PROVIDERS, DEFAULT_AI_CONFIG } = require('./adapters/registry');

// ── Route to the right adapter ────────────────────────────────────────────────
async function callProvider({ providerId, model, apiKey, prompt, images }) {
  const providerMeta = PROVIDERS[providerId];
  if (!providerMeta) throw new Error(`Unknown AI provider: ${providerId}`);

  // Text-only providers: strip images and add a note to the prompt
  const finalImages = providerMeta.supportsVision ? (images || []) : [];
  let   finalPrompt = prompt;
  if (!providerMeta.supportsVision && images && images.length > 0) {
    finalPrompt += `\n\nNote: ${images.length} site photo(s) were provided but cannot be analysed by this AI model. Base descriptions on the field notes only.`;
  }

  switch (providerId) {
    case 'claude':
      return require('./adapters/anthropic').generate({ apiKey, model, prompt: finalPrompt, images: finalImages });

    case 'gemini':
      return require('./adapters/google').generate({ apiKey, model, prompt: finalPrompt, images: finalImages });

    case 'nvidia':
      return require('./adapters/openai').generate({
        apiKey, model, prompt: finalPrompt, images: finalImages,
        baseURL:       providerMeta.baseURL,
        supportsVision: false,
      });

    case 'openai':
      return require('./adapters/openai').generate({
        apiKey, model, prompt: finalPrompt, images: finalImages,
        baseURL:        providerMeta.baseURL,
        supportsVision: true,
      });

    default:
      throw new Error(`No adapter found for provider: ${providerId}`);
  }
}

// ── Build the prompt ──────────────────────────────────────────────────────────
function buildPrompt(siteName, date, rawNotes, photoNames, supportsVision) {
  const notesAreEmpty = !rawNotes ||
    rawNotes.trim().length < 20 ||
    /^[\d\-\/\s\(\)a-zA-Z]{0,30}$/.test(rawNotes.trim());

  const notesSection = notesAreEmpty
    ? `No detailed notes were recorded for this date. The field worker only marked: "${rawNotes?.trim() || 'done'}". ${supportsVision ? 'Base the entire report on the photos provided.' : 'Base the report on any available context.'}`
    : `RAW NOTES FROM FIELD WORKER:\n${rawNotes}`;

  const photoInstruction = supportsVision && photoNames.length > 0
    ? `For each photo provided, analyse what is visible and write: "Image N: [specific description of what is shown — equipment, cables, pipes, installations, etc.]"`
    : photoNames.length > 0
      ? `${photoNames.length} photos were uploaded. You cannot see them — write "Image N: [Photo provided — description based on field notes]" for each.`
      : 'No photos were provided for this entry.';

  return `You are a professional technical report writer for an electrical and MEP installation company in Rwanda.

Convert the following raw field notes into a polished English daily site report entry.

SITE: ${siteName}
DATE: ${date}
${notesSection}

PHOTOS: ${photoNames.length > 0 ? photoNames.join(', ') : 'None'}

STRICT INSTRUCTIONS:
1. Output ONLY the report content — no site name header, no date header, no company name, no title
2. Translate ALL text into professional English (Kinyarwanda, French, or mixed — translate everything)
3. Write each task as: **Task Name – Label:** followed by 2-3 sentences explaining what was done and why it matters
4. ${photoInstruction}
5. End with exactly: "In short: [one sentence summary]"
6. Add "Pending Work:" section ONLY if notes clearly show incomplete tasks
7. Do NOT invent details not in the notes or visible in photos

OUTPUT FORMAT:
Work Completed:

**[Task Name] – [Label]:** [explanation].

Images:
Image 1: [description]

In short: [summary].

Pending Work:
- [only if applicable]`;
}

// ── Main export — called by reports route ─────────────────────────────────────
async function generateReportEntry(siteName, date, rawNotes, photoDataList, aiConfig) {
  // Merge with defaults so missing fields don't crash
  const config     = { ...DEFAULT_AI_CONFIG, ...aiConfig };
  const providerId = config.provider || 'claude';
  const provider   = PROVIDERS[providerId];

  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  // Get the API key for the active provider
  const apiKey = config.keys?.[providerId];
  if (!apiKey) throw new Error(`No API key configured for ${provider.name}. Please add one in Settings → AI Provider.`);

  const model  = config.model || provider.defaultModel;
  const prompt = buildPrompt(siteName, date, rawNotes, photoDataList.map(p => p.name), provider.supportsVision);

  // Only pass images if provider supports vision
  const images = provider.supportsVision
    ? photoDataList.map(p => ({ base64: p.base64, mimeType: p.mimeType }))
    : [];

  const result = await callProvider({ providerId, model, apiKey, prompt, images });

  return {
    text:         result.text,
    inputTokens:  result.inputTokens  || 0,
    outputTokens: result.outputTokens || 0,
    provider:     providerId,
    model,
  };
}

// ── Test a provider connection ─────────────────────────────────────────────────
async function testProviderConnection(providerId, apiKey, model) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const testModel = model || provider.defaultModel;
  const result    = await callProvider({
    providerId,
    model:  testModel,
    apiKey,
    prompt: 'Reply with exactly: "OK"',
    images: [],
  });

  if (!result.text) throw new Error('Provider returned empty response');
  return { success: true, provider: provider.name, model: testModel };
}

module.exports = { generateReportEntry, testProviderConnection, PROVIDERS, DEFAULT_AI_CONFIG };