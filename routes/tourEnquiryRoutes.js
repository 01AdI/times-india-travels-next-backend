const express = require("express");
const mongoose = require("mongoose");
const UserMiddleWare = require("../middleware/UserMiddleWare");
const TourEnquiry = require("../models/TourEnquiry");
const TourPackage = require("../models/TourPackage");
const { getLeadLocation } = require("../utils/leadLocation");
const { detectRisk } = require("../utils/riskDetection");
const { codeToName } = require("../utils/countryNames");
const sendAdminEnquiryEmail = require("../utils/sendEmail");

const TourEnquiryRouter = express.Router();


function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleEnquiryError(error, res, action) {
  console.error(`Error ${action}:`, error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.name === "CastError") {
    const message =error.path === "_id"? "Invalid enquiry ID": `Invalid value for "${error.path}"`;
    return res.status(400).json({ success: false, message });
  }
  return res.status(500).json({ success: false, message: `Failed to ${action}` });
}

function withFullCountryNames(enquiry) {
  if (!enquiry) return enquiry;
  return {
    ...enquiry,
    nationality: codeToName(enquiry.nationality),
    leadMetadata: enquiry.leadMetadata
      ? {
          ...enquiry.leadMetadata,
          ipCountry: codeToName(enquiry.leadMetadata.ipCountry),
          phoneCountry: codeToName(enquiry.leadMetadata.phoneCountry),
        }
      : enquiry.leadMetadata,
  };
}


TourEnquiryRouter.post("/create", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      nationality, // ISO code from CountrySelect, e.g. "IN"
      tourPackageId,
      travelDate,
      duration,
      adults,
      children,
      hotelType,
      reference,
      details,
    } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: "Name, email and phone are required" });
    }
    if (!tourPackageId) {
      return res.status(400).json({ success: false, message: "Tour package ID is required" });
    }

    const tourPackageData = await TourPackage.findOne({ id: tourPackageId.toLowerCase() }).lean();
    if (!tourPackageData) {
      return res.status(404).json({ success: false, message: "Tour package not found" });
    }

    const leadLocation = await getLeadLocation(req, phone);

    const riskResult = detectRisk({
      nationality,
      ipCountryCode: leadLocation.ipCountryCode,
      phoneCountryCode: leadLocation.phoneCountryCode,
    });

    const leadMetadata = {
      ipAddress: leadLocation.ipAddress,
      ipCountry: leadLocation.ipCountryCode, // stored as code
      ipRegion: leadLocation.ipRegion,
      ipCity: leadLocation.ipCity,
      phoneCountry: leadLocation.phoneCountryCode, // stored as code
      userAgent: req.headers["user-agent"] || null,
      source: "website",
      sourcePage: req.headers.referer || null,
      riskLevel: riskResult.riskLevel,
      riskReasons: riskResult.riskReasons,
    };

    const newEnquiry = await TourEnquiry.create({
      name,
      email,
      phone,
      nationality: nationality || null, // stored as code
      tourPackageId: tourPackageData.id,
      tourPackageName: tourPackageData.name,
      travelDate: travelDate || null,
      duration: duration || null,
      adults: adults || "1",
      children: children || "0",
      hotelType: hotelType || null,
      reference: reference || null,
      details: details || null,
      status: "new",
      leadMetadata,
    });
    res.status(201).json({
      success: true,
      message: "Tour enquiry submitted successfully",
      enquiry: {
        id: newEnquiry._id,
        name: newEnquiry.name,
        email: newEnquiry.email,
        tourPackageId: newEnquiry.tourPackageId,
        tourPackageName: newEnquiry.tourPackageName,
        status: newEnquiry.status,
        riskLevel: newEnquiry.leadMetadata.riskLevel,
      },
    });

    try {
      await sendAdminEnquiryEmail(newEnquiry);
      newEnquiry.adminNotification.sent = true;
      newEnquiry.adminNotification.sentAt = new Date();
      await newEnquiry.save();
    } catch (emailError) {
      console.error("Failed to send admin enquiry email:", emailError);
    }
  } catch (error) {
    return handleEnquiryError(error, res, "submit tour enquiry");
  }
});

