const {mongoose,Schema} = require("mongoose");

const UserSchema = new Schema(
  {
    // Admin name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Admin email
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Hashed password will be stored here
    password: {
      type: String,
      required: true,
    },

    // Currently we only allow admin users
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
    },

    // Updated whenever the admin successfully logs in
    lastLogin: {
      type: Date,
      default: null,
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    // Automatically creates:
    // createdAt
    // updatedAt
    timestamps: true,
  }
);

const User = mongoose.model("Admin_User", UserSchema);

module.exports = User;