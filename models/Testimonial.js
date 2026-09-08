const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {

    name: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    avatar: {
      type: String,
      default: null,
    },
    avatarId: { 
      type: String, 
      default: null 
    },

    review: {
      type: String,
      required: true,
      trim: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    accent: {
      type: String,
      enum: ["blue", "orange"],
      default: "blue",
    },

    verified: {
      type: Boolean,
      default: false,
    },

    source: {
      type: String,
      enum: ["customer", "tripadvisor"],
      default: "customer",
    },

    featuredOnHomepage: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Testimonials", testimonialSchema);
