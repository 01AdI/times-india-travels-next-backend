const express = require("express");
const mongoose = require("mongoose");

const Testimonial = require("../models/Testimonial");
const Image_upload = require("../middleware/Image_upload");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const {cleanupDocumentImages} =require("../utils/cloudinaryCleanup");

const TestimonialRoute = express.Router();

// SUBMIT TESTIMONIAL
TestimonialRoute.post("/create",Image_upload.single("avatar"),
  async (req, res) => {
    try {
      const { name, location, review, rating } = req.body;

      // ========================================================
      // VALIDATION
      // ========================================================

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name is required.",
        });
      }

      if (!review || !review.trim()) {
        return res.status(400).json({
          success: false,
          message: "Review is required.",
        });
      }

      if (rating === undefined || rating === null) {
        return res.status(400).json({
          success: false,
          message: "Rating is required.",
        });
      }

      // ========================================================
      // RATING VALIDATION
      // ========================================================

      const numericRating = Number(rating);

      if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Rating must be an integer between 1 and 5.",
        });
      }

      // ========================================================
      // AVATAR
      // ========================================================

      let avatarUrl = null;
      let avatarId=null;

      if (req.file) {
        const uploadedImage = await uploadToCloudinary(
          req.file.buffer,
          "times-india-travels/testimonials",
        );

        avatarUrl = uploadedImage.secure_url;
        avatarId=uploadedImage.public_id;
      }

      // ========================================================
      // CREATE TESTIMONIAL
      // ========================================================

      const testimonial = await Testimonial.create({
        name: name.trim(),

        location: typeof location === "string" ? location.trim() : "",

        avatar: avatarUrl,
        avatarId,

        review: review.trim(),

        rating: numericRating,

        // ======================================================
        // BACKEND CONTROLLED FIELDS
        // ======================================================

        source: "customer",

        featuredOnHomepage: false,

        status: "pending",

        approvedAt: null,

        rejectedAt: null,
      });

      // ========================================================
      // SUCCESS RESPONSE
      // ========================================================

      return res.status(201).json({
        success: true,

        message:
          "Thank you for your review. Your testimonial has been submitted and is awaiting approval.",

        data: {
          id: testimonial._id,

          name: testimonial.name,

          location: testimonial.location,

          avatar: testimonial.avatar,

          review: testimonial.review,

          rating: testimonial.rating,

          status: testimonial.status,
        },
      });
    } catch (error) {
      console.error("Testimonial submission error:", error);

      return res.status(500).json({
        success: false,

        message: "Something went wrong while submitting your testimonial.",
      });
    }
  },
);

// ADMIN CREATE TESTIMONIAL

