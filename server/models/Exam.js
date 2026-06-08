const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  questionText:  { type: String, required: true },
  questionType:  { type: String, enum: ["mcq", "true_false"], default: "mcq" },
  options:       [{ label: String, text: String }],   // A, B, C, D
  correctAnswer: { type: String, required: true },     // option label or True/False
  marks:         { type: Number, default: 1 },
  explanation:   { type: String },                     // shown after result
  image:         { type: String },                     // optional image URL
});

const examSchema = new mongoose.Schema(
  {
    title:          { type: String, required: true, trim: true },
    subject:        { type: String, required: true },
    description:    { type: String },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Scheduling
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, required: true },
    startTime:      { type: String, required: true },   // "09:00"
    endTime:        { type: String, required: true },   // "10:00"
    duration:       { type: Number, required: true },   // minutes

    // Access
    targetDepartment: { type: String },
    targetSemester:   { type: Number },
    passingMarks:     { type: Number, required: true },
    totalMarks:       { type: Number, default: 0 },

    // Settings
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions:   { type: Boolean, default: false },
    showResult:       { type: Boolean, default: true },  // immediately show result
    allowReview:      { type: Boolean, default: false }, // review after submit
    negativeMarking:  { type: Number, default: 0 },      // marks deducted per wrong

    // Status
    status:           { type: String, enum: ["draft", "published", "ongoing", "completed"], default: "draft" },
    maxAttempts:      { type: Number, default: 1 },

    questions:        [questionSchema],
  },
  { timestamps: true }
);

// Auto calculate totalMarks
examSchema.pre("save", function (next) {
  this.totalMarks = this.questions.reduce((sum, q) => sum + q.marks, 0);
  next();
});

module.exports = mongoose.model("Exam", examSchema);