TourEnquiryRouter.get("/admin", UserMiddleWare, async (req, res) => {
  try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can access all enquiry",
        });
      }

    const { page = 1, limit = 20, status, riskLevel, search } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (currentPage - 1) * perPage;

    const filter = {};
    if (status) filter.status = status;
    if (riskLevel) filter["leadMetadata.riskLevel"] = riskLevel;

    if (search && search.trim()) {
      const searchTerm = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } },
        { tourPackageName: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const totalEnquiries = await TourEnquiry.countDocuments(filter);
    const enquiries = await TourEnquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean();

    const totalPages = Math.ceil(totalEnquiries / perPage);

    return res.status(200).json({
      success: true,
      message: "Tour enquiries fetched successfully",
      enquiries: enquiries.map(withFullCountryNames),
      pagination: {
        currentPage,
        perPage,
        totalEnquiries,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    return handleEnquiryError(error, res, "fetch tour enquiries");
  }
});

TourEnquiryRouter.get("/admin/:id", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can access form",
      });
    }
    const { id } = req.params;
    const enquiry = await TourEnquiry.findById(id).lean();

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Tour enquiry not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Tour enquiry fetched successfully",
      enquiry: withFullCountryNames(enquiry),
    });
  } catch (error) {
    return handleEnquiryError(error, res, "fetch tour enquiry");
  }
});


TourEnquiryRouter.patch("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can edit tour enquiries",
        });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tour enquiry ID",
        });
      }

      const allowedFields = [
        "name",
        "email",
        "phone",
        "nationality",
        "tourPackageId",
        "travelDate",
        "duration",
        "adults",
        "children",
        "hotelType",
        "reference",
        "details",
      ];

      const updateData = {};

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No editable fields were provided",
        });
      }

      const enquiry = await TourEnquiry.findById(id);

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Tour enquiry not found",
        });
      }

      if (
        updateData.name !== undefined &&
        (!updateData.name ||
          typeof updateData.name !== "string" ||
          !updateData.name.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }

      if (
        updateData.email !== undefined &&
        (!updateData.email ||
          typeof updateData.email !== "string" ||
          !updateData.email.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty",
        });
      }

      if (
        updateData.phone !== undefined &&
        (!updateData.phone ||
          typeof updateData.phone !== "string" ||
          !updateData.phone.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Phone cannot be empty",
        });
      }

      const stringFields = [
        "name",
        "email",
        "phone",
        "nationality",
        "tourPackageId",
        "duration",
        "hotelType",
        "reference",
        "details",
      ];

      for (const field of stringFields) {
        if (
          updateData[field] !== undefined &&
          typeof updateData[field] === "string"
        ) {
          updateData[field] = updateData[field].trim();
        }
      }

      if (updateData.adults !== undefined) {
        if (typeof updateData.adults !== "string" ||!updateData.adults.trim()) {
          return res.status(400).json({
            success: false,
            message: "Adults must be a valid value",
          });
        }
        updateData.adults = updateData.adults.trim();
      }

      if (updateData.children !== undefined) {
        if (typeof updateData.children !== "string" ||!updateData.children.trim()) {
          return res.status(400).json({
            success: false,
            message: "Children must be a valid value",
          });
        }

        updateData.children = updateData.children.trim();
      }

      if (updateData.tourPackageId !== undefined) {
        if (!updateData.tourPackageId) {
          return res.status(400).json({
            success: false,
            message: "Tour package ID cannot be empty",
          });
        }

        const tourPackageData = await TourPackage.findOne({
          id: updateData.tourPackageId.toLowerCase(),
        }).lean();

        if (!tourPackageData) {
          return res.status(404).json({
            success: false,
            message: "Tour package not found",
          });
        }

        updateData.tourPackageId = tourPackageData.id;
        updateData.tourPackageName = tourPackageData.name;
      }

      Object.assign(enquiry, updateData);

      const nationalityChanged =
        updateData.nationality !== undefined;

      if (nationalityChanged) {
        const riskResult = detectRisk({
          nationality: enquiry.nationality,
          ipCountryCode:
            enquiry.leadMetadata?.ipCountry || null,
          phoneCountryCode:
            enquiry.leadMetadata?.phoneCountry || null,
        });

        if (!enquiry.leadMetadata) {
          enquiry.leadMetadata = {};
        }

        enquiry.leadMetadata.riskLevel =
          riskResult.riskLevel;

        enquiry.leadMetadata.riskReasons =
          riskResult.riskReasons;
      }

      await enquiry.save();

      const updatedEnquiry =
        withFullCountryNames(
          enquiry.toObject()
        );

      return res.status(200).json({
        success: true,
        message: "Tour enquiry updated successfully",
        enquiry: updatedEnquiry,
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "update tour enquiry"
      );
    }
  }
);

