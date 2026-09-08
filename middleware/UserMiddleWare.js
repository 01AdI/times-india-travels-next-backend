const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function UserMiddleWare(req, res, next) {
  try {
    // ========================================================
    // GET AUTHORIZATION HEADER
    // ========================================================

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    // ========================================================
    // GET TOKEN
    // ========================================================

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication format",
      });
    }

    // ========================================================
    // VERIFY JWT
    // ========================================================

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // ========================================================
    // FIND USER
    // ========================================================

    const user = await User.findById(decoded.id).select(
      "_id role tokenVersion"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Your account could not be found.",
      });
    }

    // ========================================================
    // TOKEN VERSION CHECK
    // ========================================================

    if (
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your session is no longer valid. Please log in again.",
      });
    }

    // ========================================================
    // STORE USER INFORMATION
    // ========================================================

    req.user = {
      id: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    next();

  } catch (err) {
    // ========================================================
    // TOKEN EXPIRED
    // ========================================================

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message:
          "Session expired. Please log in again.",
      });
    }

    // ========================================================
    // INVALID TOKEN
    // ========================================================

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
}

module.exports = UserMiddleWare;