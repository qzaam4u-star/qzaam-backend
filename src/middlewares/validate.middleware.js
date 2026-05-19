const { ApiError } = require('../utils/errors');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    // Format Zod errors safely
    let message = 'Validation Failed';
    if (error.issues) {
      message = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    } else if (error.errors) {
      message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    }
    next(new ApiError(400, message));
  }
};

module.exports = { validate };
