const paginationMiddleware = (req, res, next) => {
  const pageNumber = Math.max(1, parseInt(req.query.page) || 1);
  const limitNumber = Math.max(1, parseInt(req.query.limit) || 25);
  const skip = (pageNumber - 1) * limitNumber;

  req.pagination = { pageNumber, limitNumber, skip };

  res.paginate = (data, total, extraFields = {}) => {
    return res.json({
      ...extraFields,
      data,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    });
  };

  next();
};

module.exports = paginationMiddleware;
