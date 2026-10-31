const mongoose = require("mongoose");

const ClientReviewVideoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    tour: {
      type: String,
      trim: true,
      default: null,
    },

    video: {
      type: String,
      required: true,
      trim: true,
    },
    VideoId: { 
      type: String, 
      default: null 
    },

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
