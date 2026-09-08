const express = require("express");

const TourCategory = require("../models/TourCategory");
const TourPackage = require("../models/TourPackage");
const Destination = require("../models/DestinationSchema");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const Image_upload = require("../middleware/Image_upload");

const {
  cleanupDocumentImages,
  cleanupGalleryImages,
} = require("../utils/cloudinaryCleanup");

const TourCategoryRouter = express.Router();

const JSON_FIELDS = [
  "destinations",
  "galleryCaptions",
  "galleryImageUrls",
  "removeGalleryImageIds",
  "showInNavbar",
  "showInExplore",
];

function handleCategoryError(error, res, action) {
  console.error(`Error ${action} tour category:`, error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A tour category with this id already exists",
    });
  }

  return res.status(500).json({
    success: false,
    message: `Failed to ${action} tour category`,
  });
}

function parseBoolean(value) {
  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return undefined;
}

function parseJsonFields(body) {
  const parsed = { ...body };

  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch {
        const error = new Error(
          `"${field}" must be valid JSON`
        );

        error.name = "ValidationError";

        throw error;
      }
    }
  }

  return parsed;
}

function normalizeDestinationIds(destinationIds) {
  if (!Array.isArray(destinationIds)) {
    return [];
  }

  return destinationIds
    .map((id) =>
      typeof id === "string"
        ? id.trim().toLowerCase()
        : id
    )
    .filter(Boolean);
}

async function validateDestinations(destinationIds) {
  if (!destinationIds || destinationIds.length === 0) {
    return null;
  }

  const seen = new Set();
  const duplicates = new Set();

  for (const id of destinationIds) {
    if (seen.has(id)) {
      duplicates.add(id);
    }

    seen.add(id);
  }

  if (duplicates.size > 0) {
    const error = new Error(
      `Duplicate destination(s): ${[
        ...duplicates,
      ].join(", ")}`
    );

    error.name = "ValidationError";

    throw error;
  }

  const found = await Destination.find({
    id: { $in: destinationIds },
  })
    .select("id")
    .lean();

  const foundIds = new Set(
    found.map((destination) => destination.id)
  );

  const missing = destinationIds.filter(
    (id) => !foundIds.has(id)
  );

  return missing.length > 0 ? missing : null;
}

function isValidImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value.trim());

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}


function normalizeGalleryUrls(galleryImageUrls) {
  if (!Array.isArray(galleryImageUrls)) {
    return [];
  }

  return galleryImageUrls
    .map((item) => {

      if (typeof item === "string") {
        const url = item.trim();

        if (!url) {
          return null;
        }

        return {
          url,
          caption: "",
        };
      }

      if (
        item &&
        typeof item === "object" &&
        typeof item.url === "string"
      ) {
        const url = item.url.trim();

        if (!url) {
          return null;
        }

        return {
          url,
          caption:
            typeof item.caption === "string"
              ? item.caption.trim()
              : "",
        };
      }

      return null;
    })
    .filter(Boolean);
}

function validateGalleryUrls(galleryEntries) {
  const invalidUrls = galleryEntries.filter(
    (item) => !isValidImageUrl(item.url)
  );

  if (invalidUrls.length > 0) {
    const error = new Error(
      "Every gallery image URL must be a valid HTTP or HTTPS URL"
    );

    error.name = "ValidationError";

    throw error;
  }
}


function createGalleryUrlEntries(galleryImageUrls) {
  const normalized =
    normalizeGalleryUrls(galleryImageUrls);

  validateGalleryUrls(normalized);

  return normalized.map((item) => ({
    url: item.url,
    caption: item.caption,
    publicId: null,
  }));
}

async function uploadGalleryImages(files,captions = []) {
  const entries = [];

  const safeCaptions = Array.isArray(captions)
    ? captions
    : [];

  for (let i = 0; i < files.length; i++) {
    const upload = await uploadToCloudinary(
      files[i].buffer,
      "times-india-travels/tour-categories/gallery"
    );

    entries.push({
      url: upload.secure_url,

      caption:
        typeof safeCaptions[i] === "string"
          ? safeCaptions[i].trim()
          : "",

      publicId: upload.public_id,
    });
  }

  return entries;
}