TestimonialRoute.post("/admin/create",UserMiddleWare,Image_upload.single("avatar"),
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          message: "Only admins can create Testimonials",
        });
      }
      const {
        name,
        location,
        avatarUrl,
        review,
        rating,
        accent,
        verified,
        source,
        featuredOnHomepage,
        status,
      } = req.body;

      // ========================================================
      // VALIDATION
      // ========================================================

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name is required.",
        });
      }

      if (!review || !review.trim()) {
        return res.status(400).json({
          success: false,
          message: "Review is required.",
        });
      }

      if (rating === undefined || rating === null) {
        return res.status(400).json({
          success: false,
          message: "Rating is required.",
        });
      }

      // ========================================================
      // RATING VALIDATION
      // ========================================================

      const numericRating = Number(rating);

      if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Rating must be an integer between 1 and 5.",
        });
      }

      // ========================================================
      // SOURCE VALIDATION
      // ========================================================

      const testimonialSource = source || "customer";

      if (!["customer", "tripadvisor"].includes(testimonialSource)) {
        return res.status(400).json({
          success: false,
          message: 'Source must be either "customer" or "tripadvisor".',
        });
      }

      // ========================================================
      // STATUS VALIDATION
      // ========================================================

      const testimonialStatus = status || "approved";

      if (!["pending", "approved", "rejected"].includes(testimonialStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be "pending", "approved", or "rejected".',
        });
      }

      // ========================================================
      // ACCENT VALIDATION
      // ========================================================

      const testimonialAccent = accent || "blue";

      if (!["blue", "orange"].includes(testimonialAccent)) {
        return res.status(400).json({
          success: false,
          message: 'Accent must be either "blue" or "orange".',
        });
      }

      // ========================================================
      // BOOLEAN VALUES
      // ========================================================

      const isVerified = verified === true || verified === "true";

      const wantsHomepageFeature =
        featuredOnHomepage === true || featuredOnHomepage === "true";

      // ========================================================
      // HOMEPAGE FEATURE VALIDATION
      // ========================================================

      if (
        wantsHomepageFeature &&
        (testimonialSource !== "tripadvisor" ||
          testimonialStatus !== "approved")
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only approved TripAdvisor testimonials can be featured on the homepage.",
        });
      }

      // ========================================================
      // AVATAR
      // ========================================================

      let avatar = null;
      let avatarId=null;

      // --------------------------------------------------------
      // OPTION 1: IMAGE UPLOAD
      // --------------------------------------------------------

      if (req.file) {
        const uploadedImage = await uploadToCloudinary(
          req.file.buffer,
          "times-india-travels/testimonials",
        );

        avatar = uploadedImage.secure_url;
        avatarId=uploadedImage.public_id;
      }

      // --------------------------------------------------------
      // OPTION 2: AVATAR URL
      // --------------------------------------------------------
      else if (typeof avatarUrl === "string" && avatarUrl.trim()) {
        avatar = avatarUrl.trim();
      }

      // ========================================================
      // APPROVAL DATES
      // ========================================================

      let approvedAt = null;
      let rejectedAt = null;

      if (testimonialStatus === "approved") {
        approvedAt = new Date();
      }

      if (testimonialStatus === "rejected") {
        rejectedAt = new Date();
      }

      // ========================================================
      // CREATE TESTIMONIAL
      // ========================================================

      const testimonial = await Testimonial.create({
        name: name.trim(),

        location: typeof location === "string" ? location.trim() : "",

        avatar,
        avatarId,

        review: review.trim(),

        rating: numericRating,

        accent: testimonialAccent,

        verified: isVerified,

        source: testimonialSource,

        featuredOnHomepage: wantsHomepageFeature,

        status: testimonialStatus,

        approvedAt,

        rejectedAt,
      });

      // ========================================================
      // SUCCESS RESPONSE
      // ========================================================

      return res.status(201).json({
        success: true,

        message: "Testimonial created successfully.",

        data: {
          id: testimonial._id,

          name: testimonial.name,

          location: testimonial.location,

          avatar: testimonial.avatar,

          review: testimonial.review,

          rating: testimonial.rating,

          accent: testimonial.accent,

          verified: testimonial.verified,

          source: testimonial.source,

          featuredOnHomepage: testimonial.featuredOnHomepage,

          status: testimonial.status,

          approvedAt: testimonial.approvedAt,

          rejectedAt: testimonial.rejectedAt,
        },
      });
    } catch (error) {
      console.error("Admin testimonial creation error:", error);

      return res.status(500).json({
        success: false,

        message: "Something went wrong while creating the testimonial.",
      });
    }
  },
);

// GET ALL APPROVED TESTIMONIALS

TestimonialRoute.get("/", async (req, res) => {
  try {
    // ========================================================
    // FIND APPROVED TESTIMONIALS
    // ========================================================

    const testimonials = await Testimonial.find({
      status: "approved",
    })
      .sort({ createdAt: -1 })
      .lean();

    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      count: testimonials.length,

      data: testimonials,
    });
  } catch (error) {
    console.error("Get testimonials error:", error);

    return res.status(500).json({
      success: false,

      message: "Something went wrong while fetching testimonials.",
    });
  }
});

// GET HOMEPAGE TESTIMONIALS

