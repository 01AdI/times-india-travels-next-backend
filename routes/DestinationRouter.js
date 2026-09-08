const express = require("express");

const Destination = require("../models/DestinationSchema");
const TourCategory = require("../models/TourCategory");
const TourPackage = require("../models/TourPackage");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const Image_upload = require("../middleware/Image_upload");
const {cleanupDocumentImages}=require("../utils/cloudinaryCleanup");

const DestinationRouter = express.Router();

function handleDestinationError(error, res, action) {
  console.error(`Error ${action} destination:`, error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "A destination with this id already exists" });
  }
  return res.status(500).json({ success: false, message: `Failed to ${action} destination` });
}

async function attachCategoriesAndPackages(destinationIds, allCategories, allPackages) {
  const isSingle = !Array.isArray(destinationIds);
  const ids = isSingle ? [destinationIds] : destinationIds;

  const result = {};
  for (const destinationId of ids) {
    const categories = allCategories
      .filter((category) => category.destinations?.includes(destinationId))
      .map((category) => ({
        ...category,
        packages: allPackages.filter(
          (p) => p.categorySlug === category.id || p.alsoUnder?.includes(category.id)
        ),
      }));
    result[destinationId] = categories;
  }

  return isSingle ? result[destinationIds] : result;
}


DestinationRouter.post("/create", UserMiddleWare, Image_upload.single("heroImage"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can create destinations" });
    }

    const { id, name, tagline, description, heroImage } = req.body;

    if (!id || !name || !tagline || !description) {
      return res.status(400).json({ success: false, message: "id, name, tagline and description are required" });
    }

    const cleanId = id.trim().toLowerCase();

    const existingDestination = await Destination.findOne({ id: cleanId });
    if (existingDestination) {
      return res.status(409).json({ success: false, message: "Destination with this id already exists" });
    }

    let heroImageUrl = null;
    let heroImagePublicId=null;
    if (req.file) {
      const imageUpload = await uploadToCloudinary(req.file.buffer, "times-india-travels/destinations");
      heroImageUrl = imageUpload.secure_url;
      heroImagePublicId=imageUpload.public_id;
    } else if (typeof heroImage === "string" && heroImage.trim()) {
      heroImageUrl = heroImage.trim();
    }

    const newDestination = await Destination.create({
      id: cleanId,
      name,
      tagline,
      description,
      heroImage: heroImageUrl,
      heroImagePublicId,
    });

    return res.status(201).json({ success: true, message: "Destination created successfully", destination: newDestination });
  } catch (error) {
    return handleDestinationError(error, res, "create");
  }
});


DestinationRouter.put("/edit/:id", UserMiddleWare, Image_upload.single("heroImage"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can edit destinations" });
    }

    const destinationId = req.params.id.trim().toLowerCase();
    const { name, tagline, description, heroImage } = req.body;

    const existingDestination = await Destination.findOne({ id: destinationId });
    if (!existingDestination) {
      return res.status(404).json({ success: false, message: "Destination not found" });
    }

    if (name !== undefined) existingDestination.name = name;
    if (tagline !== undefined) existingDestination.tagline = tagline;
    if (description !== undefined) existingDestination.description = description;
    if (heroImage !== undefined) existingDestination.heroImage = heroImage;

    if (req.file) {
      if (existingDestination.heroImagePublicId) {
        await cleanupDocumentImages(existingDestination, ["heroImagePublicId"]); // clean up the OLD one first
      }
      const imageUpload = await uploadToCloudinary(req.file.buffer, "times-india-travels/destinations");
      existingDestination.heroImage = imageUpload.secure_url;
      existingDestination.heroImagePublicId=imageUpload.public_id;
    }

    const updatedDestination = await existingDestination.save();

    return res.status(200).json({ success: true, message: "Destination updated successfully", destination: updatedDestination });
  } catch (error) {
    return handleDestinationError(error, res, "update");
  }
});

DestinationRouter.delete("/delete/:id", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can delete destinations" });
    }

    const destinationId = req.params.id.trim().toLowerCase();

    const existingDestination = await Destination.findOne({ id: destinationId });
    if (!existingDestination) {
      return res.status(404).json({ success: false, message: "Destination not found" });
    }

    // A category is "in use" by this destination if the destination's
    // id appears anywhere in that category's `destinations` array.
    const categoryCount = await TourCategory.countDocuments({ destinations: destinationId });
    if (categoryCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete this destination because tour categories are still tagged under it",
        categoryCount,
      });
    }

    await Destination.deleteOne({ id: destinationId });
    await cleanupDocumentImages(existingDestination, ["heroImagePublicId"]);

    return res.status(200).json({
      success: true,
      message: "Destination deleted successfully",
      destination: { id: existingDestination.id, name: existingDestination.name },
    });
  } catch (error) {
    return handleDestinationError(error, res, "delete");
  }
});

DestinationRouter.get("/", async (req, res) => {
  try {
    const destinations = await Destination.find().lean();
    const categories = await TourCategory.find().lean();
    const packages = await TourPackage.find().lean();

    const destinationIds = destinations.map((d) => d.id);
    const categoriesByDestination = await attachCategoriesAndPackages(destinationIds, categories, packages);

    const destinationsWithCategories = destinations.map((destination) => ({
      ...destination,
      categories: categoriesByDestination[destination.id],
    }));

    return res.status(200).json({
      success: true,
      message: "Destinations fetched successfully",
      destinations: destinationsWithCategories,
    });
  } catch (error) {
    return handleDestinationError(error, res, "fetch");
  }
});

DestinationRouter.get("/:id", async (req, res) => {
  try {
    const destinationId = req.params.id.trim().toLowerCase();

    const destination = await Destination.findOne({ id: destinationId }).lean();
    if (!destination) {
      return res.status(404).json({ success: false, message: "Destination not found" });
    }

    const categories = await TourCategory.find({ destinations: destinationId }).lean();
    const relevantCategoryIds = categories.map((c) => c.id);

    const packages = relevantCategoryIds.length
      ? await TourPackage.find({
          $or: [{ categorySlug: { $in: relevantCategoryIds } }, { alsoUnder: { $in: relevantCategoryIds } }],
        }).lean()
      : [];

    const categoriesWithPackages = categories.map((category) => ({
      ...category,
      packages: packages.filter((p) => p.categorySlug === category.id || p.alsoUnder?.includes(category.id)),
    }));

    return res.status(200).json({
      success: true,
      message: "Destination fetched successfully",
      destination: { ...destination, categories: categoriesWithPackages },
    });
  } catch (error) {
    return handleDestinationError(error, res, "fetch");
  }
});

module.exports = DestinationRouter;