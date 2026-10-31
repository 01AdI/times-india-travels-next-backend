const multer = require("multer");

const storage = multer.memoryStorage();

const Hero_media_upload = multer({
  storage: storage,

  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },

  fileFilter: (req, file, cb) => {
    // Allow images
    if (file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }

    // Allow videos
    if (file.mimetype.startsWith("video/")) {
      return cb(null, true);
    }

    // Reject everything else
    return cb(
      new Error("Only image and video files are allowed.")
    );
  },
});

module.exports = Hero_media_upload;
