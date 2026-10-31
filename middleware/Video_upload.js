const multer = require("multer");

const storage = multer.memoryStorage();

const Video_upload = multer({
  storage: storage,

  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      return cb(null, true);
    }

    return cb(
      new Error("Only video files are allowed.")
    );
  },
});

module.exports = Video_upload;
