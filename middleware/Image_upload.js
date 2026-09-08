const multer = require("multer");

// Store uploaded files temporarily in memory
const storage = multer.memoryStorage();

const Image_upload = multer({
  storage: storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

module.exports = Image_upload;