const express = require("express");
const mongoose = require("mongoose");
const ClientGallery = require("../models/ClientGallerySchema");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const Image_upload = require("../middleware/Image_upload");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const {cleanupDocumentImages}=require("../utils/cloudinaryCleanup");

const ClientGalleryRoute = express.Router();

ClientGalleryRoute.get("/", async (req, res) => {
  try {
    const gallery = await ClientGallery.find({
      active: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,

      count: gallery.length,

      data: gallery,
    });
  } catch (error) {
    console.error(
      "Get client gallery error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Something went wrong while fetching the client gallery.",
    });
  }
});


ClientGalleryRoute.get("/admin",UserMiddleWare,async (req, res) => {
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
      // FIND ALL
      // ======================================================

      const gallery =
        await ClientGallery.find({})
          .sort({ createdAt: -1 })
          .lean();

      // ======================================================
      // SUCCESS
      // ======================================================

      return res.status(200).json({
        success: true,

        count: gallery.length,

        data: gallery,
      });
    } catch (error) {
      console.error(
        "Admin get client gallery error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while fetching the client gallery.",
      });
    }
  }
);


ClientGalleryRoute.get("/:id", async (req, res) => {
  try {
    // ======================================================
    // VALIDATE ID
    // ======================================================

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gallery photo ID.",
      });
    }

    const galleryItem =
      await ClientGallery.findOne({
        _id: req.params.id,
        active: true,
      }).lean();

    if (!galleryItem) {
      return res.status(404).json({
        success: false,

        message:
          "Client gallery photo not found.",
      });
    }

    return res.status(200).json({
      success: true,

      data: galleryItem,
    });
  } catch (error) {
    console.error(
      "Get client gallery photo error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Something went wrong while fetching the client gallery photo.",
    });
  }
});


ClientGalleryRoute.post("/admin/create",UserMiddleWare,Image_upload.single("image"),async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,

          message: "Admin access required.",
        });
      }


      const {
        image,
        title,
        place,
        active,
      } = req.body;


      if (
        !req.file &&
        !(typeof image === "string" && image.trim())
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Gallery image is required.",
        });
      }


      let imageUrl = null;
      let imageId=null;

      // Direct upload
      if (req.file) {
        const uploadedImage =
          await uploadToCloudinary(
            req.file.buffer,
            "times-india-travels/client-gallery"
          );

        imageUrl =uploadedImage.secure_url;
        imageId=uploadedImage.public_id;

      }

      // Existing URL
      else if (
        typeof image === "string" &&
        image.trim()
      ) {
        imageUrl = image.trim();
      }

      const galleryItem =
        await ClientGallery.create({
          image: imageUrl,
          imageId,

          title:
            typeof title === "string" &&
            title.trim()
              ? title.trim()
              : null,

          place:
            typeof place === "string" &&
            place.trim()
              ? place.trim()
              : null,

          active:
            active === undefined
              ? true
              : active === true ||
                active === "true",
        });

      return res.status(201).json({
        success: true,

        message:
          "Client gallery photo created successfully.",

        data: galleryItem,
      });
    } catch (error) {
      console.error(
        "Create client gallery error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while creating the client gallery photo.",
      });
    }
  }
);

ClientGalleryRoute.patch("/admin/:id",UserMiddleWare,Image_upload.single("image"),async (req, res) => {
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
          message: "Invalid gallery photo ID.",
        });
      }

      const galleryItem =
        await ClientGallery.findById(
          req.params.id
        );

      if (!galleryItem) {
        return res.status(404).json({
          success: false,

          message:
            "Client gallery photo not found.",
        });
      }

      const {
        image,
        title,
        place,
        active,
      } = req.body;


      if (req.file) {
        if (galleryItem.imageId) {
          await cleanupDocumentImages(existingDestigalleryItemnation, ["imageId"]); // clean up the OLD one first
        }
        const uploadedImage =
          await uploadToCloudinary(
            req.file.buffer,
            "times-india-travels/client-gallery"
          );

        galleryItem.image =uploadedImage.secure_url;
        galleryItem.imageId=uploadedImage.public_id;
      } else if (
        typeof image === "string" &&
        image.trim()
      ) {
        galleryItem.image =
          image.trim();
      }

      if (title !== undefined) {
        galleryItem.title =
          typeof title === "string" &&
          title.trim()
            ? title.trim()
            : null;
      }

      if (place !== undefined) {
        galleryItem.place =
          typeof place === "string" &&
          place.trim()
            ? place.trim()
            : null;
      }

      if (active !== undefined) {
        galleryItem.active =
          active === true ||
          active === "true";
      }

      await galleryItem.save();

      return res.status(200).json({
        success: true,

        message:
          "Client gallery photo updated successfully.",

        data: galleryItem,
      });
    } catch (error) {
      console.error(
        "Update client gallery error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while updating the client gallery photo.",
      });
    }
  }
);


ClientGalleryRoute.delete("/admin/:id",UserMiddleWare,async (req, res) => {
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
          message: "Invalid gallery photo ID.",
        });
      }

      const galleryItem =
        await ClientGallery.findByIdAndDelete(req.params.id);

      if (!galleryItem) {
        return res.status(404).json({
          success: false,

          message:
            "Client gallery photo not found.",
        });
      }

      await cleanupDocumentImages(galleryItem, ["imageId"]);

      return res.status(200).json({
        success: true,

        message:
          "Client gallery photo deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete client gallery error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Something went wrong while deleting the client gallery photo.",
      });
    }
  }
);

module.exports = ClientGalleryRoute;