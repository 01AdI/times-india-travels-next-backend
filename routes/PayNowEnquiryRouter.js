const express = require("express");
const mongoose = require("mongoose");

const UserMiddleWare = require("../middleware/UserMiddleWare");
const PayNowEnquiry = require("../models/PayNowSceham");

const { getLeadLocation } = require("../utils/leadLocation");
const { detectRisk } = require("../utils/riskDetection");
const { codeToName } = require("../utils/countryNames");

const sendAdminPayNowEmail = require("../utils/sendPayNowEmail");

const PayNowEnquiryRouter = express.Router();


// ============================================================
// HELPERS
// ============================================================

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function handlePayNowError(error, res, action) {
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
        ? "Invalid Pay Now enquiry ID"
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

    customer: enquiry.customer
      ? {
          ...enquiry.customer,
          country:
            codeToName(enquiry.customer.country) ||
            enquiry.customer.country,
        }
      : enquiry.customer,

    billing: enquiry.billing
      ? {
          ...enquiry.billing,
          country:
            codeToName(enquiry.billing.country) ||
            enquiry.billing.country,
        }
      : enquiry.billing,

    leadMetadata: enquiry.leadMetadata
      ? {
          ...enquiry.leadMetadata,

          ipCountry:
            codeToName(enquiry.leadMetadata.ipCountry) ||
            enquiry.leadMetadata.ipCountry,

          phoneCountry:
            codeToName(enquiry.leadMetadata.phoneCountry) ||
            enquiry.leadMetadata.phoneCountry,
        }
      : enquiry.leadMetadata,
  };
}


// ============================================================
// PUBLIC
// POST /pay-now/create
// ============================================================

