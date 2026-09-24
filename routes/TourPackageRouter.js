const express = require("express");
const TourPackage = require("../models/TourPackage");
const TourCategory = require("../models/TourCategory");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const Image_upload = require("../middleware/Image_upload");
const {cleanupDocumentImages}=require("../utils/cloudinaryCleanup");

const TourPackageRouter = express.Router();

const JSON_FIELDS = ["duration", "route", "highlights", "itinerary", "inclusions", "exclusions","alsoUnder"];

function parseJsonFields(body) {
  const parsed = { ...body };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch {
        const err = new Error(`"${field}" must be valid JSON`);
        err.name = "ValidationError";
        throw err;
      }
    }
  }
  return parsed;
}

function handlePackageError(error, res, action) {
  console.error(`Error ${action} tour package:`, error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "A tour package with this id already exists" });
  }
  return res.status(500).json({ success: false, message: `Failed to ${action} tour package` });
}

function parseBooleanField(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  const error = new Error(
    `"${fieldName}" must be either true or false`
  );

  error.name = "ValidationError";

  throw error;
}

async function validateAlsoUnder(categoryIds, primaryCategorySlug) {
 if (categoryIds === undefined || categoryIds === null) {
    return null; // wasn't provided at all — caller should leave the existing value untouched
  }
  if (!Array.isArray(categoryIds)) {
    const error = new Error('"alsoUnder" must be an array');
    error.name = "ValidationError";
    throw error;
  }

  if (categoryIds.length === 0) {
    return []; // explicitly cleared — a real, intentional empty array
  }


  // Normalize IDs
  const cleanIds = categoryIds.map((id) => {
    if (typeof id !== "string") {
      const error = new Error(
        '"alsoUnder" must contain only category IDs'
      );
      error.name = "ValidationError";
      throw error;
    }

    return id.trim().toLowerCase();
  });

  // Remove duplicate category IDs
  const uniqueIds = [...new Set(cleanIds)];

  // Primary category cannot also appear in alsoUnder
  if (uniqueIds.includes(primaryCategorySlug)) {
    const error = new Error(
      "The primary category cannot also be included in alsoUnder"
    );
    error.name = "ValidationError";
    throw error;
  }
  // Check that every category exists
  const categories = await TourCategory.find({
    id: { $in: uniqueIds },
  }).lean();

  const foundIds = categories.map((category) => category.id);

  const missingIds = uniqueIds.filter(
    (id) => !foundIds.includes(id)
  );

  if (missingIds.length > 0) {
    const error = new Error(
      `These categories don't exist: ${missingIds.join(", ")}`
    );
    error.name = "ValidationError";
    throw error;
  }

  return uniqueIds;
}

