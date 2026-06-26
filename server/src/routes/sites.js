const express = require('express');
const { body, validationResult } = require('express-validator');

const Site = require('../models/Site');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const sites = await Site.find({ company: req.company._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { sites, count: sites.length }, sites, count: sites.length });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const site = await Site.findOne({ _id: req.params.id, company: req.company._id });
    if (!site) {
      return res.status(404).json({ success: false, message: 'Site not found.' });
    }
    res.status(200).json({ success: true, data: { site }, site });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Site name is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const site = await Site.create({
        name: req.body.name,
        location: req.body.location || '',
        description: req.body.description || '',
        driveFolderId: req.body.driveFolderId || '',
        company: req.company._id,
        createdBy: req.user._id,
      });

      res.status(201).json({ success: true, data: { site }, site });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/:id', async (req, res, next) => {
  try {
    const updatedSite = await Site.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      {
        name: req.body.name,
        location: req.body.location,
        status: req.body.status,
        description: req.body.description,
        driveFolderId: req.body.driveFolderId,
      },
      { new: true, runValidators: true }
    );

    if (!updatedSite) {
      return res.status(404).json({ success: false, message: 'Site not found.' });
    }

    res.status(200).json({ success: true, data: { site: updatedSite }, site: updatedSite });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', restrictTo('owner', 'admin'), async (req, res, next) => {
  try {
    const site = await Site.findOneAndDelete({ _id: req.params.id, company: req.company._id });
    if (!site) {
      return res.status(404).json({ success: false, message: 'Site not found.' });
    }
    res.status(200).json({ success: true, message: 'Site deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
