const express = require("express");

const TourPackage = require("../models/TourPackage");
const TourCategory = require("../models/TourCategory");
const Blog = require("../models/BlogSchema");
const Destination = require("../models/DestinationSchema");

const router = express.Router();

const SITE_URL = "https://www.timesindiatravels.com";


function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createUrlEntry(url, lastmod = null) {
  return `
  <url>
    <loc>${escapeXml(url)}</loc>
    ${
      lastmod
        ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>`
        : ""
    }
  </url>`;
}

router.get("/sitemap.xml", async (req, res) => {
  try {
    const urls = new Map();

    const addUrl = (url, lastmod = null) => {
      if (!url) return;

      // If URL already exists, keep the newer lastmod
      if (urls.has(url)) {
        const existing = urls.get(url);

        if (lastmod &&(!existing.lastmod ||new Date(lastmod) > new Date(existing.lastmod))) {
          existing.lastmod = lastmod;
        }

        return;
      }

      urls.set(url, {
        url,
        lastmod,
      });
    };

    const staticPages = [
      "/",
      "/About_Us",
      "/Tour",
      "/destinations-all",
      "/CarRental",
      "/Blog",
      "/Contact-Us",
      "/Testimonials",
      "/Disclaimer",
      "/terms-and-condition",
      "/Privacy-Policy",
      "/Refund-Policy",
    ];

    staticPages.forEach((page) => {
      addUrl(`${SITE_URL}${page}`);
    });

    const categories = await TourCategory.find(
      {},
      {
        id: 1,
        updatedAt: 1,
      }
    ).lean();

    categories.forEach((category) => {
      if (!category.id) return;

      const url = `${SITE_URL}/Tour/${encodeURIComponent(category.id)}`;
      addUrl(url, category.updatedAt);
    });

    const packages = await TourPackage.find(
      {},
      {
        id: 1,
        categorySlug: 1,
        updatedAt: 1,
      }
    ).lean();

    packages.forEach((tour) => {
      if (!tour.id || !tour.categorySlug) return;

      const url = `${SITE_URL}/Tour/${encodeURIComponent(tour.categorySlug)}/${encodeURIComponent(tour.id)}`;
      addUrl(url, tour.updatedAt);
    });

    const destinations = await Destination.find(
      {},
      {
        id: 1,
        updatedAt: 1,
      }
    ).lean();

    destinations.forEach((destination) => {
      if (!destination.id) return;

      const url = `${SITE_URL}/destinations/${encodeURIComponent(destination.id)}`;
      addUrl(url, destination.updatedAt);
    });

    const blogs = await Blog.find(
      {
        status: "published",
      },
      {
        slug: 1,
        updatedAt: 1,
        publishedAt: 1,
      }
    ).lean();

    blogs.forEach((blog) => {
      if (!blog.slug) return;

      const url = `${SITE_URL}/blog/${encodeURIComponent(
        blog.slug
      )}`;

      addUrl(url,blog.updatedAt || blog.publishedAt);
    });

    const urlEntries = Array.from(urls.values()).map(
      ({ url, lastmod }) =>
        createUrlEntry(url, lastmod)
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urlEntries.join("\n")}
    </urlset>`;

    res
      .status(200)
      .type("application/xml")
      .send(xml);

  } catch (error) {
    console.error(
      "Sitemap generation error:",
      error
    );

    res.status(500).send(
      "Unable to generate sitemap."
    );
  }
});


module.exports = router;