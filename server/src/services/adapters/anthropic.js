const Anthropic = require('@anthropic-ai/sdk');

async function generate({ apiKey, model, prompt, images }) {
  const client  = new Anthropic({ apiKey });
  const content = [];

  // Add images if provided and model supports vision
  if (images && images.length > 0) {
    for (const img of images) {
      content.push({
        type:   'image',
        source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
      });
    }
  }

  content.push({ type: 'text', text: prompt });

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    messages:   [{ role: 'user', content }],
  });

  return {
    text:         response.content[0].text,
    inputTokens:  response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

module.exports = { generate };