const menuService = require('../services/menu.service');

const getMyMenu = async (req, res, next) => {
  try {
    const items = await menuService.getVendorMenu(req.user.id);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

const getMenuByVendorId = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const items = await menuService.getVendorMenu(vendorId);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

const createItem = async (req, res, next) => {
  try {
    const item = await menuService.createMenuItem(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Item created successfully', data: item });
  } catch (error) {
    next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await menuService.updateMenuItem(req.user.id, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Item updated successfully', data: item });
  } catch (error) {
    next(error);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    await menuService.deleteMenuItem(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: 'Item deleted safely' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyMenu,
  getMenuByVendorId,
  createItem,
  updateItem,
  deleteItem,
};
