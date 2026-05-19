const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');

const getVendorMenu = async (vendorId) => {
  return await prisma.menuItem.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' },
  });
};

const createMenuItem = async (vendorId, data) => {
  const { name, price, category, description, prepTime } = data;
  return await prisma.menuItem.create({
    data: {
      name,
      price: parseFloat(price),
      category,
      description: description || "",
      prepTime: prepTime ? parseInt(prepTime) : 10,
      vendorId,
    },
  });
};

const updateMenuItem = async (vendorId, itemId, data) => {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item) throw new ApiError(404, 'Menu item not found');
  if (item.vendorId !== vendorId) throw new ApiError(403, 'Unauthorized to update this item');

  return await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      name: data.name,
      price: data.price ? parseFloat(data.price) : undefined,
      category: data.category,
      description: data.description,
      prepTime: data.prepTime ? parseInt(data.prepTime) : undefined,
    },
  });
};

const deleteMenuItem = async (vendorId, itemId) => {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item) throw new ApiError(404, 'Menu item not found');
  if (item.vendorId !== vendorId) throw new ApiError(403, 'Unauthorized to delete this item');

  await prisma.menuItem.delete({
    where: { id: itemId },
  });
  return { success: true };
};

module.exports = {
  getVendorMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
