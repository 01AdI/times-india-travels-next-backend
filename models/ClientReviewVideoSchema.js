const mongoose = require("mongoose");

const ClientReviewVideoSchema = new mongoose.Schema(
  {
    // ========================================================
    // CLIENT NAME
    // ========================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================================
    // CLIENT LOCATION
    // ========================================================

    location: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================================
    // TOUR VISITED
    // Optional because some reviews do not mention a tour.
    // ========================================================

    tour: {
      type: String,
      trim: true,
      default: null,
    },

    // ========================================================
    // VIDEO
    // Cloudinary / storage URL
    // ========================================================

    video: {
      type: String,
      required: true,
      trim: true,
    },
    VideoId: { 
      type: String, 
      default: null 
    },

    // ========================================================
    // PUBLIC VISIBILITY
    // ========================================================

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClientReviewVideo",ClientReviewVideoSchema);