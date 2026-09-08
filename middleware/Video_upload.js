const multer = require("multer");

// ============================================================
// STORE FILE IN MEMORY
// ============================================================

const storage = multer.memoryStorage();

// ============================================================
// VIDEO UPLOAD
// Supports:
// - Video files only
// - Maximum 100 MB
// ============================================================

const Video_upload = multer({
  storage: storage,

  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },

  fileFilter: (req, file, cb) => {
    // --------------------------------------------------------
    // ALLOW VIDEOS ONLY
    // --------------------------------------------------------

    if (file.mimetype.startsWith("video/")) {
      return cb(null, true);
    }

    // --------------------------------------------------------
    // REJECT EVERYTHING ELSE
    // --------------------------------------------------------

    return cb(
      new Error("Only video files are allowed.")
    );
  },
});

module.exports = Video_upload;