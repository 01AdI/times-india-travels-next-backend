const express = require("express");
const mongoose = require("mongoose");
const sanitizeHtml = require("sanitize-html");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const Blog = require("../models/BlogSchema");
const Image_upload = require("../middleware/Image_upload");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const { cleanupDocumentImages } = require("../utils/cloudinaryCleanup");

const BlogRoute = express.Router();

function handleBlogError(error, res, action) {
  console.error(`Error ${action}:`, error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A blog with this slug already exists.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: `Something went wrong while ${action}.`,
  });
}

function sanitizeBlogContent(content) {
  return sanitizeHtml(content, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "hr",
      "a",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function hasBlogContent(content) {
  if (typeof content !== "string") return false;

  const sanitizedContent = sanitizeBlogContent(content);

  const plainText = sanitizedContent
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  return plainText.length > 0;
}

BlogRoute.post("/admin/create",UserMiddleWare,Image_upload.single("image"),async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can create blogs.",
        });
      }

      const {
        title,
        slug,
        image,
        shortDescription,
        content,
        category,
        tags,
        author,
        status,
        featured,
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Blog title is required.",
        });
      }

      if (!slug || !slug.trim()) {
        return res.status(400).json({
          success: false,
          message: "Blog slug is required.",
        });
      }

      if (!shortDescription || !shortDescription.trim()) {
        return res.status(400).json({
          success: false,
          message: "Short description is required.",
        });
      }

      if (!hasBlogContent(content)) {
        return res.status(400).json({
          success: false,
          message: "Blog content is required.",
        });
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");

      const existingBlog = await Blog.findOne({ slug: cleanSlug });

      if (existingBlog) {
        return res.status(409).json({
          success: false,
          message: "A blog with this slug already exists.",
        });
      }

      let imageUrl = null;
      let imagePublicId = null;

      if (req.file) {
        const uploadedImage = await uploadToCloudinary(
          req.file.buffer,
          "times-india-travels/blogs"
        );

        imageUrl = uploadedImage.secure_url;
        imagePublicId = uploadedImage.public_id;
      } else if (typeof image === "string" && image.trim()) {
        imageUrl = image.trim();
      }

      let blogTags = [];

      if (tags) {
        if (Array.isArray(tags)) {
          blogTags = tags
            .map((tag) => String(tag).trim())
            .filter(Boolean);
        } else if (typeof tags === "string") {
          blogTags = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        }
      }

      const blogStatus =
        status === "published" ? "published" : "draft";

      const publishedAt =
        blogStatus === "published" ? new Date() : null;

      const isFeatured =
        blogStatus === "published" &&
        (featured === true || featured === "true");

      const cleanContent = sanitizeBlogContent(content);

      const blog = await Blog.create({
        title: title.trim(),
        slug: cleanSlug,
        image: imageUrl,
        imagePublicId,
        shortDescription: shortDescription.trim(),
        content: cleanContent,
        category:
          typeof category === "string" && category.trim()
            ? category.trim()
            : "Uncategorized",
        tags: blogTags,
        author:
          typeof author === "string" && author.trim()
            ? author.trim()
            : "Times India Travels",
        status: blogStatus,
        publishedAt,
        featured: isFeatured,
      });

      if (isFeatured) {
        await Blog.updateMany(
          { _id: { $ne: blog._id }, featured: true },
          { $set: { featured: false } }
        );
      }

      return res.status(201).json({
        success: true,
        message: "Blog created successfully.",
        data: blog,
      });
    } catch (error) {
      return handleBlogError(error, res, "creating the blog");
    }
  }
);

BlogRoute.get("/", async (req, res) => {
  try {
    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(req.query.limit, 10) || 10,
        1
      ),
      50
    );

    const skip = (page - 1) * limit;

    const totalBlogs = await Blog.countDocuments({
      status: "published",
    });

    const blogs = await Blog.find({
      status: "published",
    })
      .select(
        "title slug image shortDescription category tags author publishedAt featured"
      )
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalBlogs / limit);

    return res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        currentPage: page,
        limit,
        totalBlogs,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleBlogError(error, res, "fetching blogs");
  }
});

BlogRoute.get("/admin", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view blogs.",
      });
    }

    const { status } = req.query;

    if (
      status &&
      status !== "draft" &&
      status !== "published"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please choose either draft or published.",
      });
    }

    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(req.query.limit, 10) || 10,
        1
      ),
      50
    );

    const skip = (page - 1) * limit;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    const totalBlogs = await Blog.countDocuments(filter);

    const blogs = await Blog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalBlogs / limit);

    return res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        currentPage: page,
        limit,
        totalBlogs,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleBlogError(error, res, "fetching blogs");
  }
});

