const Exam   = require("../models/Exam");
const User   = require("../models/User");
const Result = require("../models/Result");

const MCQ_LABELS = ["A", "B", "C", "D"];
const stripMarkup = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const normalizeQuestionType = (type) => type === "true_false" ? "true_false" : "mcq";
const ensureMcqOptions = (options = [], fallbackAnswer = "") => MCQ_LABELS.map((label, index) => {
  const existing = (options || []).find(option => option.label === label);
  const fallbackText = index === 0 ? stripMarkup(fallbackAnswer) : "";
  return { label, text: existing?.text || fallbackText };
});
const normalizeQuestion = (question = {}) => {
  const plainQuestion = question.toObject ? question.toObject() : question;
  const wasShortAnswer = plainQuestion.questionType === "short_answer";
  const questionType = normalizeQuestionType(plainQuestion.questionType);

  return {
    ...plainQuestion,
    questionType,
    options: ensureMcqOptions(plainQuestion.options, wasShortAnswer ? plainQuestion.correctAnswer : ""),
    correctAnswer: questionType === "true_false"
      ? (plainQuestion.correctAnswer === "False" ? "False" : "True")
      : (MCQ_LABELS.includes(plainQuestion.correctAnswer) ? plainQuestion.correctAnswer : "A"),
  };
};
const normalizeQuestions = (questions = []) => questions.map(normalizeQuestion);
const normalizeExamPayload = (payload = {}) => {
  if (!Array.isArray(payload.questions)) return payload;

  const questions = normalizeQuestions(payload.questions);
  return {
    ...payload,
    questions,
    totalMarks: questions.reduce((sum, q) => sum + Number(q.marks || 0), 0),
  };
};
const serializeExam = (exam) => {
  const examObject = exam.toObject ? exam.toObject() : exam;
  return {
    ...examObject,
    questions: normalizeQuestions(examObject.questions || []),
  };
};

// ────────────── EXAM CRUD ──────────────

// @GET /api/admin/exams
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user._id })
      .populate("createdBy", "name")
      .sort("-createdAt");
    res.json({ success: true, count: exams.length, exams: exams.map(serializeExam) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @GET /api/admin/exams/:id
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate("createdBy", "name");
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, exam: serializeExam(exam) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @POST /api/admin/exams
exports.createExam = async (req, res) => {
  try {
    const exam = await Exam.create(normalizeExamPayload({ ...req.body, createdBy: req.user._id }));
    res.status(201).json({ success: true, exam });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// @PUT /api/admin/exams/:id
exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, normalizeExamPayload(req.body), {
      new: true, runValidators: true,
    });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, exam });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// @DELETE /api/admin/exams/:id
exports.deleteExam = async (req, res) => {
  try {
    await Exam.findByIdAndDelete(req.params.id);
    await Result.deleteMany({ exam: req.params.id });
    res.json({ success: true, message: "Exam deleted" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @PUT /api/admin/exams/:id/publish
exports.publishExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id, { status: "published" }, { new: true }
    );
    res.json({ success: true, exam });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ────────────── QUESTION CRUD ──────────────

// @POST /api/admin/exams/:id/questions
exports.addQuestion = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    exam.questions = normalizeQuestions(exam.questions);
    exam.questions.push(normalizeQuestion(req.body));
    await exam.save();
    res.status(201).json({ success: true, exam });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// @PUT /api/admin/exams/:id/questions/:qId
exports.updateQuestion = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    exam.questions = normalizeQuestions(exam.questions);
    const q = exam.questions.id(req.params.qId);
    if (!q) return res.status(404).json({ success: false, message: "Question not found" });
    Object.assign(q, normalizeQuestion({ ...q.toObject(), ...req.body }));
    await exam.save();
    res.json({ success: true, exam });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// @DELETE /api/admin/exams/:id/questions/:qId
exports.deleteQuestion = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    exam.questions.id(req.params.qId).deleteOne();
    await exam.save();
    res.json({ success: true, message: "Question removed" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ────────────── STUDENTS ──────────────

// @GET /api/admin/students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).sort("-createdAt");
    res.json({ success: true, count: students.length, students });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @PUT /api/admin/students/:id/toggle
exports.toggleStudentStatus = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    student.isActive = !student.isActive;
    await student.save({ validateBeforeSave: false });
    res.json({ success: true, student });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ────────────── RESULTS & ANALYTICS ──────────────

// @GET /api/admin/results
exports.getAllResults = async (req, res) => {
  try {
    const results = await Result.find()
      .populate("student", "name email studentId department")
      .populate("exam", "title subject")
      .sort("-createdAt");
    res.json({ success: true, count: results.length, results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @GET /api/admin/results/exam/:examId
exports.getExamResults = async (req, res) => {
  try {
    const results = await Result.find({ exam: req.params.examId })
      .populate("student", "name email studentId department")
      .sort("-obtainedMarks");

    const stats = {
      total: results.length,
      passed: results.filter(r => r.isPassed).length,
      failed: results.filter(r => !r.isPassed).length,
      avgPercentage: results.length
        ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(2)
        : 0,
      highest: results.length ? Math.max(...results.map(r => r.obtainedMarks)) : 0,
      lowest:  results.length ? Math.min(...results.map(r => r.obtainedMarks)) : 0,
    };

    res.json({ success: true, stats, results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @GET /api/admin/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalStudents, totalExams, totalResults, recentExams] = await Promise.all([
      User.countDocuments({ role: "student" }),
      Exam.countDocuments({ createdBy: req.user._id }),
      Result.countDocuments(),
      Exam.find({ createdBy: req.user._id }).sort("-createdAt").limit(5).select("title status startDate"),
    ]);
    const passRate = totalResults > 0
      ? ((await Result.countDocuments({ isPassed: true })) / totalResults * 100).toFixed(1)
      : 0;

    res.json({ success: true, stats: { totalStudents, totalExams, totalResults, passRate, recentExams } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