TestimonialRoute.get("/homepage", async (req, res) => {
  try {
    // ======================================================
    // FIND HOMEPAGE TESTIMONIALS
    // ======================================================

    const testimonials = await Testimonial.find({
      source: "tripadvisor",
      status: "approved",
      featuredOnHomepage: true,
    })
      .sort({ createdAt: -1 })
      .limit(7)
      .lean();

    // ======================================================
    // SUCCESS RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,

      count: testimonials.length,

      data: testimonials,
    });
  } catch (error) {
    console.error("Get homepage testimonials error:", error);

    return res.status(500).json({
      success: false,

      message: "Something went wrong while fetching homepage testimonials.",
    });
  }
});

// ADMIN GET ALL TESTIMONIALS

TestimonialRoute.get("/admin", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can access this  Testimonials",
      });
    }
    // ======================================================
    // GET ALL TESTIMONIALS
    // ======================================================

    const testimonials = await Testimonial.find({})
      .sort({ createdAt: -1 })
      .lean();

    // ======================================================
    // SUCCESS RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,

      count: testimonials.length,

      data: testimonials,
    });
  } catch (error) {
    console.error("Admin get testimonials error:", error);

    return res.status(500).json({
      success: false,

      message: "Something went wrong while fetching testimonials.",
    });
  }
});

// ADMIN GET SINGLE TESTIMONIAL

TestimonialRoute.get("/admin/:id", UserMiddleWare, async (req, res) => {
  try {
    // ADMIN CHECK

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can access this testimonial.",
      });
    }

    const { id } = req.params;

    // VALIDATE ID

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial ID.",
      });
    }

    // FIND TESTIMONIAL

    const testimonial = await Testimonial.findById(id).lean();

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found.",
      });
    }

    // SUCCESS RESPONSE

    return res.status(200).json({
      success: true,
      data: testimonial,
    });
  } catch (error) {
    console.error("Admin get testimonial error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching the testimonial.",
    });
  }
});

// GET SINGLE TESTIMONIAL

TestimonialRoute.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial ID.",
      });
    }

    const testimonial = await Testimonial.findOne({
      _id: id,
      status: "approved", // don't leak pending/rejected testimonials publicly
    }).lean();

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: testimonial,
    });
  } catch (error) {
    console.error("Get testimonial error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching the testimonial.",
    });
  }
});

// ADMIN APPROVE TESTIMONIAL

TestimonialRoute.patch("/admin/:id/approve",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          message: "Only admins can approve Testimonials",
        });
      }

      const { id } = req.params;

      // ======================================================
      // VALIDATE ID
      // ======================================================

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid testimonial ID.",
        });
      }

      // ======================================================
      // FIND TESTIMONIAL
      // ======================================================

      const testimonial = await Testimonial.findById(id);

      if (!testimonial) {
        return res.status(404).json({
          success: false,
          message: "Testimonial not found.",
        });
      }

      // ======================================================
      // ALREADY APPROVED
      // ======================================================

      if (testimonial.status === "approved") {
        return res.status(200).json({
          success: true,
          message: "Testimonial is already approved.",
          data: testimonial,
        });
      }

      // ======================================================
      // APPROVE TESTIMONIAL
      // ======================================================

      testimonial.status = "approved";

      testimonial.approvedAt = new Date();

      // If previously rejected, clear rejected date

      testimonial.rejectedAt = null;

      await testimonial.save();

      // ======================================================
      // SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        message: "Testimonial approved successfully.",

        data: testimonial,
      });
    } catch (error) {
      console.error("Approve testimonial error:", error);

      return res.status(500).json({
        success: false,

        message: "Something went wrong while approving the testimonial.",
      });
    }
  },
);

// ADMIN REJECT TESTIMONIAL

