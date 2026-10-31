const mongoose = require("mongoose");

const homeHeroSchema = new mongoose.Schema(
  {
    place: {
      type: String,
      required: true,
      trim: true,
    },

    line: {
      type: String,
      required: true,
      trim: true,
    },

    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
      default: "image",
    },

    mediaUrl: {
      type: String,
      required: true,
      trim: true,
    },
    mediaId:{
      type: String, 
      default: null 
    },

    active: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("HomeHero",homeHeroSchema);
