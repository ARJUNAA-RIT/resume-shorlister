
# AI Resume Matcher - Project Documentation

## 1. Project Overview
**AI Resume Matcher** is a modern recruitment tool designed to streamline the hiring process. It allows HR professionals and recruiters to post job descriptions, upload resume files, and automatically find the best candidates using AI-powered matching algorithms.

The application features a premium, "Next Level" user interface designed for clarity, speed, and ease of use.

## 2. Technical Stack
The project is built using a modern frontend stack ensuring high performance and developer experience:

*   **Framework**: [React](https://react.dev/) (v18)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL + Auth)
*   **Font**: Inter (Google Fonts)

## 3. Core Features

### A. Authentication
*   **Secure Sign-up/Sign-in**: Users can create accounts and log in securely via Supabase Auth.
*   **Modern Interface**: A glass-morphic, split-screen inspired login page with smooth animations.

### B. Dashboard ("Recruitment Reimagined")
*   **Hero Section**: A welcoming landing area with quick access to primary actions.
*   **Quick Actions**:
    *   **Post a New Job**: Opens a modal to create a new job listing and upload JD documents.
    *   **History & Archives**: Navigates to the comprehensive history view.

### C. Job Management
*   **Job Posting**: Create detailed job entries with titles and attached description files.
*   **History View**: A dedicated page to view all past job postings, sorted by date.
*   **Real-time Status**: Track the status of job processing (Processing, Completed, Failed) with visual badges.

### D. AI Matching (Resume Upload)
*   **Bulk Upload**: Upload multiple candidate resumes to a specific job.
*   **Automated Scoring**: The system matches resumes against the job description and provides a relevance score.
*   **Detailed Results**: View matched candidates, download their resumes, and see their fit score.

## 4. UI/UX Design System

The application uses a **Vibrant Yellow & White** premium theme:

*   **Primary Color**: Vibrant Yellow (`bg-yellow-500`) for high-priority actions and accents.
*   **Background**: Pure White (`bg-white`) for a clean, distraction-free interface.
*   **Typography**: **Inter** font family for professional-grade readability.
*   **Interaction**: Deep hover shadows, scale effects on cards, and smooth entry animations (`animate-in`).
*   **Aesthetics**: Glassmorphism, micro-animations, and premium feel.

## 5. Project Structure

```
src/
├── components/
│   ├── Auth.tsx          # Login/Signup screen
│   ├── CreateJob.tsx     # Modal for new job posts
│   ├── Dashboard.tsx     # Main landing page
│   ├── History.tsx       # List of past jobs
│   ├── JobCard.tsx       # Individual job display card
│   └── JobDetails.tsx    # Resume upload & matching results
├── contexts/
│   └── AuthContext.tsx   # User authentication state
├── lib/
│   └── supabase.ts       # Database client configuration
├── App.tsx               # Root component & routing
└── index.css             # Global styles & Tailwind directives
```

## 6. Setup & Installation

1.  **Prerequisites**: Node.js installed.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Variables**:
    Ensure a `.env` file exists with your Supabase credentials:
    ```
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:5173`.