PayNowEnquiryRouter.post("/create", async (req, res) => {
  try {
    const {
      amount,
      description,

      name,
      address,
      city,
      state,
      postalCode,
      country,
      email,
      confirmEmail,
      telephone,

      billingName,
      billingAddress,
      billingCity,
      billingState,
      billingPostalCode,
      billingCountry,
      billingTelephone,
    } = req.body;


    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    const requiredFields = [
      {
        field: "amount",
        value: amount,
        label: "Amount",
      },
      {
        field: "description",
        value: description,
        label: "Description",
      },

      {
        field: "name",
        value: name,
        label: "Name",
      },
      {
        field: "address",
        value: address,
        label: "Address",
      },
      {
        field: "city",
        value: city,
        label: "City",
      },
      {
        field: "state",
        value: state,
        label: "State",
      },
      {
        field: "postalCode",
        value: postalCode,
        label: "Postal code",
      },
      {
        field: "country",
        value: country,
        label: "Country",
      },
      {
        field: "email",
        value: email,
        label: "Email",
      },
      {
        field: "telephone",
        value: telephone,
        label: "Telephone",
      },

      {
        field: "billingName",
        value: billingName,
        label: "Billing name",
      },
      {
        field: "billingAddress",
        value: billingAddress,
        label: "Billing address",
      },
      {
        field: "billingCity",
        value: billingCity,
        label: "Billing city",
      },
      {
        field: "billingState",
        value: billingState,
        label: "Billing state",
      },
      {
        field: "billingPostalCode",
        value: billingPostalCode,
        label: "Billing postal code",
      },
      {
        field: "billingCountry",
        value: billingCountry,
        label: "Billing country",
      },
      {
        field: "billingTelephone",
        value: billingTelephone,
        label: "Billing telephone",
      },
    ];


    for (const item of requiredFields) {
      if (
        item.value === undefined ||
        item.value === null ||
        String(item.value).trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `${item.label} is required`,
        });
      }
    }


    // --------------------------------------------------------
    // Amount validation
    // --------------------------------------------------------

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid positive number",
      });
    }


    // --------------------------------------------------------
    // Email validation
    // --------------------------------------------------------

    const EMAIL_REGEX =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const normalizedEmail =
      String(email).trim().toLowerCase();

    const normalizedConfirmEmail =
      String(confirmEmail || "")
        .trim()
        .toLowerCase();


    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }


    if (!normalizedConfirmEmail) {
      return res.status(400).json({
        success: false,
        message: "Please confirm your email address",
      });
    }


    if (
      normalizedEmail !==
      normalizedConfirmEmail
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and confirm email must match",
      });
    }


    // --------------------------------------------------------
    // Telephone validation
    // --------------------------------------------------------

    const normalizedTelephone =
      String(telephone).trim();

    const normalizedBillingTelephone =
      String(billingTelephone).trim();


    if (
      normalizedTelephone.length < 7 ||
      normalizedTelephone.length > 20
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid telephone number",
      });
    }


    if (
      normalizedBillingTelephone.length < 7 ||
      normalizedBillingTelephone.length > 20
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid billing telephone number",
      });
    }


    // --------------------------------------------------------
    // Lead location
    // --------------------------------------------------------

    const leadLocation =
      await getLeadLocation(
        req,
        normalizedTelephone
      );


    // --------------------------------------------------------
    // Risk detection
    // --------------------------------------------------------

    const riskResult = detectRisk({
      nationality: country,

      ipCountryCode:
        leadLocation.ipCountryCode,

      phoneCountryCode:
        leadLocation.phoneCountryCode,
    });


    // --------------------------------------------------------
    // Lead metadata
    // --------------------------------------------------------

    const leadMetadata = {
      ipAddress:
        leadLocation.ipAddress,

      ipCountry:
        leadLocation.ipCountryCode,

      ipRegion:
        leadLocation.ipRegion,

      ipCity:
        leadLocation.ipCity,

      phoneCountry:
        leadLocation.phoneCountryCode,

      userAgent:
        req.headers["user-agent"] || null,

      source: "website",

      sourcePage:
        req.headers.referer || null,

      riskLevel:
        riskResult.riskLevel,

      riskReasons:
        riskResult.riskReasons,
    };


    // --------------------------------------------------------
    // Create enquiry
    // --------------------------------------------------------

    const newEnquiry =
      await PayNowEnquiry.create({
        amount: numericAmount,

        description:
          String(description).trim(),

        customer: {
          name:
            String(name).trim(),

          address:
            String(address).trim(),

          city:
            String(city).trim(),

          state:
            String(state).trim(),

          postalCode:
            String(postalCode).trim(),

          country:
            String(country).trim(),

          email:
            normalizedEmail,

          telephone:
            normalizedTelephone,
        },

        billing: {
          name:
            String(billingName).trim(),

          address:
            String(billingAddress).trim(),

          city:
            String(billingCity).trim(),

          state:
            String(billingState).trim(),

          postalCode:
            String(billingPostalCode).trim(),

          country:
            String(billingCountry).trim(),

          telephone:
            normalizedBillingTelephone,
        },

        status: "new",

        leadMetadata,
      });


    // --------------------------------------------------------
    // Send response
    // --------------------------------------------------------

    res.status(201).json({
      success: true,

      message:
        "Payment request submitted successfully",

      enquiry: {
        id:
          newEnquiry._id,

        amount:
          newEnquiry.amount,

        description:
          newEnquiry.description,

        name:
          newEnquiry.customer.name,

        email:
          newEnquiry.customer.email,

        status:
          newEnquiry.status,

        riskLevel:
          newEnquiry.leadMetadata?.riskLevel ||
          "normal",
      },
    });


    // --------------------------------------------------------
    // Admin email
    // --------------------------------------------------------

    try {
      await sendAdminPayNowEmail(
        newEnquiry
      );

      newEnquiry.adminNotification.sent =
        true;

      newEnquiry.adminNotification.sentAt =
        new Date();

      await newEnquiry.save();

    } catch (emailError) {
      console.error(
        "Failed to send admin Pay Now email:",
        emailError
      );
    }

  } catch (error) {
    return handlePayNowError(
      error,
      res,
      "submit Pay Now request"
    );
  }
});


// ============================================================
// ADMIN
// GET /pay-now/admin
// ============================================================

