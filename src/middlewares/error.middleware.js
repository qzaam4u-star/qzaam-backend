const { ApiError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]:', err);
  
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === 'PrismaClientKnownRequestError') {
    // Handling Prisma specific errors, e.g., unique constraint violations
    if (err.code === 'P2002') {
      statusCode = 400;
      message = 'A record with this field already exists.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = { errorHandler };
