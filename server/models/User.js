const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true },
    password:    { type: String, required: true, minlength: 6 },
    role:        { type: String, enum: ["admin", "student"], default: "student" },
    studentId:   { type: String, unique: true, sparse: true },   // for students
    department:  { type: String },
    semester:    { type: Number },
    profilePic:  { type: String, default: "" },
    isActive:    { type: Boolean, default: true },
    lastLogin:   { type: Date },
  },
  { timestamps: true }
);

// Sanitize optional string fields — convert "" to undefined so
// the sparse unique index on studentId ignores missing values.
// Without this, two admins both get studentId:"" and collide.
userSchema.pre("save", async function (next) {
  if (this.studentId === "") this.studentId = undefined;
  if (this.department === "") this.department = undefined;

  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);