TestimonialRoute.patch("/admin/:id/reject",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          message: "Only admins can reject Testimonials",
        });
      }
      const { id } = req.params;

      // ======================================================
      // VALIDATE ID
      // ======================================================

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid testimonial ID.",
        });
      }

      // ======================================================
      // FIND TESTIMONIAL
      // ======================================================

      const testimonial = await Testimonial.findById(id);

      if (!testimonial) {
        return res.status(404).json({
          success: false,
          message: "Testimonial not found.",
        });
      }

      // ======================================================
      // ALREADY REJECTED
      // ======================================================

      if (testimonial.status === "rejected") {
        return res.status(200).json({
          success: true,
          message: "Testimonial is already rejected.",
          data: testimonial,
        });
      }

      // ======================================================
      // REJECT TESTIMONIAL
      // ======================================================

      testimonial.status = "rejected";

      testimonial.rejectedAt = new Date();

      // Clear approval information if it was previously approved

      testimonial.approvedAt = null;

      // ======================================================
      // IMPORTANT
      // ======================================================
      // A rejected testimonial should not appear on homepage.
      // Therefore, remove homepage featuring as well.

      testimonial.featuredOnHomepage = false;

      await testimonial.save();

      // ======================================================
      // SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        message: "Testimonial rejected successfully.",

        data: testimonial,
      });
    } catch (error) {
      console.error("Reject testimonial error:", error);

      return res.status(500).json({
        success: false,

        message: "Something went wrong while rejecting the testimonial.",
      });
    }
  },
);

// ADMIN FEATURE / UNFEATURE TESTIMONIAL

TestimonialRoute.patch("/admin/:id/feature",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          message: "Only admins can add Testimonials to home page",
        });
      }
      const { id } = req.params;
      const { featuredOnHomepage } = req.body;

      // ======================================================
      // VALIDATE ID
      // ======================================================

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid testimonial ID.",
        });
      }

      // ======================================================
      // VALIDATE FEATURE VALUE
      // ======================================================

      if (typeof featuredOnHomepage !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "featuredOnHomepage must be a boolean value.",
        });
      }

      // ======================================================
      // FIND TESTIMONIAL
      // ======================================================

      const testimonial = await Testimonial.findById(id);

      if (!testimonial) {
        return res.status(404).json({
          success: false,
          message: "Testimonial not found.",
        });
      }

      // ======================================================
      // ONLY APPROVED TRIPADVISOR REVIEWS
      // CAN BE FEATURED
      // ======================================================

      if (
        featuredOnHomepage === true &&
        (testimonial.source !== "tripadvisor" ||
          testimonial.status !== "approved")
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only approved TripAdvisor testimonials can be featured on the homepage.",
        });
      }

      // ======================================================
      // FEATURE / UNFEATURE
      // ======================================================

      testimonial.featuredOnHomepage = featuredOnHomepage;

      await testimonial.save();

      // ======================================================
      // SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        message: featuredOnHomepage
          ? "Testimonial featured on homepage successfully."
          : "Testimonial removed from homepage successfully.",

        data: {
          id: testimonial._id,

          name: testimonial.name,

          source: testimonial.source,

          status: testimonial.status,

          featuredOnHomepage: testimonial.featuredOnHomepage,
        },
      });
    } catch (error) {
      console.error("Feature testimonial error:", error);

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while updating homepage testimonial status.",
      });
    }
  },
);

// ADMIN DELETE TESTIMONIAL

TestimonialRoute.delete("/admin/:id", UserMiddleWare, async (req, res) => {
  try {
    // ======================================================
    // ADMIN CHECK
    // ======================================================

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete Testimonials",
      });
    }

    const { id } = req.params;

    // ======================================================
    // VALIDATE ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testimonial ID.",
      });
    }

    // ======================================================
    // FIND TESTIMONIAL
    // ======================================================

    const testimonial = await Testimonial.findById(id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found.",
      });
    }

    // ======================================================
    // DELETE TESTIMONIAL
    // ======================================================

    await Testimonial.findByIdAndDelete(id);
    await cleanupDocumentImages(testimonial, ["avatarId"]);

    // ======================================================
    // SUCCESS RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,

      message: "Testimonial deleted successfully.",

      data: {
        id: testimonial._id,

        name: testimonial.name,

        source: testimonial.source,
      },
    });
  } catch (error) {
    console.error("Delete testimonial error:", error);

    return res.status(500).json({
      success: false,

      message: "Something went wrong while deleting the testimonial.",
    });
  }
});

module.exports = TestimonialRoute;
