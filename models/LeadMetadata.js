const {Schema} = require("mongoose");
const { isValidCountryCode } = require("../utils/countryNames");

const leadMetadataSchema = new Schema(
  {
    ipAddress: {
      type: String,
      default: null,
    },

    ipCountry: {
      type: String,
      default: null,
      validate: {
        validator: (value) => value === null || value === "" || isValidCountryCode(value),
        message: (props) => `"${props.value}" is not a valid ISO country code`,
      },
    },

    ipRegion: {
      type: String,
      default: null,
    },

    ipCity: {
      type: String,
      default: null,
    },

    phoneCountry: {
      type: String,
      default: null,
      validate: {
      validator: (value) => value === null || value === "" || isValidCountryCode(value),
      message: (props) => `"${props.value}" is not a valid ISO country code`,
    },
    },

    userAgent: {
      type: String,
      default: null,
    },

    source: {
      type: String,
      default: "website",
    },

    sourcePage: {
      type: String,
      default: null,
    },

    riskLevel: {
      type: String,
      enum: ["normal", "suspicious", "high-risk"],
      default: "normal",
    },
    riskReasons: {
        type: [String],
        default: [],
    },
  },
  {
    _id: false,
  }
);

module.exports = leadMetadataSchema;