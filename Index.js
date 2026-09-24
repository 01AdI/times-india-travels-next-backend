require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const DBConnect = require("./config/DB_Connect");
const adminRoutes = require("./routes/adminRoutes");
const TourPackageRouter = require("./routes/TourPackageRouter");
const TourCategoryRouter = require("./routes/TourCategoryRouter");
const TourEnquiryRouter = require("./routes/tourEnquiryRoutes");
const TestimonialRoute = require("./routes/TestimonialRoute");
const BlogRoute = require("./routes/BlogRoutes");
const HomeHeroRoute = require("./routes/HomeHeroRoute");
const ClientReviewVideoRoute = require("./routes/ClientReviewVideoRoute");
const ClientGalleryRoute = require("./routes/ClientGalleryRoute");
const CarRentalRoute = require("./routes/CarRentalRoutes");
const DestinationRouter = require("./routes/DestinationRouter");
const PayNowEnquiryRouter = require("./routes/PayNowEnquiryRouter");

const app = express();
const PORT = process.env.PORT || 4000;

// Only these origins may call the API. Comma-separated in .env, e.g.
// ALLOWED_ORIGINS=https://timesindiatravels.com,http://localhost:3000
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // allow same-origin/non-browser requests (no Origin header) and
      // anything explicitly on the allowlist
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", 1);
// Public-facing enquiry/contact endpoints send email and write to the DB on
// every hit, so they're the most attractive target for spam/abuse. Keep
// this limit generous enough for real users, tight enough to blunt bots.
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

app.use("/admin", adminRoutes);
app.use("/tour-package", TourPackageRouter);
app.use("/tour-category", TourCategoryRouter);
app.use("/tour-enquiry", publicFormLimiter, TourEnquiryRouter);
app.use("/car-rental-enquiry", publicFormLimiter, CarRentalRoute);
app.use("/pay-now", publicFormLimiter, PayNowEnquiryRouter);
app.use("/testimonials", TestimonialRoute);
app.use("/blog", BlogRoute);
app.use("/home-hero", HomeHeroRoute);
app.use("/client-review", ClientReviewVideoRoute);
app.use("/client-gallery", ClientGalleryRoute);
app.use("/destination", DestinationRouter);

// The Next.js frontend owns page rendering, routing, robots.txt and sitemap.xml.
// Express is API-only in the migrated architecture.

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

// Centralized error handler — must be defined last, after all routes.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error(err); // full stack trace, not just err.message as a string

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? "Something went wrong." : err.message,
  });
});

async function startServer() {
  await DBConnect(); // exits the process on failure — nothing to catch here
  console.log("Connected to DB");

  const server = app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});