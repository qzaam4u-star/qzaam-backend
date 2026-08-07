const multer = require('multer');
const { ApiError } = require('../utils/errors');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_IMAGE_SIZE_BYTES =
  Number(process.env.VENDOR_UPLOAD_MAX_SIZE_MB || 2) * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
    }

    cb(null, true);
  },
});

module.exports = {
  imageUpload,
  ALLOWED_IMAGE_TYPES,
  EXTENSION_BY_MIME_TYPE,
  MAX_IMAGE_SIZE_BYTES,
};
