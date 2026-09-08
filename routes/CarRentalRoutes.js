const express = require("express");
const mongoose = require("mongoose");

const UserMiddleWare = require("../middleware/UserMiddleWare");

const CarRentalEnquiry = require("../models/carRentalEnquirySchema");
const TourPackage = require("../models/TourPackage");

const { getLeadLocation } = require("../utils/leadLocation");
const { detectRisk } = require("../utils/riskDetection");
const { codeToName } = require("../utils/countryNames");

const sendCarRentalEnquiryEmail = require("../utils/sendCarRentalEnquiryEmail");

const CarRentalRoute = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleEnquiryError(error, res, action) {
  console.error(`Error ${action}:`, error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "CastError") {
    const message =
      error.path === "_id"
        ? "Invalid enquiry ID"
        : `Invalid value for "${error.path}"`;

    return res.status(400).json({
      success: false,
      message,
    });
  }

  return res.status(500).json({
    success: false,
    message: `Failed to ${action}`,
  });
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

          phoneCountry: codeToName(
            enquiry.leadMetadata.phoneCountry
          ),
        }
      : enquiry.leadMetadata,
  };
}

CarRentalRoute.post("/create", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      nationality,
      tourPackageId,
      tourPackageName,
      travelDate,
      duration,
      adults,
      children,
      vehicle,
      reference,
      details,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (
      !tourPackageId ||
      typeof tourPackageId !== "string" ||
      !tourPackageId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Tour package ID is required",
      });
    }

    if (
      !tourPackageName ||
      typeof tourPackageName !== "string" ||
      !tourPackageName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Tour package name is required",
      });
    }

    const cleanTourPackageId = tourPackageId
      .trim()
      .toLowerCase();

    const cleanTourPackageName = tourPackageName.trim();

    const tourPackageData = await TourPackage.findOne({
      id: cleanTourPackageId,
    }).lean();

    if (!tourPackageData) {
      return res.status(404).json({
        success: false,
        message: "Tour package not found",
      });
    }

    const finalTourPackageId = tourPackageData.id;
    const finalTourPackageName = cleanTourPackageName;

    let rentalDuration = null;

    if (
      duration !== undefined &&
      duration !== null &&
      duration !== ""
    ) {
      rentalDuration = Number(duration);

      if (
        !Number.isInteger(rentalDuration) ||
        rentalDuration < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Duration must be a valid number",
        });
      }
    }

    const totalAdults =
      adults !== undefined &&
      adults !== null &&
      adults !== ""
        ? String(adults).trim()
        : "1";

    const totalChildren =
      children !== undefined &&
      children !== null &&
      children !== ""
        ? String(children).trim()
        : "0";

    let rentalTravelDate = null;

    if (travelDate) {
      const parsedDate = new Date(travelDate);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid travel date",
        });
      }

      rentalTravelDate = parsedDate;
    }

    const leadLocation = await getLeadLocation(
      req,
      phone.trim()
    );

    const riskResult = detectRisk({
      nationality:
        typeof nationality === "string" &&
        nationality.trim()
          ? nationality.trim().toUpperCase()
          : null,

      ipCountryCode: leadLocation.ipCountryCode,

      phoneCountryCode: leadLocation.phoneCountryCode,
    });

    const leadMetadata = {
      ipAddress: leadLocation.ipAddress,

      ipCountry: leadLocation.ipCountryCode,

      ipRegion: leadLocation.ipRegion,

      ipCity: leadLocation.ipCity,

      phoneCountry: leadLocation.phoneCountryCode,

      userAgent: req.headers["user-agent"] || null,

      source: "website",

      sourcePage:
        req.headers.referer ||
        req.headers.referrer ||
        null,

      riskLevel: riskResult.riskLevel,

      riskReasons: riskResult.riskReasons,
    };

    const newEnquiry = await CarRentalEnquiry.create({
      name: name.trim(),

      email: email.trim().toLowerCase(),

      phone: phone.trim(),

      nationality:
        typeof nationality === "string" &&
        nationality.trim()
          ? nationality.trim().toUpperCase()
          : null,

      tourPackageId: finalTourPackageId,

      tourPackageName: finalTourPackageName,

      travelDate: rentalTravelDate,

      duration: rentalDuration,

      adults: totalAdults,

      children: totalChildren,

      vehicle:
        typeof vehicle === "string" &&
        vehicle.trim()
          ? vehicle.trim()
          : null,

      reference:
        typeof reference === "string" &&
        reference.trim()
          ? reference.trim()
          : null,

      details:
        typeof details === "string" &&
        details.trim()
          ? details.trim()
          : null,

      status: "new",

      adminNotification: {
        sent: false,
        sentAt: null,
      },

      leadMetadata,
    });

    res.status(201).json({
      success: true,

      message:
        "Your car rental enquiry has been submitted successfully",

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
      await sendCarRentalEnquiryEmail(newEnquiry);

      newEnquiry.adminNotification.sent = true;

      newEnquiry.adminNotification.sentAt = new Date();

      await newEnquiry.save();
    } catch (emailError) {
      console.error(
        "Failed to send car rental admin enquiry email:",
        emailError
      );
    }
  } catch (error) {
    return handleEnquiryError(
      error,
      res,
      "submit car rental enquiry"
    );
  }
});

