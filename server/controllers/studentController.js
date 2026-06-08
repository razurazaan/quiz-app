const Exam   = require("../models/Exam");
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
const sanitizeQuestion = (question) => {
  const { correctAnswer, explanation, ...safeQuestion } = normalizeQuestion(question);
  return safeQuestion;
};

// @GET /api/student/exams  — available published exams for this student
exports.getAvailableExams = async (req, res) => {
  try {
    const now = new Date();
    const exams = await Exam.find({
      status: { $in: ["published", "ongoing"] },
      startDate: { $lte: now },
      endDate:   { $gte: now },
    }).select("-questions.correctAnswer -questions.explanation");

    // attach attempt info
    const attemptMap = {};
    const myResults  = await Result.find({ student: req.user._id }).select("exam attemptNumber");
    myResults.forEach(r => (attemptMap[r.exam.toString()] = r.attemptNumber));

    const enriched = exams.map(e => {
      const exam = e.toObject();
      return {
        ...exam,
        questions: (exam.questions || []).map(sanitizeQuestion),
        myAttempts: attemptMap[e._id.toString()] || 0,
        canAttempt: (attemptMap[e._id.toString()] || 0) < e.maxAttempts,
      };
    });

    res.json({ success: true, exams: enriched });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const normalizeMathAnswer = (value) => {
  if (value === null || value === undefined) return "";

  let text = String(value);
  const match = text.match(/data-l="([^"]*)"/i);
  if (match && match[1]) text = match[1];

  return text
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
};

// @GET /api/student/exams/:id  — get exam to take (no answers exposed)
exports.getExamToTake = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const now = new Date();
    const isOpen = exam.status === "published" || exam.status === "ongoing";
    const withinWindow = now >= new Date(exam.startDate) && now <= new Date(exam.endDate);
    if (!isOpen || !withinWindow) {
      return res.status(400).json({ success: false, message: "Exam is not available at this time" });
    }

    // Check attempts
    const attempts = await Result.countDocuments({ student: req.user._id, exam: exam._id });
    if (attempts >= exam.maxAttempts)
      return res.status(400).json({ success: false, message: "Max attempts reached" });

    // Shuffle if enabled
    let questions = exam.questions.map(normalizeQuestion);
    if (exam.shuffleQuestions) questions = questions.sort(() => Math.random() - 0.5);
    if (exam.shuffleOptions) {
      questions = questions.map(q => ({
        ...q,
        options: [...(q.options || [])].sort(() => Math.random() - 0.5),
      }));
    }

    res.json({
      success: true,
      exam: {
        ...exam.toObject(),
        questions: questions.map(sanitizeQuestion),
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @POST /api/student/exams/:id/submit
exports.submitExam = async (req, res) => {
  try {
    const { answers = [], startedAt, status } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: "Invalid answers payload" });
    }

    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const now = new Date();
    const isOpen = exam.status === "published" || exam.status === "ongoing";
    const withinWindow = now >= new Date(exam.startDate) && now <= new Date(exam.endDate);
    if (!isOpen || !withinWindow) {
      return res.status(400).json({ success: false, message: "Exam is not available at this time" });
    }

    const attempts = await Result.countDocuments({ student: req.user._id, exam: exam._id });
    if (attempts >= exam.maxAttempts) {
      return res.status(400).json({ success: false, message: "Max attempts reached" });
    }

    const attemptNumber = attempts + 1;

    let obtainedMarks = 0;
    const gradedAnswers = exam.questions.map(originalQuestion => {
      const q = normalizeQuestion(originalQuestion);
      const studentAns = answers.find(a => a.questionId === q._id.toString());
      const selected = studentAns?.selectedAnswer ?? null;
      const correctAnswer = q.correctAnswer ?? "";
      const isCorrect = normalizeMathAnswer(selected) === normalizeMathAnswer(correctAnswer);

      const marksAwarded = isCorrect
        ? q.marks
        : selected
          ? -Math.max(0, exam.negativeMarking || 0)
          : 0;

      obtainedMarks += marksAwarded;

      return {
        questionId: q._id,
        questionText: q.questionText,
        selectedAnswer: selected,
        correctAnswer,
        isCorrect,
        marksAwarded,
      };
    });

    obtainedMarks = Math.max(0, obtainedMarks);
    const percentage  = parseFloat(((obtainedMarks / exam.totalMarks) * 100).toFixed(2));
    const isPassed    = obtainedMarks >= exam.passingMarks;
    const submittedAt = new Date();
    const timeTaken   = Math.round((submittedAt - new Date(startedAt)) / 1000);

    const result = await Result.create({
      student: req.user._id, exam: exam._id,
      answers: gradedAnswers,
      totalMarks: exam.totalMarks, obtainedMarks, percentage, isPassed,
      startedAt, submittedAt, timeTaken,
      attemptNumber, status: status || "completed",
    });

    const populated = await result.populate("exam", "title subject showResult allowReview passingMarks");

    res.status(201).json({ success: true, result: populated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @GET /api/student/results  — all my results
exports.getMyResults = async (req, res) => {
  try {
    const results = await Result.find({ student: req.user._id })
      .populate("exam", "title subject totalMarks passingMarks")
      .sort("-createdAt");
    res.json({ success: true, results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @GET /api/student/results/:id  — single result with review
exports.getResultById = async (req, res) => {
  try {
    const result = await Result.findOne({ _id: req.params.id, student: req.user._id })
      .populate("exam", "title subject totalMarks passingMarks allowReview showResult");
    if (!result) return res.status(404).json({ success: false, message: "Result not found" });
    res.json({ success: true, result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @GET /api/student/dashboard
exports.getStudentDashboard = async (req, res) => {
  try {
    const results = await Result.find({ student: req.user._id });
    const passed  = results.filter(r => r.isPassed).length;
    const avgPct  = results.length
      ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(1)
      : 0;
    const availableExams = await Exam.countDocuments({
      status: { $in: ["published", "ongoing"] },
      startDate: { $lte: new Date() }, endDate: { $gte: new Date() },
    });
    res.json({
      success: true,
      stats: { totalAttempts: results.length, passed, failed: results.length - passed, avgPercentage: avgPct, availableExams },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