TourCategoryRouter.post("/create",UserMiddleWare,Image_upload.fields([
    {
      name: "heroImage",
      maxCount: 1,
    },
    {
      name: "galleryImages",
      maxCount: 15,
    },
  ]),
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can create tour categories",
        });
      }

      const body = parseJsonFields(req.body);

      const {
        id,
        name,
        tagline,
        description,
        heroImage,
        destinations,
        galleryCaptions,
        galleryImageUrls,
        showInNavbar,
        showInExplore,
      } = body;


      if (!id || !name || !tagline || !description) {
        return res.status(400).json({
          success: false,
          message:
            "id, name, tagline and description are required",
        });
      }

      const cleanId = id.trim().toLowerCase();

      const normalizedDestinations =normalizeDestinationIds(destinations);

      const existingCategory =await TourCategory.findOne({
          id: cleanId,
        });

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message:"Tour category with this id already exists",
        });
      }

      if (normalizedDestinations.length > 0) {
        const missing =await validateDestinations(
            normalizedDestinations
          );

        if (missing) {
          return res.status(404).json({
            success: false,
            message: `These destinations don't exist: ${missing.join(
              ", "
            )}`,
          });
        }
      }

      const uploadedGalleryCount =
        req.files?.galleryImages?.length || 0;

      const urlGalleryEntries =
        createGalleryUrlEntries(
          galleryImageUrls
        );

      const totalGalleryCount =uploadedGalleryCount +urlGalleryEntries.length;

      if (totalGalleryCount > 15) {
        return res.status(400).json({
          success: false,
          message:
            "A maximum of 15 gallery images is allowed",
        });
      }

      let heroImageUrl = null;
      let heroImagePublicId = null;

      if (req.files?.heroImage?.[0]) {
        const imageUpload =
          await uploadToCloudinary(
            req.files.heroImage[0].buffer,
            "times-india-travels/tour-categories"
          );

        heroImageUrl =imageUpload.secure_url;

        heroImagePublicId =imageUpload.public_id;
      }

      else if (
        typeof heroImage === "string" &&
        heroImage.trim()
      ) {
        if (!isValidImageUrl(heroImage)) {
          return res.status(400).json({
            success: false,
            message:
              "Hero image must be a valid HTTP or HTTPS URL",
          });
        }

        heroImageUrl =heroImage.trim();
      }

      const uploadedGalleryEntries =req.files?.galleryImages?.length? await uploadGalleryImages(
              req.files.galleryImages,
              galleryCaptions
            )
          : [];

      const galleryEntries = [
        ...uploadedGalleryEntries,
        ...urlGalleryEntries,
      ];

      const navbarValue =parseBoolean(showInNavbar);

      const exploreValue =parseBoolean(showInExplore);

      const newCategory =await TourCategory.create({
          id: cleanId,
          name: name.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          heroImage: heroImageUrl,
          heroImagePublicId,
          destinations:normalizedDestinations,
          destinations_gallery:galleryEntries,
          showInNavbar:navbarValue !== undefined? navbarValue: true,
          showInExplore:exploreValue !== undefined? exploreValue: true,
        });

      return res.status(201).json({
        success: true,

        message:
          "Tour category created successfully",

        category: newCategory,
      });
    } catch (error) {
      return handleCategoryError(
        error,
        res,
        "create"
      );
    }
  }
);

