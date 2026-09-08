const mongoose = require("mongoose");
const leadMetadataSchema = require("./LeadMetadata");
const { isValidCountryCode } = require("../utils/countryNames");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tourEnquirySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Please provide a valid email address"],
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      minlength: 7,
      maxlength: 20,
    },

    nationality: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      validate: {
        validator: (value) => value === null || value === "" || isValidCountryCode(value),
        message: (props) => `"${props.value}" is not a valid ISO country code`,
      },
    },
    tourPackageId: { 
      type: String, 
      default: null, 
      trim: true, 
      lowercase: true 
    },
    tourPackageName: { 
      type: String, 
      default: null, 
      trim: true 
    },
    travelDate: { 
      type: Date, 
      default: null 
    },

    duration: { 
      type: Number, 
      min: 1, 
      default: null 
    },
    adults: {
      type: String,
      enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10+"],
      default: "1",
    },

    children: {
      type: String,
      enum: ["0", "1", "2", "3", "4", "5", "6", "6+"],
      default: "0",
    },
    hotelType: {
      type: String,
      enum: ['Heritage Hotel', '5 Star Luxury', '4 Star', '3 Star'],
      default: null,
      trim: true
    },
    reference: { 
      type: String, 
      default: null, 
      trim: true 
    },
    details: { 
      type: String, 
      default: null, 
      trim: true 
    },

    status: {
      type: String,
      enum: ["new", "contacted", "quotation-sent", "follow-up", "confirmed", "cancelled"],
      default: "new",
      index: true, // admin dashboard filters on this constantly
    },

    adminNotes: { 
      type: String, 
      default: null, 
      trim: true 
    },
    lastContactedAt: { 
      type: Date, 
      default: null 
    },

    adminNotification: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
    },

    leadMetadata: {
      type: leadMetadataSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TourEnquiry", tourEnquirySchema);