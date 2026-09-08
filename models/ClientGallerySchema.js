const mongoose = require("mongoose");

// ============================================================
// CLIENT GALLERY SCHEMA
// ============================================================

const ClientGallerySchema = new mongoose.Schema(
  {
    // ==========================================================
    // IMAGE
    // ==========================================================

    image: {
      type: String,
      required: [true, "Gallery image is required."],
      trim: true,
    },
    imageId:{
      type: String, 
      default: null
    },

    // ==========================================================
    // TITLE
    // Optional
    // ==========================================================

    title: {
      type: String,
      trim: true,
      default: null,
    },

    // ==========================================================
    // PLACE
    // Optional
    // ==========================================================

    place: {
      type: String,
      trim: true,
      default: null,
    },

    // ==========================================================
    // ACTIVE
    // Controls public visibility
    // ==========================================================

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClientGallery",ClientGallerySchema);