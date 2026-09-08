const mongoose = require("mongoose");

const destinationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true, lowercase: true }, // e.g. "india", "bhutan"
    name: { type: String, required: true, trim: true }, // e.g. "India", "Bhutan"
    tagline: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    heroImage: { type: String, default: null },
    heroImagePublicId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", destinationSchema);