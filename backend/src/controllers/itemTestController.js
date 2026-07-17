const prisma = require('../config/db');

const getAll = async (req, res) => {
  const { page = 1, limit = 10, search = '', sort_by = 'id', sort_desc = 'false' } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  const orderBy = { [sort_by]: sort_desc === 'true' ? 'desc' : 'asc' };
  
  const where = { is_active: true };
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.itemTest.findMany({
      where,
      skip,
      take,
      orderBy
    }),
    prisma.itemTest.count({ where })
  ]);

  res.json({ success: true, data: items, total });
};

const getActiveList = async (req, res) => {
  const items = await prisma.itemTest.findMany({
    where: { is_active: true },
    select: { id: true, name: true, description: true },
    orderBy: { name: 'asc' }
  });
  res.json({ success: true, data: items });
};

const getById = async (req, res) => {
  const { id } = req.params;
  const item = await prisma.itemTest.findFirst({
    where: { id: parseInt(id), is_active: true }
  });
  
  if (!item) {
    return res.status(404).json({ error: 'Item test not found' });
  }
  
  res.json({ success: true, data: item });
};

const create = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  // catch unique constraint error implicitly handled by express 5 global error handler or we can check manually
  const existing = await prisma.itemTest.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, is_active: true } });
  if (existing) return res.status(400).json({ error: 'Item test name already exists' });

  const newItem = await prisma.itemTest.create({
    data: { name, description }
  });

  res.status(201).json({ success: true, data: newItem });
};

const update = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const existing = await prisma.itemTest.findFirst({ 
    where: { 
      name: { equals: name, mode: 'insensitive' }, 
      id: { not: parseInt(id) },
      is_active: true 
    } 
  });
  if (existing) return res.status(400).json({ error: 'Item test name already exists' });

  const updatedItem = await prisma.itemTest.update({
    where: { id: parseInt(id) },
    data: { name, description }
  });

  res.json({ success: true, data: updatedItem });
};

const deleteItem = async (req, res) => {
  const { id } = req.params;
  
  // Soft delete
  await prisma.itemTest.update({
    where: { id: parseInt(id) },
    data: { is_active: false }
  });

  res.json({ success: true, message: 'Item test deleted' });
};

module.exports = {
  getAll,
  getActiveList,
  getById,
  create,
  update,
  deleteItem
};