TourCategoryRouter.put("/edit/:id",UserMiddleWare,Image_upload.fields([
    {
      name: "heroImage",
      maxCount: 1,
    },
    {
      name: "galleryImages",
      maxCount: 15,
    },
  ]),
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can edit tour categories",
        });
      }

      const categoryId = req.params.id.trim().toLowerCase();

      const body = parseJsonFields(req.body);

      const {
        name,
        tagline,
        description,
        heroImage,
        destinations,
        galleryCaptions,
        galleryImageUrls,
        removeGalleryImageIds,
        showInNavbar,
        showInExplore,
      } = body;

      const existingCategory =await TourCategory.findOne({
          id: categoryId,
        });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message:
            "Tour category not found",
        });
      }

      if (name !== undefined) {
        if (
          typeof name !== "string" ||
          !name.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Category name cannot be empty",
          });
        }

        existingCategory.name =name.trim();
      }

      if (tagline !== undefined) {
        if (
          typeof tagline !== "string" ||
          !tagline.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Category tagline cannot be empty",
          });
        }

        existingCategory.tagline =tagline.trim();
      }

      if (description !== undefined) {
        if (
          typeof description !== "string" ||
          !description.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Category description cannot be empty",
          });
        }

        existingCategory.description =
          description.trim();
      }

      const navbarValue =parseBoolean(showInNavbar);

      if (navbarValue !== undefined) {
        existingCategory.showInNavbar =navbarValue;
      }

      const exploreValue =parseBoolean(showInExplore);

      if (exploreValue !== undefined) {
        existingCategory.showInExplore =exploreValue;
      }

      if (destinations !== undefined) {
        if (!Array.isArray(destinations)) {
          return res.status(400).json({
            success: false,
            message:
              "Destinations must be an array",
          });
        }

        const normalizedDestinations =normalizeDestinationIds(destinations);

        const missing =await validateDestinations(
            normalizedDestinations
          );

        if (missing) {
          return res.status(404).json({
            success: false,
            message: `These destinations don't exist: ${missing.join(
              ", "
            )}`,
          });
        }

        existingCategory.destinations =
          normalizedDestinations;
      }

      // Gallery validation FIRST (cheap — no uploads happen here)
      const galleryToRemove = Array.isArray(removeGalleryImageIds) ? removeGalleryImageIds.map(String) : [];
      const galleryRemovalEntries = existingCategory.destinations_gallery.filter((img) => galleryToRemove.includes(String(img._id)));
      const remainingGallery = existingCategory.destinations_gallery.filter((img) => !galleryToRemove.includes(String(img._id)));
      const newUploadedGalleryCount = req.files?.galleryImages?.length || 0;
      const newUrlGalleryEntries = createGalleryUrlEntries(galleryImageUrls); // validates URLs, throws early if bad
      const newGalleryCount = newUploadedGalleryCount + newUrlGalleryEntries.length;

      if (remainingGallery.length + newGalleryCount > 15) {
        return res.status(400).json({ success: false, message: "A maximum of 15 gallery images is allowed" });
      }

      let oldHeroPublicId = null;

      if (req.files?.heroImage?.[0]) {
        const oldPublicId =existingCategory.heroImagePublicId;
        const imageUpload =await uploadToCloudinary(
            req.files.heroImage[0].buffer,
            "times-india-travels/tour-categories"
          );
        existingCategory.heroImage =imageUpload.secure_url;
        existingCategory.heroImagePublicId =imageUpload.public_id;
        oldHeroPublicId =oldPublicId;
      }


      else if (heroImage !== undefined) {
        if (
          typeof heroImage !== "string"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Hero image must be a valid URL",
          });
        }

        const newHeroUrl =heroImage.trim();

        if (newHeroUrl &&!isValidImageUrl(newHeroUrl)) {
          return res.status(400).json({
            success: false,
            message:
              "Hero image must be a valid HTTP or HTTPS URL",
          });
        }

        if (newHeroUrl !==(existingCategory.heroImage || "")) {
          oldHeroPublicId =existingCategory.heroImagePublicId;

          existingCategory.heroImage =newHeroUrl || null;

          existingCategory.heroImagePublicId =null;
        }
      }

      const galleryToCleanup = galleryRemovalEntries.filter((img) => typeof img.publicId === "string" && img.publicId.trim());
      existingCategory.destinations_gallery = remainingGallery;

      let newUploadedGalleryEntries = [];
      if (req.files?.galleryImages?.length) {
        newUploadedGalleryEntries = await uploadGalleryImages(req.files.galleryImages, galleryCaptions);
      }

      existingCategory.destinations_gallery.push(
        ...newUploadedGalleryEntries,
        ...newUrlGalleryEntries
      );

      const updatedCategory =await existingCategory.save();

      if (galleryToCleanup.length > 0) {
        await cleanupGalleryImages(
          galleryToCleanup
        );
      }

      if (oldHeroPublicId) {
        const cleanupDocument = {
          heroImagePublicId:
            oldHeroPublicId,
        };

        await cleanupDocumentImages(
          cleanupDocument,
          ["heroImagePublicId"]
        );
      }

      return res.status(200).json({
        success: true,

        message:
          "Tour category updated successfully",

        category: updatedCategory,
      });
    } catch (error) {
      return handleCategoryError(
        error,
        res,
        "update"
      );
    }
  }
);


