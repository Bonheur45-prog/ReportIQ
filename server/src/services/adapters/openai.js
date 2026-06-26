// This adapter works for any OpenAI-compatible API:
// - OpenAI (GPT-4o, GPT-4o Mini)
// - NVIDIA NIM (Nemotron, Llama, Mistral, Gemma)
// - Any future provider that follows the OpenAI API format

const https = require('https');

async function generate({ apiKey, model, prompt, images, baseURL, supportsVision }) {
  const messages = [];
  const content  = [];

  // Only add images if the provider supports vision AND images are provided
  if (supportsVision && images && images.length > 0) {
    for (const img of images) {
      content.push({
        type:      'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      });
    }
  }

  content.push({ type: 'text', text: prompt });
  messages.push({ role: 'user', content });

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: 2000,
    temperature: 0.3,
  });

  const url    = new URL(`${baseURL}/chat/completions`);
  const result = await httpPost(url, body, apiKey);

  const choice = result.choices?.[0];
  const text   = choice?.message?.content || '';
  const usage  = result.usage || {};

  return {
    text,
    inputTokens:  usage.prompt_tokens     || 0,
    outputTokens: usage.completion_tokens || 0,
  };
}

// Simple HTTP POST — avoids adding axios as a dependency for this adapter
function httpPost(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const msg = parsed.error?.message || parsed.message || `HTTP ${res.statusCode}`;
            reject(new Error(msg));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('Invalid JSON response from AI provider'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { generate };