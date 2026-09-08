const mongoose = require("mongoose");

const tourCategorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    tagline: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },
    heroImage: {
      type: String,
      default: null,
    },
    heroImagePublicId: { 
      type: String, 
      default: null 
    },
    showInNavbar: {
      type: Boolean,
      default: true,
    },
    showInExplore: {
      type: Boolean,
      default: true,
    },

    destinations:{
      type:[String],
      default:[],
    },
    destinations_gallery: {
      type: [
        {
          url: {
            type: String,
            required: true,
            trim: true,
          },
          caption: {
            type: String,
            default: "",
            trim: true,
          },
          publicId: {
            type: String,
            default: null,
            trim: true,
          },
        },
      ],
      
      default: [],
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("TourCategory", tourCategorySchema);