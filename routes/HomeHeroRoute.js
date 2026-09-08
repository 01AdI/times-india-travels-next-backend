const express = require("express");
const mongoose = require("mongoose");
const UserMiddleWare=require("../middleware/UserMiddleWare");
const  HomeHero = require("../models/HeroHomeSchema");
const Hero_media_upload=require("../middleware/Hero_media_upload");
const uploadHeroMedia = require("../utils/uploadHeroMedia");
const {deleteCloudinaryAsset}=require("../utils/cloudinaryCleanup");

const HomeHeroRoute = express.Router();


HomeHeroRoute.post("/admin/create",UserMiddleWare,Hero_media_upload.single("media"),async (req, res) => {
    try {
      // ========================================================
      // ADMIN CHECK
      // ========================================================

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can create hero slides.",
        });
      }

      const {
        place,
        line,
        mediaType,
        mediaUrl,
        active,
        order,
      } = req.body;

      // ========================================================
      // VALIDATION
      // ========================================================

      if (!place || !place.trim()) {
        return res.status(400).json({
          success: false,
          message: "Place is required.",
        });
      }

      if (!line || !line.trim()) {
        return res.status(400).json({
          success: false,
          message: "Line is required.",
        });
      }

      if (!mediaType) {
        return res.status(400).json({
          success: false,
          message: "Please choose image or video.",
        });
      }

      if (
        mediaType !== "image" &&
        mediaType !== "video"
      ) {
        return res.status(400).json({
          success: false,
          message: "Media must be an image or video.",
        });
      }

      // ========================================================
      // MEDIA
      // ========================================================

      let finalMediaUrl = null;
      let mediaId=null;

      // ========================================================
      // UPLOADED IMAGE / VIDEO
      // ========================================================

      if (req.file) {
        const uploadedMedia = await uploadHeroMedia(
          req.file.buffer,
          "times-india-travels/home-hero",
          mediaType
        );

        finalMediaUrl = uploadedMedia.secure_url;
        mediaId=uploadedMedia.public_id;
      }

      // ========================================================
      // MEDIA URL
      // ========================================================

      else if (
        typeof mediaUrl === "string" &&
        mediaUrl.trim()
      ) {
        finalMediaUrl = mediaUrl.trim();
      }

      // ========================================================
      // NO MEDIA
      // ========================================================

      else {
        return res.status(400).json({
          success: false,
          message:
            "Please upload an image/video or provide a media link.",
        });
      }

      // ========================================================
      // ACTIVE
      // ========================================================

      const isActive =
        active === undefined
          ? true
          : active === true ||
            active === "true";

      // ========================================================
      // ORDER
      // ========================================================

      const slideOrder =
        order !== undefined &&
        order !== null &&
        order !== ""
          ? Number(order)
          : 0;

      if (
        !Number.isInteger(slideOrder) ||
        slideOrder < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Slide order must be a valid number.",
        });
      }

      // ========================================================
      // CREATE HERO SLIDE
      // ========================================================

      const heroSlide = await HomeHero.create({
        place: place.trim(),
        line: line.trim(),
        mediaType,
        mediaUrl: finalMediaUrl,
        mediaId,
        active: isActive,
        order: slideOrder,
      });

      // ========================================================
      // SUCCESS RESPONSE
      // ========================================================

      return res.status(201).json({
        success: true,

        message:
          "Hero slide created successfully.",

        data: heroSlide,
      });
    } catch (error) {
      console.error(
        "Admin create hero slide error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while creating the hero slide.",
      });
    }
  }
);

HomeHeroRoute.get("/", async (req, res) => {
  try {
    // ========================================================
    // GET ACTIVE SLIDES
    // ========================================================

    const heroSlides = await HomeHero.find({
      active: true,
    })
      .select(
        "place line mediaType mediaUrl order"
      )
      .sort({
        order: 1,
      })
      .lean();

    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      count: heroSlides.length,

      data: heroSlides,
    });
  } catch (error) {
    console.error(
      "Get home hero slides error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Something went wrong while fetching the hero slides.",
    });
  }
});

HomeHeroRoute.get("/admin",UserMiddleWare,async (req, res) => {
    try {
      // ========================================================
      // ADMIN CHECK
      // ========================================================

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can access hero slides.",
        });
      }

      // ========================================================
      // GET ALL HERO SLIDES
      // ========================================================

      const heroSlides = await HomeHero.find({})
        .sort({
          order: 1,
          createdAt: -1,
        })
        .lean();

      // ========================================================
      // SUCCESS RESPONSE
      // ========================================================

      return res.status(200).json({
        success: true,

        count: heroSlides.length,

        data: heroSlides,
      });
    } catch (error) {
      console.error(
        "Admin get hero slides error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while fetching hero slides.",
      });
    }
  }
);

