const prisma = require('../config/db');

exports.getAll = async (req, res) => {
  {
    const { search = '', sort_by = 'id', sort_desc = 'false' } = req.query;

    const { limitNumber, skip } = req.pagination;

    const where = search ? {
      name: { contains: search, mode: 'insensitive' }
    } : {};

    const orderBy = {};
    if (sort_by) {
      const direction = sort_desc === 'true' ? 'desc' : 'asc';
      orderBy[sort_by] = direction;
    } else {
      orderBy.id = 'asc';
    }

    const [data, total] = await Promise.all([
      prisma.commodityPart.findMany({
        where,
        orderBy,
        skip,
        take: limitNumber
      }),
      prisma.commodityPart.count({ where })
    ]);

    return res.paginate(data, total);
  }
};

exports.create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required.' });

    const newPart = await prisma.commodityPart.create({
      data: { name }
    });
    res.status(201).json({ success: true, data: newPart });
  } catch (error) {
    console.error('commodityPart create error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Name already exists.' });
    }
    throw error;
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return res.status(400).json({ success: false, error: 'Name is required.' });

    const updatedPart = await prisma.commodityPart.update({
      where: { id: parseInt(id) },
      data: { name }
    });
    res.json({ success: true, data: updatedPart });
  } catch (error) {
    console.error('commodityPart update error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Name already exists.' });
    }
    throw error;
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.commodityPart.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true, message: 'Deleted successfully.' });
  } catch (error) {
    console.error('commodityPart delete error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ success: false, error: 'Cannot delete because it is in use.' });
    }
    throw error;
  }
};
