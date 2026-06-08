const express = require("express");
const router  = express.Router();
const { protect, studentOnly } = require("../middleware/auth");
const ctrl = require("../controllers/studentController");

router.use(protect, studentOnly);

router.get ("/dashboard",              ctrl.getStudentDashboard);
router.get ("/exams",                  ctrl.getAvailableExams);
router.get ("/exams/:id",              ctrl.getExamToTake);
router.post("/exams/:id/submit",       ctrl.submitExam);
router.get ("/results",                ctrl.getMyResults);
router.get ("/results/:id",            ctrl.getResultById);

module.exports = router;