HomeHeroRoute.get("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can access hero slides.",
        });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hero slide ID.",
        });
      }

      const heroSlide = await HomeHero.findById(id);

      if (!heroSlide) {
        return res.status(404).json({
          success: false,
          message: "Hero slide not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: heroSlide,
      });
    } catch (error) {
      console.error(
        "Admin get hero slide error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while fetching the hero slide.",
      });
    }
  }
);

HomeHeroRoute.patch("/admin/:id",UserMiddleWare,Hero_media_upload.single("media"),async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can update hero slides.",
        });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hero slide ID.",
        });
      }

      const heroSlide = await HomeHero.findById(id);

      if (!heroSlide) {
        return res.status(404).json({
          success: false,
          message: "Hero slide not found.",
        });
      }

      const {
        place,
        line,
        mediaType,
        mediaUrl,
        active,
        order,
      } = req.body;

      if (place !== undefined) {
        if (
          typeof place !== "string" ||
          !place.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Place cannot be empty.",
          });
        }

        heroSlide.place = place.trim();
      }

      if (line !== undefined) {
        if (
          typeof line !== "string" ||
          !line.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Line cannot be empty.",
          });
        }

        heroSlide.line = line.trim();
      }

      if (mediaType !== undefined) {
        if (
          mediaType !== "image" &&
          mediaType !== "video"
        ) {
          return res.status(400).json({
            success: false,
            message: "Media must be an image or video.",
          });
        }

        heroSlide.mediaType = mediaType;
      }

      if (req.file) {
        if (heroSlide.mediaId) {
          await deleteCloudinaryAsset(heroSlide.mediaId, heroSlide.mediaType); // clean up the OLD one first
        }

        const uploadType =mediaType || heroSlide.mediaType;
        const uploadedMedia = await uploadHeroMedia(
          req.file.buffer,
          "times-india-travels/home-hero",
          uploadType
        );

        heroSlide.mediaUrl =uploadedMedia.secure_url;
        heroSlide.mediaType = uploadType;
        heroSlide.mediaId=uploadedMedia.public_id;
      } else if (mediaUrl !== undefined) {
        if (
          typeof mediaUrl !== "string" ||
          !mediaUrl.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Media link cannot be empty.",
          });
        }

        heroSlide.mediaUrl = mediaUrl.trim();
      }

      // ========================================================
      // UPDATE ACTIVE
      // ========================================================

      if (active !== undefined) {
        heroSlide.active =
          active === true ||
          active === "true";
      }

      // ========================================================
      // UPDATE ORDER
      // ========================================================

      if (
        order !== undefined &&
        order !== null &&
        order !== ""
      ) {
        const slideOrder = Number(order);

        if (
          !Number.isInteger(slideOrder) ||
          slideOrder < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Slide order must be a valid number.",
          });
        }

        heroSlide.order = slideOrder;
      }

      // ========================================================
      // SAVE HERO SLIDE
      // ========================================================

      await heroSlide.save();

      // ========================================================
      // SUCCESS RESPONSE
      // ========================================================

      return res.status(200).json({
        success: true,

        message:
          "Hero slide updated successfully.",

        data: heroSlide,
      });
    } catch (error) {
      console.error(
        "Admin update hero slide error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while updating the hero slide.",
      });
    }
  }
);

HomeHeroRoute.delete("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      // ========================================================
      // ADMIN CHECK
      // ========================================================

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can delete hero slides.",
        });
      }

      const { id } = req.params;

      // ========================================================
      // VALIDATE ID
      // ========================================================

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hero slide ID.",
        });
      }

      // ========================================================
      // FIND HERO SLIDE
      // ========================================================

      const heroSlide = await HomeHero.findById(id);

      if (!heroSlide) {
        return res.status(404).json({
          success: false,
          message: "Hero slide not found.",
        });
      }

      // ========================================================
      // DELETE HERO SLIDE
      // ========================================================

      const deletedPackage=await HomeHero.findByIdAndDelete(id);

      await deleteCloudinaryAsset(deletedPackage.mediaId, deletedPackage.mediaType);

      // ========================================================
      // SUCCESS RESPONSE
      // ========================================================

      return res.status(200).json({
        success: true,

        message:
          "Hero slide deleted successfully.",

        data: {
          id: heroSlide._id,

          place: heroSlide.place,

          line: heroSlide.line,
        },
      });
    } catch (error) {
      console.error(
        "Admin delete hero slide error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while deleting the hero slide.",
      });
    }
  }
);

module.exports=HomeHeroRoute;