TourEnquiryRouter.patch("/admin/:id/status", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can update forms",
        });
    }
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const allowedStatuses = ["new", "contacted", "quotation-sent", "follow-up", "confirmed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid enquiry status", allowedStatuses });
    }

    const updateData = { status };
    if (status === "contacted") {
      updateData.lastContactedAt = new Date();
    }

    const enquiry = await TourEnquiry.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: "after", runValidators: true }).lean();

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Tour enquiry not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Tour enquiry status updated successfully",
      enquiry: { id: enquiry._id, status: enquiry.status, lastContactedAt: enquiry.lastContactedAt, updatedAt: enquiry.updatedAt },
    });
  } catch (error) {
    return handleEnquiryError(error, res, "update tour enquiry status");
  }
});

TourEnquiryRouter.patch("/admin/:id/risk", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can update the form",
        });
    }
    const { id } = req.params;
    const { riskLevel, riskReason } = req.body;

    const allowedRiskLevels = ["normal", "suspicious", "high-risk"];
    if (!riskLevel) {
      return res.status(400).json({ success: false, message: "Risk level is required" });
    }
    if (!allowedRiskLevels.includes(riskLevel)) {
      return res.status(400).json({ success: false, message: "Invalid risk level", allowedRiskLevels });
    }
    if ((riskLevel === "suspicious" || riskLevel === "high-risk") && (!riskReason || typeof riskReason !== "string" || !riskReason.trim())) {
      return res.status(400).json({ success: false, message: "A reason is required when marking an enquiry as suspicious or high-risk" });
    }

    const enquiry = await TourEnquiry.findById(id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Tour enquiry not found" });
    }

    enquiry.leadMetadata.riskLevel = riskLevel;
    enquiry.leadMetadata.riskReasons = riskLevel === "normal" ? [] : [riskReason.trim()];

    await enquiry.save();

    return res.status(200).json({
      success: true,
      message: "Tour enquiry risk updated successfully",
      enquiry: { id: enquiry._id, riskLevel: enquiry.leadMetadata.riskLevel, riskReasons: enquiry.leadMetadata.riskReasons, updatedAt: enquiry.updatedAt },
    });
  } catch (error) {
    return handleEnquiryError(error, res, "update tour enquiry risk");
  }
});

TourEnquiryRouter.patch("/admin/:id/notes", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can update teh form",
        });
    }
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (adminNotes !== null && adminNotes !== undefined && typeof adminNotes !== "string") {
      return res.status(400).json({ success: false, message: "Admin notes must be a string" });
    }

    const enquiry = await TourEnquiry.findByIdAndUpdate(
      id,
      { $set: { adminNotes: adminNotes?.trim() || null } },
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Tour enquiry not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Tour enquiry notes updated successfully",
      enquiry: { id: enquiry._id, adminNotes: enquiry.adminNotes, updatedAt: enquiry.updatedAt },
    });
  } catch (error) {
    return handleEnquiryError(error, res, "update tour enquiry notes");
  }
});