PayNowEnquiryRouter.get(
  "/admin",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can access Pay Now enquiries",
        });
      }


      const {
        page = 1,
        limit = 20,
        status,
        riskLevel,
        search,
      } = req.query;


      const currentPage =
        Math.max(
          Number(page) || 1,
          1
        );


      const perPage =
        Math.min(
          Math.max(
            Number(limit) || 20,
            1
          ),
          100
        );


      const skip =
        (currentPage - 1) *
        perPage;


      // ------------------------------------------------------
      // Filters
      // ------------------------------------------------------

      const filter = {};


      if (status) {
        filter.status = status;
      }


      if (riskLevel) {
        filter[
          "leadMetadata.riskLevel"
        ] = riskLevel;
      }


      if (
        search &&
        search.trim()
      ) {

        const searchTerm =
          escapeRegex(
            search.trim()
          );


        filter.$or = [
          {
            "customer.name": {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            "customer.email": {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            "customer.telephone": {
              $regex: searchTerm,
              $options: "i",
            },
          },

          {
            description: {
              $regex: searchTerm,
              $options: "i",
            },
          },
        ];
      }


      // ------------------------------------------------------
      // Fetch
      // ------------------------------------------------------

      const totalEnquiries =
        await PayNowEnquiry.countDocuments(
          filter
        );


      const enquiries =
        await PayNowEnquiry.find(
          filter
        )
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(perPage)
          .lean();


      const totalPages =
        Math.ceil(
          totalEnquiries /
          perPage
        );


      return res.status(200).json({
        success: true,

        message:
          "Pay Now enquiries fetched successfully",

        enquiries:
          enquiries.map(
            withFullCountryNames
          ),

        pagination: {
          currentPage,

          perPage,

          totalEnquiries,

          totalPages,

          hasNextPage:
            currentPage <
            totalPages,

          hasPreviousPage:
            currentPage > 1,
        },
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "fetch Pay Now enquiries"
      );
    }
  }
);


// ============================================================
// ADMIN
// GET /pay-now/admin/dashboard/stats
// ============================================================

PayNowEnquiryRouter.get(
  "/admin/dashboard/stats",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can access Pay Now statistics",
        });
      }


      const now =
        new Date();


      const startOfToday =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );


      const startOfWeek =
        new Date(
          startOfToday
        );


      const day =
        startOfWeek.getDay();


      const daysFromMonday =
        day === 0
          ? 6
          : day - 1;


      startOfWeek.setDate(
        startOfWeek.getDate() -
          daysFromMonday
      );


      const startOfMonth =
        new Date(
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

        amountStats,

        paidAmountStats,
      ] =
        await Promise.all([

          // -----------------------------------------------
          // Total
          // -----------------------------------------------

          PayNowEnquiry.countDocuments(),


          // -----------------------------------------------
          // Status
          // -----------------------------------------------

          PayNowEnquiry.aggregate([
            {
              $group: {
                _id:
                  "$status",

                count: {
                  $sum: 1,
                },
              },
            },
          ]),


          // -----------------------------------------------
          // Risk
          // -----------------------------------------------

          PayNowEnquiry.aggregate([
            {
              $group: {
                _id:
                  "$leadMetadata.riskLevel",

                count: {
                  $sum: 1,
                },
              },
            },
          ]),


          // -----------------------------------------------
          // Today
          // -----------------------------------------------

          PayNowEnquiry.countDocuments({
            createdAt: {
              $gte:
                startOfToday,
            },
          }),


          // -----------------------------------------------
          // Week
          // -----------------------------------------------

          PayNowEnquiry.countDocuments({
            createdAt: {
              $gte:
                startOfWeek,
            },
          }),


          // -----------------------------------------------
          // Month
          // -----------------------------------------------

          PayNowEnquiry.countDocuments({
            createdAt: {
              $gte:
                startOfMonth,
            },
          }),


          // -----------------------------------------------
          // Total amount requested
          // -----------------------------------------------

          PayNowEnquiry.aggregate([
            {
              $group: {
                _id: null,

                total: {
                  $sum:
                    "$amount",
                },
              },
            },
          ]),


          // -----------------------------------------------
          // Total paid amount
          // -----------------------------------------------

          PayNowEnquiry.aggregate([
            {
              $match: {
                status: "paid",
              },
            },

            {
              $group: {
                _id: null,

                total: {
                  $sum:
                    "$amount",
                },
              },
            },
          ]),
        ]);


      // ----------------------------------------------------
      // Status counts
      // ----------------------------------------------------

      const statusCounts = {
        new: 0,
        contacted: 0,
        paymentLinkSent: 0,
        paid: 0,
        cancelled: 0,
      };


      statusStats.forEach(
        (item) => {

          if (
            item._id === "new"
          ) {
            statusCounts.new =
              item.count;
          }

          if (
            item._id === "contacted"
          ) {
            statusCounts.contacted =
              item.count;
          }

          if (
            item._id ===
            "payment-link-sent"
          ) {
            statusCounts.paymentLinkSent =
              item.count;
          }

          if (
            item._id === "paid"
          ) {
            statusCounts.paid =
              item.count;
          }

          if (
            item._id === "cancelled"
          ) {
            statusCounts.cancelled =
              item.count;
          }
        }
      );


      // ----------------------------------------------------
      // Risk counts
      // ----------------------------------------------------

      const riskCounts = {
        normal: 0,
        suspicious: 0,
        highRisk: 0,
      };


      riskStats.forEach(
        (item) => {

          if (
            item._id === "normal"
          ) {
            riskCounts.normal =
              item.count;
          }

          if (
            item._id ===
            "suspicious"
          ) {
            riskCounts.suspicious =
              item.count;
          }

          if (
            item._id === "high-risk"
          ) {
            riskCounts.highRisk =
              item.count;
          }
        }
      );


      // ----------------------------------------------------
      // Amounts
      // ----------------------------------------------------

      const totalAmountRequested =
        amountStats[0]?.total ||
        0;


      const totalAmountPaid =
        paidAmountStats[0]?.total ||
        0;


      // ----------------------------------------------------
      // Response
      // ----------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Pay Now dashboard statistics fetched successfully",

        data: {

          overview: {
            total:
              totalEnquiries,

            ...statusCounts,
          },

          risk: {
            ...riskCounts,
          },

          period: {
            today:
              todayEnquiries,

            thisWeek:
              thisWeekEnquiries,

            thisMonth:
              thisMonthEnquiries,
          },

          amounts: {
            totalRequested:
              totalAmountRequested,

            totalPaid:
              totalAmountPaid,
          },
        },
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "fetch Pay Now dashboard statistics"
      );
    }
  }
);


