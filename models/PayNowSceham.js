const mongoose = require("mongoose");
const leadMetadataSchema = require("./LeadMetadata");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const payNowEnquirySchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      address: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      postalCode: {
        type: String,
        required: true,
        trim: true,
      },

      country: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [EMAIL_REGEX, "Please provide a valid email address"],
      },

      telephone: {
        type: String,
        required: true,
        trim: true,
        minlength: 7,
        maxlength: 20,
      },
    },

    billing: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      address: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      postalCode: {
        type: String,
        required: true,
        trim: true,
      },

      country: {
        type: String,
        required: true,
        trim: true,
      },

      telephone: {
        type: String,
        required: true,
        trim: true,
        minlength: 7,
        maxlength: 20,
      },
    },

    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "payment-link-sent",
        "paid",
        "cancelled",
      ],
      default: "new",
      index: true,
    },

    adminNotes: {
      type: String,
      default: null,
      trim: true,
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

module.exports = mongoose.model("PayNowEnquiry",payNowEnquirySchema);