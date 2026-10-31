const express = require("express");
const mongoose = require("mongoose");
const bcrypt=require("bcryptjs");
const User = require("../models/User");
const validation=require("../utils/validation");
const jwt=require("jsonwebtoken");
const UserMiddleWare=require("../middleware/UserMiddleWare")

const AuthRouter = express.Router();

AuthRouter.get("/admins", UserMiddleWare, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view admin accounts.",
      });
    }

    const admins = await User.find({
      role: "admin",
    })
      .select("-password -tokenVersion")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: admins.length,
      admins,
    });
  } catch (error) {
    console.error("Get admins error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admins.",
    });
  }
});


AuthRouter.post("/create",UserMiddleWare,async(req,res)=>{
    try{
        if (req.user.role !== "admin") {
            return res.status(403).json({
                message: "Only admins can create another admin",
            });
        }
        validation(req.body);

         const { name, email, password } = req.body;

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email });

        if (existingAdmin) {
        return res.status(409).json({
            message: "Admin with this email already exists",
        });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        // Create admin
        const newAdmin = await User.create({
            name,
            email,
            password:hashedPassword,
            role: "admin",
        });

        return res.status(201).json({
            message: "Admin created successfully",
            admin: {
                id: newAdmin._id,
                name: newAdmin.name,
                email: newAdmin.email,
                role: newAdmin.role,
            },
        });

    }
    catch(err){
        console.error("Error creating admin:", err);
        return res.status(500).json({
            message: "Failed to create admin",
        });
    }
})
  
AuthRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await User.findOne({ email });

    if (!admin || admin.role !== "admin") {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, admin.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role, tokenVersion: admin.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    admin.lastLogin = new Date();
    await admin.save();

    return res.status(200).json({
      message: "Admin login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ message: "Something went wrong while logging in" });
  }
});

AuthRouter.get("/me", UserMiddleWare, async (req, res) => {
    try {
        const admin = await User.findById(req.user.id).select("-password");

        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
            });
        }

        if (admin.role !== "admin") {
            return res.status(403).json({
                message: "Access denied",
            });
        }

        return res.status(200).json({
            message: "Admin authenticated",
            admin,
        });

    } catch (error) {
        console.error("Admin /me error:", error);

        return res.status(500).json({
            message: "Something went wrong",
        });
    }
});


AuthRouter.patch("/admins/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can update admin accounts.",
        });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid admin ID.",
        });
      }

      const admin = await User.findOne({
        _id: id,
        role: "admin",
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found.",
        });
      }

      const {
        name,
        email,
        password,
      } = req.body;

      if (name !== undefined) {
        if (
          typeof name !== "string" ||
          !name.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Admin name cannot be empty.",
          });
        }

        admin.name = name.trim();
      }

      if (email !== undefined) {
        if (
          typeof email !== "string" ||
          !email.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Admin email cannot be empty.",
          });
        }

        const normalizedEmail =
          email.trim().toLowerCase();

        // Check whether another admin already
        // uses this email.
        const existingAdmin =
          await User.findOne({
            email: normalizedEmail,
            _id: { $ne: id },
          });

        if (existingAdmin) {
          return res.status(409).json({
            success: false,
            message:
              "Another admin already uses this email.",
          });
        }

        admin.email = normalizedEmail;
      }

      if (password !== undefined) {
        if (
          typeof password !== "string" ||
          !password.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Password cannot be empty.",
          });
        }

        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            message:
              "Password must be at least 6 characters.",
          });
        }

        admin.password =
          await bcrypt.hash(password, 10);

        admin.tokenVersion += 1;
      }

      await admin.save();

      return res.status(200).json({
        success: true,
        message: "Admin updated successfully.",
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          lastLogin: admin.lastLogin,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update admin error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update admin.",
      });
    }
  }
);

AuthRouter.post("/logout",UserMiddleWare,async (req, res) => {
    try {
      const admin = await User.findById(req.user.id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found.",
        });
      }

      // Invalidate all previously issued tokens
      admin.tokenVersion += 1;

      await admin.save();

      return res.status(200).json({
        success: true,
        message: "Admin logged out successfully.",
      });

    } catch (error) {
      console.error(
        "Admin logout error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while logging out.",
      });
    }
  }
);


AuthRouter.delete("/admins/:id",UserMiddleWare,async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can delete admin accounts.",
        });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid admin ID.",
        });
      }

      if (String(req.user.id) === String(id)) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot delete your own admin account.",
        });
      }

      const admin = await User.findOne({
        _id: id,
        role: "admin",
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found.",
        });
      }
      
      await User.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: "Admin deleted successfully.",
      });
    } catch (error) {
      console.error("Delete admin error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete admin.",
      });
    }
  }
);

module.exports = AuthRouter;