CarRentalRoute.get("/admin/dashboard/stats",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can see dashboard statistics",
        });
      }

      const now = new Date();

      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const startOfWeek = new Date(startOfToday);

      const day = startOfWeek.getDay();

      const daysFromMonday = day === 0 ? 6 : day - 1;

      startOfWeek.setDate(
        startOfWeek.getDate() - daysFromMonday
      );

      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

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
        topVehicles,
      ] = await Promise.all([
        CarRentalEnquiry.countDocuments(),

        CarRentalEnquiry.aggregate([
          {
            $group: {
              _id: "$status",
              count: {
                $sum: 1,
              },
            },
          },
        ]),

        CarRentalEnquiry.aggregate([
          {
            $group: {
              _id: "$leadMetadata.riskLevel",
              count: {
                $sum: 1,
              },
            },
          },
        ]),

        CarRentalEnquiry.countDocuments({
          createdAt: {
            $gte: startOfToday,
          },
        }),

        CarRentalEnquiry.countDocuments({
          createdAt: {
            $gte: startOfWeek,
          },
        }),

        CarRentalEnquiry.countDocuments({
          createdAt: {
            $gte: startOfMonth,
          },
        }),

        CarRentalEnquiry.aggregate([
          {
            $match: {
              nationality: {
                $nin: [null, ""],
              },
            },
          },

          {
            $group: {
              _id: "$nationality",
              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit: 10,
          },

          {
            $project: {
              _id: 0,
              country: "$_id",
              count: 1,
            },
          },
        ]),

        CarRentalEnquiry.aggregate([
          {
            $match: {
              "leadMetadata.ipCountry": {
                $nin: [null, ""],
              },
            },
          },

          {
            $group: {
              _id: "$leadMetadata.ipCountry",
              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit: 10,
          },

          {
            $project: {
              _id: 0,
              country: "$_id",
              count: 1,
            },
          },
        ]),

        CarRentalEnquiry.aggregate([
          {
            $match: {
              tourPackageName: {
                $nin: [null, ""],
              },
            },
          },

          {
            $group: {
              _id: "$tourPackageName",
              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit: 10,
          },

          {
            $project: {
              _id: 0,
              name: "$_id",
              count: 1,
            },
          },
        ]),

        CarRentalEnquiry.aggregate([
          {
            $match: {
              vehicle: {
                $nin: [null, ""],
              },
            },
          },

          {
            $group: {
              _id: "$vehicle",
              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit: 10,
          },

          {
            $project: {
              _id: 0,
              vehicle: "$_id",
              count: 1,
            },
          },
        ]),
      ]);

      const statusCounts = {
        new: 0,
        contacted: 0,
        quotationSent: 0,
        followUp: 0,
        confirmed: 0,
        cancelled: 0,
      };

      statusStats.forEach((item) => {
        if (item._id === "new") {
          statusCounts.new = item.count;
        }

        if (item._id === "contacted") {
          statusCounts.contacted = item.count;
        }

        if (item._id === "quotation-sent") {
          statusCounts.quotationSent = item.count;
        }

        if (item._id === "follow-up") {
          statusCounts.followUp = item.count;
        }

        if (item._id === "confirmed") {
          statusCounts.confirmed = item.count;
        }

        if (item._id === "cancelled") {
          statusCounts.cancelled = item.count;
        }
      });

      const riskCounts = {
        normal: 0,
        suspicious: 0,
        highRisk: 0,
      };

      riskStats.forEach((item) => {
        if (item._id === "normal") {
          riskCounts.normal = item.count;
        }

        if (item._id === "suspicious") {
          riskCounts.suspicious = item.count;
        }

        if (item._id === "high-risk") {
          riskCounts.highRisk = item.count;
        }
      });

      return res.status(200).json({
        success: true,

        message:
          "Car rental dashboard statistics fetched successfully",

        data: {
          overview: {
            total: totalEnquiries,
            ...statusCounts,
          },

          risk: {
            ...riskCounts,
          },

          period: {
            today: todayEnquiries,
            thisWeek: thisWeekEnquiries,
            thisMonth: thisMonthEnquiries,
          },

          topNationalities: topNationalities.map(
            (row) => ({
              ...row,
              country: codeToName(row.country),
            })
          ),

          topIpCountries: topIpCountries.map(
            (row) => ({
              ...row,
              country: codeToName(row.country),
            })
          ),

          topTourPackages,

          topVehicles,
        },
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "fetch car rental dashboard statistics"
      );
    }
  }
);

CarRentalRoute.get("/admin",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can access all car rental enquiries",
        });
      }

      const {
        page = 1,
        limit = 20,
        status,
        riskLevel,
        search,
      } = req.query;

      const currentPage = Math.max(
        Number(page) || 1,
        1
      );

      const perPage = Math.min(
        Math.max(Number(limit) || 20, 1),
        100
      );

      const skip =
        (currentPage - 1) * perPage;

      const filter = {};

      if (status) {
        filter.status = status;
      }

      if (riskLevel) {
        filter["leadMetadata.riskLevel"] =
          riskLevel;
      }

      if (search && search.trim()) {
        const searchTerm = escapeRegex(
          search.trim()
        );

        filter.$or = [
          {
            name: {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            email: {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            phone: {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            tourPackageName: {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            tourPackageId: {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            vehicle: {
              $regex: searchTerm,
              $options: "i",
            },
          },
        ];
      }

      const [
        totalEnquiries,
        enquiries,
      ] = await Promise.all([
        CarRentalEnquiry.countDocuments(filter),

        CarRentalEnquiry.find(filter)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(perPage)
          .lean(),
      ]);

      const totalPages = Math.ceil(
        totalEnquiries / perPage
      );

      return res.status(200).json({
        success: true,

        message:
          "Car rental enquiries fetched successfully",

        enquiries:
          enquiries.map(withFullCountryNames),

        pagination: {
          currentPage,

          perPage,

          totalEnquiries,

          totalPages,

          hasNextPage:
            currentPage < totalPages,

          hasPreviousPage:
            currentPage > 1,
        },
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "fetch car rental enquiries"
      );
    }
  }
);

CarRentalRoute.get("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can access car rental enquiries",
        });
      }

      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid car rental enquiry ID",
        });
      }

      const enquiry =
        await CarRentalEnquiry.findById(id).lean();

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Car rental enquiry not found",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Car rental enquiry fetched successfully",

        enquiry:
          withFullCountryNames(enquiry),
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "fetch car rental enquiry"
      );
    }
  }
);