TourCategoryRouter.patch("/:id/gallery/:imageId",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can edit gallery captions",
        });
      }

      const categoryId = req.params.id.trim().toLowerCase();

      const { imageId } = req.params;

      const { caption } = req.body;

      if (typeof caption !== "string") {
        return res.status(400).json({
          success: false,
          message:
            "Caption must be a string",
        });
      }

      const category =await TourCategory.findOne({
          id: categoryId,
        });

      if (!category) {
        return res.status(404).json({
          success: false,
          message:
            "Tour category not found",
        });
      }

      const image =category.destinations_gallery.id(
          imageId
        );

      if (!image) {
        return res.status(404).json({
          success: false,
          message:
            "Gallery image not found",
        });
      }

      image.caption =caption.trim();

      await category.save();

      return res.status(200).json({
        success: true,

        message:
          "Caption updated successfully",

        image,
      });
    } catch (error) {
      return handleCategoryError(
        error,
        res,
        "update gallery caption"
      );
    }
  }
);

TourCategoryRouter.delete("/delete/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can delete tour categories",
        });
      }

      const categoryId = req.params.id.trim().toLowerCase();

      const existingCategory =await TourCategory.findOne({
          id: categoryId,
        });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message:
            "Tour category not found",
        });
      }

      const packageCount =await TourPackage.countDocuments({
          $or: [
            {
              categorySlug: categoryId,
            },
            {
              alsoUnder: categoryId,
            },
          ],
        });

      if (packageCount > 0) {
        return res.status(409).json({
          success: false,

          message:
            "Cannot delete this category because tour packages are still associated with it",

          packageCount,
        });
      }

      await TourCategory.deleteOne({
        id: categoryId,
      });

      if (
        existingCategory.heroImagePublicId
      ) {
        await cleanupDocumentImages(
          existingCategory,
          ["heroImagePublicId"]
        );
      }

      const cloudinaryGalleryImages =existingCategory.destinations_gallery.filter(
          (img) =>
            typeof img.publicId === "string" &&
            img.publicId.trim()
        );

      if (cloudinaryGalleryImages.length > 0) {
        await cleanupGalleryImages(
          cloudinaryGalleryImages
        );
      }

      return res.status(200).json({
        success: true,

        message:
          "Tour category deleted successfully",

        category: {
          id: existingCategory.id,

          name: existingCategory.name,
        },
      });
    } catch (error) {
      return handleCategoryError(
        error,
        res,
        "delete"
      );
    }
  }
);

TourCategoryRouter.get("/",async (req, res) => {
    try {
      const categories =await TourCategory.find().lean();

      const packages =await TourPackage.find().lean();

      const categoriesWithPackages =
        categories.map((category) => ({
          ...category,

          packages: packages.filter(
            (p) =>
              p.categorySlug ===
                category.id ||
              p.alsoUnder?.includes(
                category.id
              )
          ),
        }));

      return res.status(200).json({
        success: true,
        message:"Tour categories fetched successfully",
        categories:categoriesWithPackages,
      });
    } catch (error) {
      return handleCategoryError(
        error,
        res,
        "fetch"
      );
    }
  }
);

TourCategoryRouter.get("/:id",async (req, res) => {
    try {
      const { id } = req.params;

      const category =
        await TourCategory.findOne({
          id: id.trim().toLowerCase(),
        }).lean();

      if (!category) {
        return res.status(404).json({
          success: false,
          message:
            "Tour category not found",
        });
      }

      const packages =
        await TourPackage.find({
          $or: [
            {
              categorySlug:
                category.id,
            },
            {
              alsoUnder:
                category.id,
            },
          ],
        }).lean();

      return res.status(200).json({
        success: true,

        message:
          "Tour category fetched successfully",

        category: {
          ...category,

          packages,
        },
      });
    } catch (error) {
      return handleCategoryError(
        error,
        res,
        "fetch"
      );
    }
  }
);

module.exports = TourCategoryRouter;