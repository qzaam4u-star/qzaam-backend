const express = require('express');
const { verifyToken, isVendor } = require('../middlewares/auth.middleware');
const menuController = require('../controllers/menu.controller');
const { validate } = require('../middlewares/validate.middleware');
const { z } = require('zod');

const router = express.Router();

const menuSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    price: z.union([z.string(), z.number()]).transform(val => Number(val)),
    category: z.string().min(1, 'Category is required'),
    description: z.string().optional(),
    prepTime: z.number().int().optional(),
  })
});

// Vendor Protected Routes
router.use(verifyToken);
// /api/vendor/menu -> get and post
router.get('/', isVendor, menuController.getMyMenu);
router.post('/', isVendor, validate(menuSchema), menuController.createItem);
router.put('/:id', isVendor, validate(menuSchema), menuController.updateItem);
router.delete('/:id', isVendor, menuController.deleteItem);

module.exports = router;