CarRentalRoute.patch("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can edit car rental enquiries",
        });
      }

      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid car rental enquiry ID",
        });
      }

      const allowedFields = [
        "name",
        "email",
        "phone",
        "nationality",
        "tourPackageId",
        "tourPackageName",
        "travelDate",
        "duration",
        "adults",
        "children",
        "vehicle",
        "reference",
        "details",
      ];

      const updateData = {};

      for (const field of allowedFields) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body,
            field
          )
        ) {
          updateData[field] = req.body[field];
        }
      }

      if (
        Object.keys(updateData).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No editable fields were provided",
        });
      }

      const enquiry =
        await CarRentalEnquiry.findById(id);

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Car rental enquiry not found",
        });
      }

      if (updateData.name !== undefined) {
        if (
          !updateData.name ||
          typeof updateData.name !== "string" ||
          !updateData.name.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Name cannot be empty",
          });
        }
      }

      if (updateData.email !== undefined) {
        if (
          !updateData.email ||
          typeof updateData.email !== "string" ||
          !updateData.email.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Email cannot be empty",
          });
        }

        const emailRegex =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
          !emailRegex.test(
            updateData.email.trim()
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Please enter a valid email address",
          });
        }
      }

      if (updateData.phone !== undefined) {
        if (
          !updateData.phone ||
          typeof updateData.phone !== "string" ||
          !updateData.phone.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Phone cannot be empty",
          });
        }
      }

      const stringFields = [
        "name",
        "email",
        "phone",
        "nationality",
        "tourPackageId",
        "tourPackageName",
        "vehicle",
        "reference",
        "details",
      ];

      for (const field of stringFields) {
        if (
          updateData[field] !== undefined &&
          typeof updateData[field] === "string"
        ) {
          updateData[field] =
            updateData[field].trim();
        }
      }

      if (updateData.email !== undefined) {
        updateData.email =
          updateData.email.toLowerCase();
      }

      if (
        updateData.nationality !== undefined &&
        updateData.nationality
      ) {
        updateData.nationality =
          updateData.nationality.toUpperCase();
      }

      if (updateData.duration !== undefined) {
        if (
          updateData.duration === null ||
          updateData.duration === ""
        ) {
          updateData.duration = null;
        } else {
          const duration = Number(
            updateData.duration
          );

          if (
            !Number.isInteger(duration) ||
            duration < 1
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Duration must be a whole number greater than 0",
            });
          }

          updateData.duration = duration;
        }
      }

      if (updateData.adults !== undefined) {
        if (
          updateData.adults === null ||
          updateData.adults === ""
        ) {
          return res.status(400).json({
            success: false,
            message: "Adults cannot be empty",
          });
        }

        updateData.adults =
          String(updateData.adults).trim();
      }

      if (updateData.children !== undefined) {
        if (
          updateData.children === null ||
          updateData.children === ""
        ) {
          return res.status(400).json({
            success: false,
            message: "Children cannot be empty",
          });
        }

        updateData.children =
          String(updateData.children).trim();
      }

      if (updateData.travelDate !== undefined) {
        if (
          updateData.travelDate === null ||
          updateData.travelDate === ""
        ) {
          updateData.travelDate = null;
        } else {
          const parsedDate = new Date(
            updateData.travelDate
          );

          if (
            Number.isNaN(parsedDate.getTime())
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Please provide a valid travel date",
            });
          }

          updateData.travelDate = parsedDate;
        }
      }

      if (updateData.tourPackageId !== undefined) {
        if (!updateData.tourPackageId) {
          return res.status(400).json({
            success: false,
            message:
              "Tour package ID cannot be empty",
          });
        }

        const tourPackageData =
          await TourPackage.findOne({
            id: updateData.tourPackageId.toLowerCase(),
          }).lean();

        if (!tourPackageData) {
          return res.status(404).json({
            success: false,
            message:
              "Tour package not found",
          });
        }

        updateData.tourPackageId =
          tourPackageData.id;

        if (!updateData.tourPackageName) {
          updateData.tourPackageName =
            tourPackageData.name;
        }
      }

      if (
        updateData.tourPackageName !== undefined &&
        updateData.tourPackageId === undefined
      ) {
        if (!updateData.tourPackageName) {
          return res.status(400).json({
            success: false,
            message:
              "Tour package name cannot be empty",
          });
        }
      }

      Object.assign(enquiry, updateData);

      if (updateData.nationality !== undefined) {
        const riskResult = detectRisk({
          nationality:
            enquiry.nationality,

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

        message:
          "Car rental enquiry updated successfully",

        enquiry: updatedEnquiry,
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "update car rental enquiry"
      );
    }
  }
);