TourEnquiryRouter.delete("/admin/:id", UserMiddleWare,  async (req, res) => {
  try {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can delete the enquiry",
        });
    }
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid tour enquiry ID" });
    }

    const enquiry = await TourEnquiry.findByIdAndDelete(id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Tour enquiry not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Tour enquiry deleted successfully",
      data: { id: enquiry._id, name: enquiry.name, email: enquiry.email },
    });
  } catch (error) {
    return handleEnquiryError(error, res, "delete tour enquiry");
  }
});

TourEnquiryRouter.get("/admin/dashboard/stats", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can see the status",
        });
    }
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalEnquiries,
      statusStats,
      riskStats,
      todayEnquiries,
      thisWeekEnquiries,
      thisMonthEnquiries,
      topNationalities,
      topIpCountries,
      topTourPackages,
    ] = await Promise.all([
      TourEnquiry.countDocuments(),
      TourEnquiry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      TourEnquiry.aggregate([{ $group: { _id: "$leadMetadata.riskLevel", count: { $sum: 1 } } }]),
      TourEnquiry.countDocuments({ createdAt: { $gte: startOfToday } }),
      TourEnquiry.countDocuments({ createdAt: { $gte: startOfWeek } }),
      TourEnquiry.countDocuments({ createdAt: { $gte: startOfMonth } }),
      TourEnquiry.aggregate([
        { $match: { nationality: { $nin: [null, ""] } } },
        { $group: { _id: "$nationality", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, country: "$_id", count: 1 } },
      ]),
      TourEnquiry.aggregate([
        { $match: { "leadMetadata.ipCountry": { $nin: [null, ""] } } },
        { $group: { _id: "$leadMetadata.ipCountry", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, country: "$_id", count: 1 } },
      ]),
      TourEnquiry.aggregate([
        { $match: { tourPackageName: { $nin: [null, ""] } } },
        { $group: { _id: "$tourPackageName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, name: "$_id", count: 1 } },
      ]),
    ]);

    const statusCounts = { new: 0, contacted: 0, quotationSent: 0, followUp: 0, confirmed: 0, cancelled: 0 };
    statusStats.forEach((item) => {
      if (item._id === "new") statusCounts.new = item.count;
      if (item._id === "contacted") statusCounts.contacted = item.count;
      if (item._id === "quotation-sent") statusCounts.quotationSent = item.count;
      if (item._id === "follow-up") statusCounts.followUp = item.count;
      if (item._id === "confirmed") statusCounts.confirmed = item.count;
      if (item._id === "cancelled") statusCounts.cancelled = item.count;
    });

    const riskCounts = { normal: 0, suspicious: 0, highRisk: 0 };
    riskStats.forEach((item) => {
      if (item._id === "normal") riskCounts.normal = item.count;
      if (item._id === "suspicious") riskCounts.suspicious = item.count;
      if (item._id === "high-risk") riskCounts.highRisk = item.count;
    });

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics fetched successfully",
      data: {
        overview: { total: totalEnquiries, ...statusCounts },
        risk: { ...riskCounts },
        period: { today: todayEnquiries, thisWeek: thisWeekEnquiries, thisMonth: thisMonthEnquiries },
      
        topNationalities: topNationalities.map((row) => ({ ...row, country: codeToName(row.country) })),
        topIpCountries: topIpCountries.map((row) => ({ ...row, country: codeToName(row.country) })),
        topTourPackages,
      },
    });
  } catch (error) {
    return handleEnquiryError(error, res, "fetch dashboard statistics");
  }
});

module.exports = TourEnquiryRouter;