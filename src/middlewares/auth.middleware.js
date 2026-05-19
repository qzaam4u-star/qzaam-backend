const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/errors');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Unauthorized: No token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Bind decoded user to request
    next();
  } catch (error) {
    next(new ApiError(401, 'Unauthorized: Invalid or expired token'));
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden: You do not have permission to perform this action'));
    }
    next();
  };
};

module.exports = { protect, restrictTo, verifyToken: protect, isVendor: restrictTo('vendor') };
