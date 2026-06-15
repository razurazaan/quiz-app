# 📝 QuizMaster Pro — MERN Stack Quiz Application

A full-featured quiz/exam platform built with MongoDB, Express, React, and Node.js.

---

## 🚀 Features

### Admin Panel
- ✅ Secure JWT-based admin login
- ✅ Dashboard with live statistics (students, exams, pass rate)
- ✅ Create exams with full configuration:
  - Title, subject, description
  - Start/end date and time scheduling
  - Duration timer (in minutes)
  - Passing marks & negative marking
  - Target department & semester
  - Max attempts per student
  - Shuffle questions / shuffle options
  - Show result immediately / allow answer review
- ✅ Add 3 question types: MCQ, True/False, Short Answer
- ✅ Publish / save as draft / delete exams
- ✅ Edit existing exams and questions
- ✅ Manage students (view, block/unblock)
- ✅ View all results with per-exam analytics

### Student Portal
- ✅ Secure JWT-based student login
- ✅ Dashboard with personal stats and available exams
- ✅ Take exams with:
  - Live countdown timer
  - Question palette (jump to any question)
  - Real-time answered/unanswered tracking
  - Auto-submit on time expiry
- ✅ View detailed result with grade and percentage
- ✅ Answer review (if enabled by admin)
- ✅ History of all past attempts

---

## 📁 Project Structure

```
quiz-app/
├── server/                   # Express + MongoDB backend
│   ├── config/
│   │   └── db.js             # MongoDB connection
│   ├── middleware/
│   │   └── auth.js           # JWT protect + role guards
│   ├── models/
│   │   ├── User.js           # Admin & Student schema
│   │   ├── Exam.js           # Exam + embedded questions
│   │   └── Result.js         # Attempt result + graded answers
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminController.js
│   │   └── studentController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── admin.js
│   │   └── student.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── client/                   # React + Vite frontend
    ├── src/
    │   ├── api/
    │   │   └── axios.js      # Axios instance with interceptors
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── hooks/
    │   │   └── useTimer.js   # Countdown timer hook
    │   ├── utils/
    │   │   └── helpers.js    # formatDate, gradeColor, etc.
    │   ├── components/
    │   │   └── common/
    │   │       ├── Sidebar.jsx
    │   │       └── PrivateRoute.jsx
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   ├── Login.jsx
    │   │   │   └── Register.jsx
    │   │   ├── admin/
    │   │   │   ├── Dashboard.jsx
    │   │   │   ├── CreateExam.jsx
    │   │   │   ├── EditExam.jsx
    │   │   │   ├── ManageExams.jsx
    │   │   │   ├── ManageStudents.jsx
    │   │   │   └── ExamResults.jsx
    │   │   └── student/
    │   │       ├── Dashboard.jsx
    │   │       ├── AvailableExams.jsx
    │   │       ├── TakeExam.jsx
    │   │       ├── MyResults.jsx
    │   │       └── ResultDetail.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## ⚙️ Setup & Run

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)

### 1. Clone & install
```bash
git clone <repo-url>
cd quiz-app
npm run install:all
```

### 2. Configure environment
```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 3. Run (both frontend & backend)
```bash
cd ..
npm run dev
```

- **Backend:** http://localhost:5000
- Frontend:[http://localhost:5173](https://quiz-app-amber-iota-30.vercel.app/login)

---

## Vercel Deployment

Use one of these setups:

### Full app from one Vercel project
- Root Directory: leave empty / repository root
- Config used: `vercel.json`
- Install Command: `npm install --prefix client && npm install --prefix server`
- Build Command: `npm run build --prefix client`
- Output Directory: `client/dist`
- Frontend is served from `client/dist`
- Backend is served under `/api`

### Backend-only Vercel project
- Root Directory: `server`
- Config used: `server/vercel.json`
- Install Command: `npm install`
- Build Command: `npm run vercel-build`
- Output Directory: leave empty
- Backend URL example: `https://your-project.vercel.app/api/health`

Do not use the root install command (`npm install --prefix client && npm install --prefix server`) when the Vercel Root Directory is `server`; from that folder those prefix paths do not exist.
If that command appears in Vercel logs for a backend-only project, remove the custom Install Command override in Project Settings or replace it with `npm install`.

Set these Environment Variables in Vercel Project Settings:

```env
MONGO_URI=your-mongodb-atlas-uri
JWT_SECRET=your-long-random-secret
JWT_EXPIRE=7d
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain.vercel.app
```

Do not depend on `server/.env` in production. Vercel reads environment variables from the dashboard.

---

## 🔑 API Routes

### Auth (`/api/auth`)
| Method | Route            | Access  |
|--------|-----------------|---------|
| POST   | /register        | Public  |
| POST   | /login           | Public  |
| GET    | /me              | Private |
| PUT    | /change-password | Private |

### Admin (`/api/admin`) — requires admin JWT
| Method | Route                         | Description        |
|--------|------------------------------|--------------------|
| GET    | /dashboard                   | Stats overview     |
| GET    | /exams                       | List all exams     |
| POST   | /exams                       | Create exam        |
| PUT    | /exams/:id                   | Update exam        |
| DELETE | /exams/:id                   | Delete exam        |
| PUT    | /exams/:id/publish           | Publish exam       |
| POST   | /exams/:id/questions         | Add question       |
| PUT    | /exams/:id/questions/:qId    | Update question    |
| DELETE | /exams/:id/questions/:qId    | Delete question    |
| GET    | /students                    | List students      |
| PUT    | /students/:id/toggle         | Block/unblock      |
| GET    | /results                     | All results        |
| GET    | /results/exam/:examId        | Per-exam analytics |

### Student (`/api/student`) — requires student JWT
| Method | Route                   | Description         |
|--------|------------------------|---------------------|
| GET    | /dashboard             | Personal stats      |
| GET    | /exams                 | Available exams     |
| GET    | /exams/:id             | Load exam to take   |
| POST   | /exams/:id/submit      | Submit answers      |
| GET    | /results               | My results list     |
| GET    | /results/:id           | Single result       |

---

## 🛠 Tech Stack

| Layer     | Technology           |
|-----------|---------------------|
| Database  | MongoDB + Mongoose  |
| Backend   | Node.js + Express   |
| Auth      | JWT + bcryptjs      |
| Frontend  | React 18 + Vite     |
| Routing   | React Router v6     |
| HTTP      | Axios               |
| Toasts    | react-hot-toast     |
| Fonts     | Syne + DM Sans      |
"# quiz-app" 
