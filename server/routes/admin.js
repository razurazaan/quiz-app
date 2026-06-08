const express = require("express");
const router  = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const ctrl = require("../controllers/adminController");

router.use(protect, adminOnly);

// Dashboard
router.get("/dashboard",                     ctrl.getDashboardStats);

// Exams
router.get   ("/exams",                      ctrl.getAllExams);
router.post  ("/exams",                      ctrl.createExam);
router.get   ("/exams/:id",                  ctrl.getExamById);
router.put   ("/exams/:id",                  ctrl.updateExam);
router.delete("/exams/:id",                  ctrl.deleteExam);
router.put   ("/exams/:id/publish",          ctrl.publishExam);

// Questions
router.post  ("/exams/:id/questions",        ctrl.addQuestion);
router.put   ("/exams/:id/questions/:qId",   ctrl.updateQuestion);
router.delete("/exams/:id/questions/:qId",   ctrl.deleteQuestion);

// Students
router.get("/students",                      ctrl.getAllStudents);
router.put("/students/:id/toggle",           ctrl.toggleStudentStatus);

// Results
router.get("/results",                       ctrl.getAllResults);
router.get("/results/exam/:examId",          ctrl.getExamResults);

module.exports = router;
