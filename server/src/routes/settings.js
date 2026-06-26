const express  = require('express');
const Company  = require('../models/Company');
const { protect, restrictTo }             = require('../middleware/auth');
const { PROVIDERS, testProviderConnection } = require('../services/aiService');

const router = express.Router();
router.use(protect);

// ── GET /api/settings/ai ──────────────────────────────────────────────────────
// Returns current AI config — keys are masked for security
router.get('/ai', async (req, res, next) => {
  try {
    // Explicitly select keys (select:false by default)
    const company = await Company.findById(req.company._id)
      .select('aiConfig.provider aiConfig.model aiConfig.keys');

    const aiConfig  = company?.aiConfig || {};
    const keys      = aiConfig.keys     || {};

    // Mask keys — return only whether they're set, not the actual value
    const maskedKeys = {};
    for (const provider of Object.keys(PROVIDERS)) {
      maskedKeys[provider] = keys[provider] ? '••••••••' : null;
    }

    res.status(200).json({
      success: true,
      data: {
        provider:  aiConfig.provider || 'claude',
        model:     aiConfig.model    || PROVIDERS.claude.defaultModel,
        keys:      maskedKeys,
        providers: Object.values(PROVIDERS).map(p => ({
          id:             p.id,
          name:           p.name,
          description:    p.description,
          supportsVision: p.supportsVision,
          models:         p.models,
          defaultModel:   p.defaultModel,
          keyLabel:       p.keyLabel,
          keyHint:        p.keyHint,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /api/settings/ai ────────────────────────────────────────────────────
// Update active provider and/or model
router.patch('/ai', restrictTo('owner', 'admin'), async (req, res, next) => {
  try {
    const { provider, model } = req.body;

    if (provider && !PROVIDERS[provider]) {
      return res.status(400).json({ success: false, message: `Unknown provider: ${provider}` });
    }

    const update = {};
    if (provider) update['aiConfig.provider'] = provider;
    if (model)    update['aiConfig.model']    = model;

    await Company.findByIdAndUpdate(req.company._id, update);
    res.status(200).json({ success: true, message: 'AI provider updated.' });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/settings/ai/key ─────────────────────────────────────────────────
// Save an API key for a specific provider
router.post('/ai/key', restrictTo('owner', 'admin'), async (req, res, next) => {
  try {
    const { provider, apiKey } = req.body;

    if (!provider || !PROVIDERS[provider]) {
      return res.status(400).json({ success: false, message: 'Valid provider is required.' });
    }
    if (!apiKey || apiKey.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'A valid API key is required.' });
    }

    await Company.findByIdAndUpdate(req.company._id, {
      [`aiConfig.keys.${provider}`]: apiKey.trim(),
    });

    res.status(200).json({ success: true, message: `${PROVIDERS[provider].name} API key saved.` });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/settings/ai/key ───────────────────────────────────────────────
// Remove an API key for a specific provider
router.delete('/ai/key', restrictTo('owner', 'admin'), async (req, res, next) => {
  try {
    const { provider } = req.body;
    if (!provider || !PROVIDERS[provider]) {
      return res.status(400).json({ success: false, message: 'Valid provider is required.' });
    }

    await Company.findByIdAndUpdate(req.company._id, {
      [`aiConfig.keys.${provider}`]: null,
    });

    res.status(200).json({ success: true, message: `${PROVIDERS[provider].name} API key removed.` });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/settings/ai/test ────────────────────────────────────────────────
// Test a provider connection with a given key
router.post('/ai/test', restrictTo('owner', 'admin'), async (req, res, next) => {
  try {
    const { provider, apiKey, model } = req.body;

    if (!provider || !PROVIDERS[provider]) {
      return res.status(400).json({ success: false, message: 'Valid provider is required.' });
    }

    // Use provided key, or fall back to saved key
    let keyToTest = apiKey?.trim();
    if (!keyToTest || keyToTest === '••••••••') {
      const company = await Company.findById(req.company._id)
        .select(`aiConfig.keys.${provider}`);
      keyToTest = company?.aiConfig?.keys?.[provider];
    }

    if (!keyToTest) {
      return res.status(400).json({ success: false, message: 'No API key found. Please save a key first.' });
    }

    const result = await testProviderConnection(provider, keyToTest, model);
    res.status(200).json({ success: true, message: `✅ Connected to ${result.provider} (${result.model})` });
  } catch (error) {
    res.status(400).json({ success: false, message: `Connection failed: ${error.message}` });
  }
});

module.exports = router;