TourPackageRouter.post("/create", UserMiddleWare, Image_upload.fields([
  { name: "thumbnail", maxCount: 1 }, { name: "heroImage", maxCount: 1 },
]), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can create tour packages" });
    }

    const body = parseJsonFields(req.body);
    const {
      id, categorySlug, name, duration, route,
      price, highlights, itinerary, inclusions, exclusions,mostLoved,specialPackage,sourceUrl,alsoUnder
    } = body;

    if (!id || !categorySlug || !name || !duration) {
      return res.status(400).json({ success: false, message: "id, categorySlug, name and duration are required" });
    }
    const cleanId = id.trim().toLowerCase();
    const cleanCategorySlug = categorySlug.trim().toLowerCase();
    
    const existingPackage = await TourPackage.findOne({ id:cleanId });
    if (existingPackage) {
      return res.status(409).json({ success: false, message: "Tour package with this id already exists" });
    }

    const category = await TourCategory.findOne({ id: cleanCategorySlug });
    if (!category) {
      return res.status(404).json({ success: false, message: "Tour category not found" });
    }

    const cleanAlsoUnder=await validateAlsoUnder(alsoUnder,cleanCategorySlug)

    let thumbnailUrl = null;
    let thumbnailPublicId=null;
    let heroImageUrl = null;
    let heroImagePublicId=null;

    if (req.files?.thumbnail?.[0]) {
      const thumbnailUpload = await uploadToCloudinary(req.files.thumbnail[0].buffer, "times-india-travels/tour-packages");
      thumbnailUrl = thumbnailUpload.secure_url;
      thumbnailPublicId = thumbnailUpload.public_id;
    }

    if (req.files?.heroImage?.[0]) {
      const heroImageUpload = await uploadToCloudinary(req.files.heroImage[0].buffer, "times-india-travels/tour-packages");
      heroImageUrl = heroImageUpload.secure_url;
      heroImagePublicId=heroImageUpload.public_id;
    }

     const newPackage = await TourPackage.create({
        id: cleanId,
        categorySlug: cleanCategorySlug,
        name,
        duration,
        route: route || [],
        thumbnail: thumbnailUrl,
        thumbnailPublicId,
        heroImage: heroImageUrl,
        heroImagePublicId,
        price: price || null,
        highlights: highlights || [],
        itinerary: itinerary || [],
        inclusions: inclusions || [],
        exclusions: exclusions || [],
        mostLoved: parseBooleanField(mostLoved, "mostLoved") ?? false,
        specialPackage: parseBooleanField(specialPackage,"specialPackage") ?? false,
        sourceUrl: sourceUrl || null,
        alsoUnder: cleanAlsoUnder || [],
      });

    return res.status(201).json({ success: true, message: "Tour package created successfully", package: newPackage });
  } catch (error) {
    return handlePackageError(error, res, "create");
  }
});

TourPackageRouter.put("/edit/:id", UserMiddleWare, Image_upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "heroImage", maxCount: 1 },
]), async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Only admins can edit tour packages" });
      }

      const { id } = req.params;
      const body = parseJsonFields(req.body);
      const cleanId = id.trim().toLowerCase();
      const tourPackage = await TourPackage.findOne({ id:cleanId });
      if (!tourPackage) {
        return res.status(404).json({ success: false, message: "Tour package not found" });
      }

      if (body.categorySlug) {
        const cleanNewCategorySlug = body.categorySlug.trim().toLowerCase();
        const category = await TourCategory.findOne({ id: cleanNewCategorySlug });
        if (!category) {
          return res.status(404).json({ success: false, message: "New tour category not found" });
        }
        body.categorySlug = cleanNewCategorySlug; // so allowedFields assigns the normalized value too
      }

      const finalCategorySlug = body.categorySlug !== undefined ? body.categorySlug : tourPackage.categorySlug;

      if (body.alsoUnder !== undefined){ 
        body.alsoUnder = await validateAlsoUnder( body.alsoUnder, finalCategorySlug ); 
      }
 
      if (body.mostLoved !== undefined) {
        body.mostLoved = parseBooleanField(
          body.mostLoved,
          "mostLoved"
        );
      }

      if (body.specialPackage !== undefined) {
        body.specialPackage = parseBooleanField(
          body.specialPackage,
          "specialPackage"
        );
      }

      const allowedFields = ["categorySlug", "name", "duration", "route", "price", "highlights", "itinerary", "inclusions", "exclusions", "mostLoved",
                            "specialPackage", "sourceUrl","alsoUnder"];
      
      allowedFields.forEach((field) => {
        if (body[field] !== undefined) {
          tourPackage[field] = body[field];
        }
      });

      if (req.files?.thumbnail?.[0]) {
        if (tourPackage.thumbnailPublicId) {
          await cleanupDocumentImages(tourPackage, ["thumbnailPublicId"]); // clean up the OLD one first
        }    
        const thumbnailUpload = await uploadToCloudinary(req.files.thumbnail[0].buffer, "times-india-travels/tour-packages");
        tourPackage.thumbnail = thumbnailUpload.secure_url;
        tourPackage.thumbnailPublicId = thumbnailUpload.public_id;
      }

      if (req.files?.heroImage?.[0]) {
        if (tourPackage.heroImagePublicId) {
          await cleanupDocumentImages(tourPackage, ["heroImagePublicId"]); // clean up the OLD one first
        }  
        const heroImageUpload = await uploadToCloudinary(req.files.heroImage[0].buffer, "times-india-travels/tour-packages");
        tourPackage.heroImage = heroImageUpload.secure_url;
        tourPackage.heroImagePublicId=heroImageUpload.public_id;
      }

      await tourPackage.save();

      return res.status(200).json({ success: true, message: "Tour package updated successfully", package: tourPackage });
    } catch (error) {
      return handlePackageError(error, res, "edit");
    }
});