BlogRoute.get("/admin/:id", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view this blog.",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID.",
      });
    }

    const blog = await Blog.findById(id).lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find this blog.",
      });
    }

    return res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (error) {
    return handleBlogError(error, res, "fetching the blog");
  }
});

BlogRoute.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug || !slug.trim()) {
      return res.status(400).json({
        success: false,
        message: "Blog slug is required.",
      });
    }

    const blog = await Blog.findOne({
      slug: slug.trim().toLowerCase(),
      status: "published",
    }).lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (error) {
    return handleBlogError(error, res, "fetching the blog");
  }
});

BlogRoute.patch("/admin/:id",UserMiddleWare,Image_upload.single("image"),async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can update blogs.",
        });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid blog ID.",
        });
      }

      const blog = await Blog.findById(id);

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "We couldn't find this blog.",
        });
      }

      const {
        title,
        slug,
        image,
        shortDescription,
        content,
        category,
        tags,
        author,
        status,
        featured,
      } = req.body;

      if (title !== undefined) {
        if (
          typeof title !== "string" ||
          !title.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Blog title cannot be empty.",
          });
        }

        blog.title = title.trim();
      }

      if (slug !== undefined) {
        if (
          typeof slug !== "string" ||
          !slug.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Blog link cannot be empty.",
          });
        }

        const cleanSlug = slug
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-");

        const existingBlog = await Blog.findOne({
          slug: cleanSlug,
          _id: { $ne: id },
        });

        if (existingBlog) {
          return res.status(409).json({
            success: false,
            message: "Another blog is already using this link.",
          });
        }

        blog.slug = cleanSlug;
      }

      if (req.file) {
        if (blog.imagePublicId) {
          await cleanupDocumentImages(
            blog,
            ["imagePublicId"]
          );
        }

        const uploadedImage = await uploadToCloudinary(
          req.file.buffer,
          "times-india-travels/blogs"
        );

        blog.image = uploadedImage.secure_url;
        blog.imagePublicId = uploadedImage.public_id;
      } else if (
        image !== undefined &&
        typeof image === "string" &&
        image.trim()
      ) {
        blog.image = image.trim();
      }

      if (shortDescription !== undefined) {
        if (
          typeof shortDescription !== "string" ||
          !shortDescription.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Short description cannot be empty.",
          });
        }

        blog.shortDescription =
          shortDescription.trim();
      }

      if (content !== undefined) {
        if (!hasBlogContent(content)) {
          return res.status(400).json({
            success: false,
            message: "Blog content cannot be empty.",
          });
        }

        blog.content = sanitizeBlogContent(content);
      }

      if (category !== undefined) {
        blog.category =
          typeof category === "string" &&
          category.trim()
            ? category.trim()
            : "Uncategorized";
      }

      if (tags !== undefined) {
        let blogTags = [];

        if (Array.isArray(tags)) {
          blogTags = tags
            .map((tag) => String(tag).trim())
            .filter(Boolean);
        } else if (typeof tags === "string") {
          blogTags = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        }

        blog.tags = blogTags;
      }

      if (author !== undefined) {
        blog.author =
          typeof author === "string" &&
          author.trim()
            ? author.trim()
            : "Times India Travels";
      }

      if (status !== undefined) {
        if (
          status !== "draft" &&
          status !== "published"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Please choose either draft or published.",
          });
        }

        if (
          status === "published" &&
          blog.status !== "published"
        ) {
          blog.publishedAt = new Date();
        }

        if (status === "draft") {
          blog.publishedAt = null;
          blog.featured = false;
        }

        blog.status = status;
      }

      if (featured !== undefined) {
        const isFeatured =
          featured === true ||
          featured === "true";

        if (
          isFeatured &&
          blog.status !== "published"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Only published blogs can be featured.",
          });
        }

        blog.featured = isFeatured;
      }

      if (blog.status === "draft") {
        blog.featured = false;
      }

      await blog.save();

      if (blog.featured) {
        await Blog.updateMany(
          {
            _id: { $ne: blog._id },
            featured: true,
          },
          {
            $set: { featured: false },
          }
        );
      }

      return res.status(200).json({
        success: true,
        message: "Blog updated successfully.",
        data: blog,
      });
    } catch (error) {
      return handleBlogError(error, res, "updating the blog");
    }
  }
);

BlogRoute.delete("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can delete blogs.",
        });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid blog ID.",
        });
      }

      const blog = await Blog.findByIdAndDelete(id);

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "We couldn't find this blog.",
        });
      }

      await cleanupDocumentImages(
        blog,
        ["imagePublicId"]
      );

      return res.status(200).json({
        success: true,
        message: "Blog deleted successfully.",
        data: {
          id: blog._id,
          title: blog.title,
        },
      });
    } catch (error) {
      return handleBlogError(error, res, "deleting the blog");
    }
  }
);

module.exports = BlogRoute;