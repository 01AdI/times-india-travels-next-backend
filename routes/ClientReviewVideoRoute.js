const express = require("express");
const mongoose = require("mongoose");
const ClientReviewVideo = require("../models/ClientReviewVideoSchema");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const Video_upload = require("../middleware/Video_upload");
const uploadHeroMedia = require("../utils/uploadHeroMedia");
const {cleanupDocumentImages}= require("../utils/cloudinaryCleanup");

const ClientReviewVideoRoute = express.Router();

ClientReviewVideoRoute.get("/", async (req, res) => {
  try {
    // ========================================================
    // FIND ACTIVE VIDEOS
    // ========================================================

    const videos = await ClientReviewVideo.find({
      active: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      count: videos.length,

      data: videos,
    });
  } catch (error) {
    console.error(
      "Get client review videos error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Something went wrong while fetching client review videos.",
    });
  }
});


ClientReviewVideoRoute.get("/admin",UserMiddleWare,async (req, res) => {
    try {
      // ======================================================
      // ADMIN CHECK
      // ======================================================

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required.",
        });
      }

      // ======================================================
      // FIND ALL VIDEOS
      // ======================================================

      const videos = await ClientReviewVideo.find()
        .sort({ createdAt: -1 })
        .lean();

      // ======================================================
      // SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        count: videos.length,

        data: videos,
      });
    } catch (error) {
      console.error(
        "Get admin client review videos error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while fetching client review videos.",
      });
    }
  }
);


ClientReviewVideoRoute.get("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      // ======================================================
      // ADMIN CHECK
      // ======================================================

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required.",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
          return res.status(400).json({
          success: false,
          message: "Invalid client review video ID.",
        });
      }
      // ======================================================
      // FIND VIDEO
      // ======================================================

      const video =
        await ClientReviewVideo.findById(
          req.params.id
        ).lean();

      // ======================================================
      // NOT FOUND
      // ======================================================

      if (!video) {
        return res.status(404).json({
          success: false,

          message:
            "Client review video not found.",
        });
      }

      // ======================================================
      // SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        data: video,
      });
    } catch (error) {
      console.error(
        "Get single client review video error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while fetching the client review video.",
      });
    }
  }
);

ClientReviewVideoRoute.post("/admin/create",UserMiddleWare,Video_upload.single("video"),async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required.",
        });
      }

      const {
        name,
        location,
        tour,
        video,
        active,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Client name is required.",
        });
      }

      if (!location || !location.trim()) {
        return res.status(400).json({
          success: false,
          message: "Client location is required.",
        });
      }

      let videoUrl = null;
      let VideoId=null;

      if (req.file) {
        const uploadedVideo =
          await uploadHeroMedia(
            req.file.buffer,
            "times-india-travels/client-review-videos",
            "video"
          );

        videoUrl = uploadedVideo.secure_url;
        VideoId=uploadedVideo.public_id;
      }

      else if (
        typeof video === "string" &&
        video.trim()
      ) {
        videoUrl = video.trim();
      }
      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          message:
            "Client review video is required. Upload a video or provide a video URL.",
        });
      }

      const clientReviewVideo =
        await ClientReviewVideo.create({
          name: name.trim(),

          location: location.trim(),

          tour:
            typeof tour === "string" &&
            tour.trim()
              ? tour.trim()
              : null,

          video: videoUrl,
          VideoId,

          active:
            active === undefined
              ? true
              : active === true ||
                active === "true",
        });


      return res.status(201).json({
        success: true,

        message:
          "Client review video created successfully.",

        data: clientReviewVideo,
      });
    } catch (error) {
      console.error(
        "Create client review video error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while creating the client review video.",
      });
    }
  }
);

ClientReviewVideoRoute.patch("/admin/:id",UserMiddleWare,Video_upload.single("video"),async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required.",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client review video ID.",
        });
      }


      const clientReviewVideo =
        await ClientReviewVideo.findById(
          req.params.id
        );

      if (!clientReviewVideo) {
        return res.status(404).json({
          success: false,

          message:
            "Client review video not found.",
        });
      }

      const {
        name,
        location,
        tour,
        video,
        active,
      } = req.body;

      if (name !== undefined) {
        if (!name || !name.trim()) {
          return res.status(400).json({
            success: false,

            message:
              "Client name cannot be empty.",
          });
        }

        clientReviewVideo.name =
          name.trim();
      }

      if (location !== undefined) {
        if (!location || !location.trim()) {
          return res.status(400).json({
            success: false,

            message:
              "Client location cannot be empty.",
          });
        }

        clientReviewVideo.location =
          location.trim();
      }

      if (tour !== undefined) {
        clientReviewVideo.tour =
          typeof tour === "string" &&
          tour.trim()
            ? tour.trim()
            : null;
      }


      if (req.file) {
        if (clientReviewVideo.VideoId) {
          await cleanupDocumentImages(clientReviewVideo, ["VideoId"]); // clean up the OLD one first
        }
        const uploadedVideo =
          await uploadHeroMedia(
            req.file.buffer,
            "times-india-travels/client-review-videos",
            "video"
          );

        clientReviewVideo.video =uploadedVideo.secure_url;
        clientReviewVideo.VideoId=uploadedVideo.public_id;
      }

      else if (
        typeof video === "string" &&
        video.trim()
      ) {
        clientReviewVideo.video =
          video.trim();
      }

      if (active !== undefined) {
        clientReviewVideo.active =
          active === true ||
          active === "true";
      }

      await clientReviewVideo.save();

      return res.status(200).json({
        success: true,

        message:
          "Client review video updated successfully.",

        data: clientReviewVideo,
      });
    } catch (error) {
      console.error(
        "Update client review video error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while updating the client review video.",
      });
    }
  }
);

ClientReviewVideoRoute.delete("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required.",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client review video ID.",
        });
      }

  
      const clientReviewVideo=await ClientReviewVideo.findByIdAndDelete(req.params.id);
      
      if (!clientReviewVideo) {
        return res.status(404).json({
          success: false,
          
          message:
          "Client review video not found.",
        });
      }
      
      await cleanupDocumentImages(clientReviewVideo, ["VideoId"], "video");

      // ======================================================
      // SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        message:
          "Client review video deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete client review video error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while deleting the client review video.",
      });
    }
  }
);


module.exports = ClientReviewVideoRoute;