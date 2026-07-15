const prisma = require('../config/db');

exports.getAll = async (req, res) => {
  {
    const { page = 1, limit = 10, search = '', sort_by = 'id', sort_desc = 'false' } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = search ? {
      issue: { contains: search, mode: 'insensitive' }
    } : {};

    const orderBy = {};
    if (sort_by) {
      const direction = sort_desc === 'true' ? 'desc' : 'asc';
      orderBy[sort_by] = direction;
    } else {
      orderBy.id = 'asc';
    }

    const [data, total] = await Promise.all([
      prisma.faiFailureMode.findMany({
        where,
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.faiFailureMode.count({ where })
    ]);

    res.json({ success: true, data, total });
  }
};

exports.create = async (req, res) => {
  try {
    const { issue } = req.body;
    if (!issue) return res.status(400).json({ success: false, error: 'Issue is required.' });

    const newMode = await prisma.faiFailureMode.create({
      data: { issue }
    });
    res.status(201).json({ success: true, data: newMode });
  } catch (error) {
    console.error('faiFailureMode create error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Issue already exists.' });
    }
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { issue } = req.body;
    
    if (!issue) return res.status(400).json({ success: false, error: 'Issue is required.' });

    const updatedMode = await prisma.faiFailureMode.update({
      where: { id: parseInt(id) },
      data: { issue }
    });
    res.json({ success: true, data: updatedMode });
  } catch (error) {
    console.error('faiFailureMode update error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Issue already exists.' });
    }
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.faiFailureMode.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true, message: 'Deleted successfully.' });
  } catch (error) {
    console.error('faiFailureMode delete error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ success: false, error: 'Cannot delete because it is in use.' });
    }
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};