// ============================================================
// ADMIN
// GET /pay-now/admin/:id
// ============================================================

PayNowEnquiryRouter.get(
  "/admin/:id",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can access Pay Now enquiries",
        });
      }


      const { id } =
        req.params;


      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Pay Now enquiry ID",
        });
      }


      const enquiry =
        await PayNowEnquiry.findById(
          id
        ).lean();


      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Pay Now enquiry not found",
        });
      }


      return res.status(200).json({
        success: true,

        message:
          "Pay Now enquiry fetched successfully",

        enquiry:
          withFullCountryNames(
            enquiry
          ),
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "fetch Pay Now enquiry"
      );
    }
  }
);


// ============================================================
// ADMIN
// PATCH /pay-now/admin/:id
// ============================================================

PayNowEnquiryRouter.patch(
  "/admin/:id",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can edit Pay Now enquiries",
        });
      }


      const { id } =
        req.params;


      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Pay Now enquiry ID",
        });
      }


      const enquiry =
        await PayNowEnquiry.findById(
          id
        );


      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Pay Now enquiry not found",
        });
      }


      // ------------------------------------------------------
      // Allowed fields
      // ------------------------------------------------------

      const allowedFields = [
        "amount",
        "description",
        "customer",
        "billing",
      ];


      const updateData = {};


      for (
        const field of allowedFields
      ) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body,
            field
          )
        ) {
          updateData[field] =
            req.body[field];
        }
      }


      if (
        Object.keys(updateData)
          .length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No editable fields were provided",
        });
      }


      // ------------------------------------------------------
      // Amount
      // ------------------------------------------------------

      if (
        updateData.amount !== undefined
      ) {

        const numericAmount =
          Number(
            updateData.amount
          );


        if (
          !Number.isFinite(
            numericAmount
          ) ||
          numericAmount <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Amount must be a valid positive number",
          });
        }


        updateData.amount =
          numericAmount;
      }


      // ------------------------------------------------------
      // Description
      // ------------------------------------------------------

      if (
        updateData.description !==
        undefined
      ) {

        if (
          typeof updateData.description !==
            "string" ||
          !updateData.description.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Description cannot be empty",
          });
        }


        updateData.description =
          updateData.description.trim();
      }


      // ------------------------------------------------------
      // Customer
      // ------------------------------------------------------

      if (
        updateData.customer !==
        undefined
      ) {

        if (
          typeof updateData.customer !==
          "object"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Customer must be an object",
          });
        }


        const customer =
          updateData.customer;


        const customerRequired = [
          "name",
          "address",
          "city",
          "state",
          "postalCode",
          "country",
          "email",
          "telephone",
        ];


        for (
          const field of customerRequired
        ) {
          if (
            customer[field] ===
              undefined ||
            customer[field] ===
              null ||
            String(
              customer[field]
            ).trim() === ""
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Customer ${field} cannot be empty`,
            });
          }
        }


        const email =
          String(
            customer.email
          )
            .trim()
            .toLowerCase();


        const EMAIL_REGEX =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
          !EMAIL_REGEX.test(email)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Customer email is invalid",
          });
        }


        const telephone =
          String(
            customer.telephone
          ).trim();


        if (
          telephone.length < 7 ||
          telephone.length > 20
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Customer telephone is invalid",
          });
        }


        updateData.customer = {
          name:
            String(customer.name).trim(),

          address:
            String(customer.address).trim(),

          city:
            String(customer.city).trim(),

          state:
            String(customer.state).trim(),

          postalCode:
            String(
              customer.postalCode
            ).trim(),

          country:
            String(customer.country).trim(),

          email,

          telephone,
        };
      }


      // ------------------------------------------------------
      // Billing
      // ------------------------------------------------------

      if (
        updateData.billing !==
        undefined
      ) {

        if (
          typeof updateData.billing !==
          "object"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Billing must be an object",
          });
        }


        const billing =
          updateData.billing;


        const billingRequired = [
          "name",
          "address",
          "city",
          "state",
          "postalCode",
          "country",
          "telephone",
        ];


        for (
          const field of billingRequired
        ) {
          if (
            billing[field] ===
              undefined ||
            billing[field] ===
              null ||
            String(
              billing[field]
            ).trim() === ""
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Billing ${field} cannot be empty`,
            });
          }
        }


        const telephone =
          String(
            billing.telephone
          ).trim();


        if (
          telephone.length < 7 ||
          telephone.length > 20
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Billing telephone is invalid",
          });
        }


        updateData.billing = {
          name:
            String(
              billing.name
            ).trim(),

          address:
            String(
              billing.address
            ).trim(),

          city:
            String(
              billing.city
            ).trim(),

          state:
            String(
              billing.state
            ).trim(),

          postalCode:
            String(
              billing.postalCode
            ).trim(),

          country:
            String(
              billing.country
            ).trim(),

          telephone,
        };
      }


      // ------------------------------------------------------
      // Apply update
      // ------------------------------------------------------

      Object.assign(
        enquiry,
        updateData
      );


      // ------------------------------------------------------
      // Recalculate risk if customer country changed
      // ------------------------------------------------------

      if (
        updateData.customer
      ) {

        const riskResult =
          detectRisk({
            nationality:
              enquiry.customer
                ?.country,

            ipCountryCode:
              enquiry.leadMetadata
                ?.ipCountry ||
              null,

            phoneCountryCode:
              enquiry.leadMetadata
                ?.phoneCountry ||
              null,
          });


        if (
          !enquiry.leadMetadata
        ) {
          enquiry.leadMetadata =
            {};
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
          "Pay Now enquiry updated successfully",

        enquiry:
          updatedEnquiry,
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "update Pay Now enquiry"
      );
    }
  }
);


