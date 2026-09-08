const mongoose = require("mongoose");
const leadMetadataSchema = require("./LeadMetadata");

const carRentalEnquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    nationality: {
      type: String,
      default: null,
      trim: true,
    },

    tourPackageId: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },

    tourPackageName: {
      type: String,
      default: null,
      trim: true,
    },

    travelDate: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      min: 1,
      default: null,
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

    vehicle: {
      type: String,
      default: null,
      trim: true,
    },


    reference: {
      type: String,
      default: null,
      trim: true,
    },

    details: {
      type: String,
      default: null,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "quotation-sent",
        "follow-up",
        "confirmed",
        "cancelled",
      ],
      default: "new",
    },

    adminNotes: {
      type: String,
      default: null,
      trim: true,
    },

    lastContactedAt: {
      type: Date,
      default: null,
    },

    adminNotification: {
      sent: {
        type: Boolean,
        default: false,
      },

      sentAt: {
        type: Date,
        default: null,
      },
    },

    leadMetadata: {
      type: leadMetadataSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "CarRentalEnquiry",
  carRentalEnquirySchema
);
