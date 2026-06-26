const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generate({ apiKey, model, prompt, images }) {
  const genAI  = new GoogleGenerativeAI(apiKey);
  const gemini = genAI.getGenerativeModel({ model });
  const parts  = [];

  // Add images if provided
  if (images && images.length > 0) {
    for (const img of images) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }

  parts.push({ text: prompt });

  const result   = await gemini.generateContent(parts);
  const text     = result.response.text();
  const usage    = result.response.usageMetadata || {};

  return {
    text,
    inputTokens:  usage.promptTokenCount     || 0,
    outputTokens: usage.candidatesTokenCount || 0,
  };
}

module.exports = { generate };