// ============================================================
// ADMIN
// PATCH /pay-now/admin/:id/status
// ============================================================

PayNowEnquiryRouter.patch(
  "/admin/:id/status",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can update Pay Now status",
        });
      }


      const { id } =
        req.params;

      const { status } =
        req.body;


      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Pay Now enquiry ID",
        });
      }


      if (!status) {
        return res.status(400).json({
          success: false,
          message:
            "Status is required",
        });
      }


      const allowedStatuses = [
        "new",
        "contacted",
        "payment-link-sent",
        "paid",
        "cancelled",
      ];


      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Pay Now status",

          allowedStatuses,
        });
      }


      const enquiry =
        await PayNowEnquiry.findByIdAndUpdate(
          id,

          {
            $set: {
              status,
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
            "Pay Now enquiry not found",
        });
      }


      return res.status(200).json({
        success: true,

        message:
          "Pay Now enquiry status updated successfully",

        enquiry: {
          id:
            enquiry._id,

          status:
            enquiry.status,

          updatedAt:
            enquiry.updatedAt,
        },
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "update Pay Now enquiry status"
      );
    }
  }
);


// ============================================================
// ADMIN
// PATCH /pay-now/admin/:id/risk
// ============================================================

PayNowEnquiryRouter.patch(
  "/admin/:id/risk",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can update Pay Now risk",
        });
      }


      const { id } =
        req.params;

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
            "Invalid Pay Now enquiry ID",
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
          message:
            "Risk level is required",
        });
      }


      if (
        !allowedRiskLevels.includes(
          riskLevel
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid risk level",

          allowedRiskLevels,
        });
      }


      if (
        (
          riskLevel ===
            "suspicious" ||
          riskLevel ===
            "high-risk"
        ) &&
        (
          !riskReason ||
          typeof riskReason !==
            "string" ||
          !riskReason.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A reason is required when marking a Pay Now enquiry as suspicious or high-risk",
        });
      }


      const enquiry =
        await PayNowEnquiry.findById(
          id
        );


      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Pay Now enquiry not found",
        });
      }


      if (
        !enquiry.leadMetadata
      ) {
        enquiry.leadMetadata =
          {};
      }


      enquiry.leadMetadata.riskLevel =
        riskLevel;


      enquiry.leadMetadata.riskReasons =
        riskLevel === "normal"
          ? []
          : [
              riskReason.trim(),
            ];


      await enquiry.save();


      return res.status(200).json({
        success: true,

        message:
          "Pay Now enquiry risk updated successfully",

        enquiry: {
          id:
            enquiry._id,

          riskLevel:
            enquiry.leadMetadata
              .riskLevel,

          riskReasons:
            enquiry.leadMetadata
              .riskReasons,

          updatedAt:
            enquiry.updatedAt,
        },
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "update Pay Now enquiry risk"
      );
    }
  }
);


