const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "7d" });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({ success: true, token, user });
};

// @POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, studentId, department, semester } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: "Email already registered" });

    // Strip empty strings so sparse indexes (studentId) work correctly.
    // Passing "" is treated as a real value by MongoDB; undefined is ignored.
    const userData = {
      name, email, password, role,
      ...(studentId  && { studentId }),
      ...(department && { department }),
      ...(semester   && { semester: Number(semester) }),
    };

    const user = await User.create(userData);
    sendToken(user, 201, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: "Account deactivated" });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    sendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    const { currentPassword, newPassword } = req.body;
    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: "Current password incorrect" });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};