CarRentalRoute.patch("/admin/:id/status",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can update car rental status",
        });
      }

      const { id } = req.params;

      const { status } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid car rental enquiry ID",
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status is required",
        });
      }

      const allowedStatuses = [
        "new",
        "contacted",
        "quotation-sent",
        "follow-up",
        "confirmed",
        "cancelled",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry status",
          allowedStatuses,
        });
      }

      const updateData = {
        status,
      };

      if (status === "contacted") {
        updateData.lastContactedAt =
          new Date();
      }

      const enquiry =
        await CarRentalEnquiry.findByIdAndUpdate(
          id,
          {
            $set: updateData,
          },
          {
            returnDocument: "after",
            runValidators: true,
          }
        ).lean();

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Car rental enquiry not found",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Car rental enquiry status updated successfully",

        enquiry: {
          id: enquiry._id,

          status: enquiry.status,

          lastContactedAt:
            enquiry.lastContactedAt,

          updatedAt:
            enquiry.updatedAt,
        },
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "update car rental enquiry status"
      );
    }
  }
);

CarRentalRoute.patch("/admin/:id/risk",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can update car rental risk",
        });
      }

      const { id } = req.params;

      const {
        riskLevel,
        riskReason,
      } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid car rental enquiry ID",
        });
      }

      const allowedRiskLevels = [
        "normal",
        "suspicious",
        "high-risk",
      ];

      if (!riskLevel) {
        return res.status(400).json({
          success: false,
          message: "Risk level is required",
        });
      }

      if (
        !allowedRiskLevels.includes(riskLevel)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid risk level",
          allowedRiskLevels,
        });
      }

      if (
        (
          riskLevel === "suspicious" ||
          riskLevel === "high-risk"
        ) &&
        (
          !riskReason ||
          typeof riskReason !== "string" ||
          !riskReason.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A reason is required when marking an enquiry as suspicious or high-risk",
        });
      }

      const enquiry =
        await CarRentalEnquiry.findById(id);

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Car rental enquiry not found",
        });
      }

      if (!enquiry.leadMetadata) {
        enquiry.leadMetadata = {};
      }

      enquiry.leadMetadata.riskLevel =
        riskLevel;

      enquiry.leadMetadata.riskReasons =
        riskLevel === "normal"
          ? []
          : [riskReason.trim()];

      await enquiry.save();

      return res.status(200).json({
        success: true,

        message:
          "Car rental enquiry risk updated successfully",

        enquiry: {
          id: enquiry._id,

          riskLevel:
            enquiry.leadMetadata.riskLevel,

          riskReasons:
            enquiry.leadMetadata.riskReasons,

          updatedAt:
            enquiry.updatedAt,
        },
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "update car rental enquiry risk"
      );
    }
  }
);