// ============================================================
// ADMIN
// PATCH /pay-now/admin/:id/notes
// ============================================================

PayNowEnquiryRouter.patch(
  "/admin/:id/notes",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can update Pay Now notes",
        });
      }


      const { id } =
        req.params;

      const { adminNotes } =
        req.body;


      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Pay Now enquiry ID",
        });
      }


      if (
        adminNotes !== null &&
        adminNotes !== undefined &&
        typeof adminNotes !==
          "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Admin notes must be a string",
        });
      }


      const enquiry =
        await PayNowEnquiry.findByIdAndUpdate(
          id,

          {
            $set: {
              adminNotes:
                adminNotes?.trim() ||
                null,
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
            "Pay Now enquiry not found",
        });
      }


      return res.status(200).json({
        success: true,

        message:
          "Pay Now enquiry notes updated successfully",

        enquiry: {
          id:
            enquiry._id,

          adminNotes:
            enquiry.adminNotes,

          updatedAt:
            enquiry.updatedAt,
        },
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "update Pay Now enquiry notes"
      );
    }
  }
);


// ============================================================
// ADMIN
// DELETE /pay-now/admin/:id
// ============================================================

PayNowEnquiryRouter.delete(
  "/admin/:id",
  UserMiddleWare,
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only admins can delete Pay Now enquiries",
        });
      }


      const { id } =
        req.params;


      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Pay Now enquiry ID",
        });
      }


      const enquiry =
        await PayNowEnquiry.findByIdAndDelete(
          id
        );


      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message:
            "Pay Now enquiry not found",
        });
      }


      return res.status(200).json({
        success: true,

        message:
          "Pay Now enquiry deleted successfully",

        data: {
          id:
            enquiry._id,

          name:
            enquiry.customer?.name,

          email:
            enquiry.customer?.email,

          amount:
            enquiry.amount,
        },
      });

    } catch (error) {
      return handlePayNowError(
        error,
        res,
        "delete Pay Now enquiry"
      );
    }
  }
);


module.exports = PayNowEnquiryRouter;