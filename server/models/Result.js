const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  questionId:    { type: mongoose.Schema.Types.ObjectId },
  questionText:  { type: String },
  selectedAnswer:{ type: String },
  correctAnswer: { type: String },
  isCorrect:     { type: Boolean },
  marksAwarded:  { type: Number, default: 0 },
});

const resultSchema = new mongoose.Schema(
  {
    student:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    exam:          { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    answers:       [answerSchema],

    // Score
    totalMarks:    { type: Number, required: true },
    obtainedMarks: { type: Number, required: true },
    percentage:    { type: Number, required: true },
    isPassed:      { type: Boolean, required: true },
    grade:         { type: String },                   // A, B, C, D, F

    // Timing
    startedAt:     { type: Date, required: true },
    submittedAt:   { type: Date, required: true },
    timeTaken:     { type: Number },                   // seconds

    attemptNumber: { type: Number, default: 1 },
    status:        { type: String, enum: ["completed", "timed_out", "abandoned"], default: "completed" },
  },
  { timestamps: true }
);

// Calculate grade before save
resultSchema.pre("save", function (next) {
  const p = this.percentage;
  if      (p >= 90) this.grade = "A+";
  else if (p >= 80) this.grade = "A";
  else if (p >= 70) this.grade = "B";
  else if (p >= 60) this.grade = "C";
  else if (p >= 50) this.grade = "D";
  else              this.grade = "F";
  next();
});

module.exports = mongoose.model("Result", resultSchema);