TourPackageRouter.delete("/delete/:id", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can delete tour packages" });
    }

    const packageId = req.params.id.trim().toLowerCase()
    const deletedPackage = await TourPackage.findOneAndDelete({ id: packageId });

    if (!deletedPackage) {
      return res.status(404).json({ success: false, message: "Tour package not found" });
    }

    await cleanupDocumentImages(deletedPackage, ["thumbnailPublicId", "heroImagePublicId"]);

    return res.status(200).json({
      success: true,
      message: "Tour package deleted successfully",
      package: { id: deletedPackage.id, name: deletedPackage.name, categorySlug: deletedPackage.categorySlug },
    });
  } catch (error) {
    return handlePackageError(error, res, "delete");
  }
});

TourPackageRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(req.query.limit, 10) || 20,
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.mostLoved !== undefined) {
      filter.mostLoved = req.query.mostLoved === "true";
    }

    if (req.query.specialPackage !== undefined) {
      filter.specialPackage =
        req.query.specialPackage === "true";
    }

    if (req.query.categorySlug) {
      const categorySlug = req.query.categorySlug
        .trim()
        .toLowerCase();

      filter.$or = [
        { categorySlug },
        { alsoUnder: categorySlug },
      ];
    }

    if (req.query.search?.trim()) {
      const search = req.query.search.trim();

      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(
        escapedSearch,
        "i"
      );

      const searchConditions = [
        { name: { $regex: searchRegex } },
        { id: { $regex: searchRegex } },
        { categorySlug: { $regex: searchRegex } },
        { alsoUnder: { $elemMatch: { $regex: searchRegex } } },
        { route: { $elemMatch: { $regex: searchRegex } } },
      ];

      if (filter.$or) {
        filter.$and = [
          {
            $or: filter.$or,
          },
          {
            $or: searchConditions,
          },
        ];

        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const [totalPackages, tourPackages] =
      await Promise.all([
        TourPackage.countDocuments(filter),

        TourPackage.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

    const totalPages = Math.ceil(
      totalPackages / limit
    );

    return res.status(200).json({
      success: true,
      message: "Tour packages fetched successfully",
      packages: tourPackages,
      pagination: {
        currentPage: page,
        limit,
        totalPackages,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handlePackageError(
      error,
      res,
      "fetch"
    );
  }
});

TourPackageRouter.get("/dropdown", async (req, res) => {
  try {
    const packages = await TourPackage.find({})
      .select("_id id name categorySlug")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Tour package options fetched successfully",
      packages,
    });
  } catch (error) {
    return handlePackageError(error, res, "fetch");
  }
});

TourPackageRouter.get("/:id", async (req, res) => {
  try {
    const id = req.params.id.trim().toLowerCase();
    const tourPackage = await TourPackage.findOne({ id: id.toLowerCase() }).lean();

    if (!tourPackage) {
      return res.status(404).json({ success: false, message: "Tour package not found" });
    }

    return res.status(200).json({ success: true, message: "Tour package fetched successfully", package: tourPackage });
  } catch (error) {
    return handlePackageError(error, res, "fetch");
  }
});

module.exports = TourPackageRouter;

