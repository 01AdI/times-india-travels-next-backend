const mongoose = require("mongoose");

const itinerarySchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const durationSchema = new mongoose.Schema(
  {
    days: {
      type: Number,
      required: true,
      min: 1,
    },

    nights: {
      type: Number,
      required: true,
      min: 0,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const tourPackageSchema = new mongoose.Schema(
  {
    // Our frontend-friendly ID
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Example: golden-triangle-tours
    categorySlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: durationSchema,
      required: true,
    },

    route: {
      type: [String],
      default: [],
    },

    thumbnail: {
      type: String,
      default: null,
    },
    thumbnailPublicId: { 
      type: String, 
      default: null 
    },
    heroImage: {
      type: String,
      default: null,
    },
    heroImagePublicId: { 
      type: String, 
      default: null 
    },

    // Price can remain null because your website currently works
    // on a quote-based pricing model.
    price: {
      type: Number,
      default: null,
    },

    highlights: {
      type: [String],
      default: [],
    },

    itinerary: {
      type: [itinerarySchema],
      default: [],
    },

    inclusions: {
      type: [String],
      default: [],
    },

    exclusions: {
      type: [String],
      default: [],
    },

    mostLoved: {
      type: Boolean,
      default: false,
      index: true,
    },

    specialPackage: {
      type: Boolean,
      default: false,
      index: true,
    },

    sourceUrl: {
      type: String,
      default: null,
    },
    alsoUnder: {
      type: [String],
      default: [],    
      index: true,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("TourPackage", tourPackageSchema);