CarRentalRoute.patch("/admin/:id/notes",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can update car rental notes",
        });
      }

      const { id } = req.params;

      const { adminNotes } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid car rental enquiry ID",
        });
      }

      if (
        adminNotes !== null &&
        adminNotes !== undefined &&
        typeof adminNotes !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Admin notes must be a string",
        });
      }

      const enquiry =
        await CarRentalEnquiry.findByIdAndUpdate(
          id,
          {
            $set: {
              adminNotes:
                adminNotes?.trim() || null,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
          }
        ).lean();

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Car rental enquiry not found",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Car rental enquiry notes updated successfully",

        enquiry: {
          id: enquiry._id,

          adminNotes:
            enquiry.adminNotes,

          updatedAt:
            enquiry.updatedAt,
        },
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "update car rental enquiry notes"
      );
    }
  }
);

CarRentalRoute.delete("/admin/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can delete car rental enquiries",
        });
      }

      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid car rental enquiry ID",
        });
      }

      const enquiry =
        await CarRentalEnquiry.findByIdAndDelete(id);

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Car rental enquiry not found",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Car rental enquiry deleted successfully",

        data: {
          id: enquiry._id,

          name: enquiry.name,

          email: enquiry.email,
        },
      });
    } catch (error) {
      return handleEnquiryError(
        error,
        res,
        "delete car rental enquiry"
      );
    }
  }
);

module.exports = CarRentalRoute;