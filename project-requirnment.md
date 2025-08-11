# Recruiter-Only AI Resume Fit Scoring – Step-by-Step Tasks

## 1. Setup Project Environment
- [ ] Initialize a new Next.js (14.2.2) project
- [ ] Install dependencies:
  ```bash
  npm install @mui/material @mui/icons-material @emotion/react @emotion/styled firebase axios
  ```
- [ ] Setup `.env.local` with Firebase & Gemini API keys

---

## 2. Configure Firebase
- [ ] Create Firebase project in console
- [ ] Enable Authentication (Email/Password)
- [ ] Setup Firestore Database
- [ ] Setup Firebase Storage
- [ ] Create `firebaseConfig.js` in project

---

## 3. Public Resume Upload Page (`/`)
- [ ] Create landing page with MUI form
- [ ] Form fields: Name, Email, Phone, Resume File (PDF/DOCX)
- [ ] Validate file type and size
- [ ] On submit:
  - Upload file to Firebase Storage
  - Save metadata to Firestore (`resumes` collection)

---

## 4. Recruiter Login Page (`/login`)
- [ ] Create login form using MUI components
- [ ] Integrate Firebase Auth (email/password)
- [ ] Redirect to `/dashboard` after login

---

## 5. Recruiter Dashboard (`/dashboard`)
- [ ] Fetch all resumes from Firestore
- [ ] Display in MUI DataGrid with columns:
  - Name
  - Email
  - Upload Date
  - Actions: View Resume, Check Fit

---

## 6. View Resume Page (`/dashboard/resume/[id]`)
- [ ] Fetch resume details by ID from Firestore
- [ ] Display parsed info (name, skills, education, experience)
- [ ] Add link/button to download original resume

---

## 7. AI Fit Check Page (`/dashboard/check-fit/[id]`)
- [ ] Fetch resume text (optional: parse on upload)
- [ ] Add textarea for recruiter to enter job description
- [ ] On submit:
  - Send resume text + job description to Gemini API
  - Display AI output:
    - Fit Score (0–100)
    - Reasoning
    - Suggested next steps

---

## 8. AI Integration (Gemini Flash)
- [ ] Create API route in Next.js (`/api/check-fit`)
- [ ] Call Gemini Flash API with system & user prompts
- [ ] Return structured JSON with score & reason

---

## 9. Security & Access Control
- [ ] Protect `/dashboard` and all recruiter pages
- [ ] Redirect unauthenticated users to `/login`
- [ ] Validate file uploads for type and size

---

## 10. Final Touches
- [ ] Responsive design for mobile & desktop
- [ ] Add MUI theme customization
- [ ] Test all flows (upload, login, check fit)
- [ ] Deploy to Vercel or Firebase Hosting
