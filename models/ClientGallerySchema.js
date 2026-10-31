const mongoose = require("mongoose");

const ClientGallerySchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: [true, "Gallery image is required."],
      trim: true,
    },
    imageId:{
      type: String, 
      default: null
    },

    title: {
      type: String,
      trim: true,
      default: null,
    },

    place: {
      type: String,
      trim: true,
      default: null,
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

module.exports = mongoose.model("ClientGallery",ClientGallerySchema);
