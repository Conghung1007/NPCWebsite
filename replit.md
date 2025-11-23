# Overview

This is a Vietnamese business website for N&P Company (Công ty TNHH N&P), a professional service company offering visa services, study abroad consulting, Japanese language training, and online examination system. The application is built as a full-stack React application with Express.js backend, designed to showcase the company's three core services with a modern, professional interface.

The website serves as a comprehensive digital presence for N&P Company, featuring service pages, contact forms, testimonials, company information, and a complete online exam system with point-based scoring. The site focuses on three main services: visa processing, study abroad consulting, and Japanese language training. It's designed to be mobile-responsive and SEO-friendly to attract potential customers seeking international services and educational assessments.

# Recent Changes

**November 2025 - Audio Upload Limit Increased:**
- Increased audio file upload size limit from 10MB to 50MB
- **Backend Updates (server/routes.ts)**: Updated all audio upload endpoints
  - Global multer limit: 50MB
  - /api/description-audio/upload-direct: validation and maxSizeBytes updated
  - /api/temp-description-audio/upload: validation and maxSizeBytes updated
  - /api/audio/upload-direct: maxSizeBytes updated
  - /api/audio/upload: validation and maxSizeBytes updated
- **Impact**: Users can now upload larger audio files for question descriptions and exam content

**November 2025 - Audio Player Cache Fix:**
- Fixed bug where audio player showed old audio after uploading new file
- **Root Cause**: Browser caching audio element without key prop
- **Frontend Fix (QuestionBankManager.tsx)**: Added `key={audioUrl}` to audio element
- **Impact**: Audio player now immediately reflects newly uploaded audio files

**November 2025 - Exam Question Cache Invalidation Fix:**
- Fixed bug where updated questions (with new images) not showing in exam-taking page
- **Root Cause**: TanStack Query cache not invalidated for `/api/exams/:id/questions` after question updates
- **Frontend Fix (QuestionBankManager.tsx)**: Added cache invalidation predicate to clear all exam question caches
- Invalidates both `/api/questions` and all `/api/exams/*/questions` caches after CREATE/UPDATE
- **Impact**: Exam pages now immediately show latest question data after edits (including new images)

**November 2025 - Sub-Question Duplication Fix:**
- Fixed critical bug where editing parent questions with sub-questions created duplicates
- **Root Cause**: Backend DELETE-all-and-CREATE pattern + Frontend not sending sub-question IDs
- **Frontend Fix (QuestionBankManager.tsx)**: Now includes sub-question `id` field in UPDATE payload
- **Backend Fix (server/routes.ts)**: Intelligent UPDATE/CREATE/DELETE logic in PUT /api/questions/:id
  - UPDATE existing sub-questions when `id` matches
  - CREATE new sub-questions when `id` is missing
  - DELETE removed sub-questions not in payload
  - No longer deletes all sub-questions and recreates them
- **Database Cleanup**: Removed 5 duplicate sub-questions from question `9c36e98d-2213-44cd-b33e-0baaa507dea8`
- **Impact**: Prevents duplicate sub-questions when editing questions with media uploads

**November 2025 - Question Content Images (imageUrls) Backend Fix:**
- Fixed critical backend bug in imageUrls array processing for question content images
- POST /api/questions: Added proper temp-to-permanent migration for imageUrls arrays using existing helper function
- PUT /api/questions: Added undefined guards to preserve existing imageUrls when field not provided in request
- Supports all temp URL formats: /api/temp-question-images/, /api/qbank-temp-images/, /api/exam-temp-images/
- Applied consistently to parent questions, sub-questions, and standalone questions
- Files now correctly moved from temporary R2 storage to permanent storage
- Prevents data loss when updating questions without modifying imageUrls field

**November 2025 - Question Title Feature:**
- Added optional `questionTitle` field to questions for easy identification and searching
- Database: Added `question_title` TEXT column to questions table
- Backend: Updated POST and PUT /api/questions routes to handle questionTitle for both parent and standalone questions
- Frontend (QuestionBankManager): 
  - Language and Category fields now displayed in same row (grid-cols-2) for better space utilization
  - New "Tiêu đề câu hỏi" input field added between category and description
  - Placeholder text: "Nhập tên câu hỏi ngắn gọn dễ tìm"
  - Search functionality extended to search across questionTitle, questionText, and description
  - Form properly loads/saves questionTitle in both create and edit modes

**November 2025 - Question Sets Feature:**
- **Frontend (create-exam.tsx):** Implemented Question Sets UI allowing multiple named question groups per section
  - Unified dialogState fix: Replaced 3 async states with single synchronized object to prevent race conditions
  - Index-based O(1) operations: getSectionIndex/getQuestionSetIndex utilities for performance
  - Defensive guards with toast notifications for validation errors
  - Each section can have multiple question sets with custom names
  - Questions organized within sets for flexible grouping
- **Frontend (exam-taking.tsx):** Question Set Display and Shuffle Logic
  - deriveExamSections() now attaches questionSetName to each question during section derivation
  - Question set name displayed in green box above each question during exam taking
  - Total question count includes all sub-questions (displayed in header as "Tổng: X câu (kể cả câu con)")
  - Supports both legacy questions (no set name) and new questionSets structure
  - Shuffle logic: Questions are shuffled within each question set only (not across entire section)
  - Legacy exams (without question sets) still shuffle all questions in the section
- **Backend (server/routes.ts):** Full backward compatibility migration system
  - migrateLegacySections(): Auto-converts legacy questionIds → questionSets on read (GET routes)
  - extractQuestionIds(): Flattens questionSets or returns legacy questionIds (validation/storage)
  - All consumers updated: exam creation, attempt details, legacy field population
  - Schema validation for questionSets structure before persistence
  - Documentation added for future developers using exam.sections data

**November 2025 - Decimal Point Support:**
- Updated points system to support decimal values (e.g., 1.5, 2.25, 0.5)
- Database: Changed `points` column from INTEGER to NUMERIC(10,2)
- Validation: Minimum points changed from 1 to 0.1
- UI: Input step changed from 1 to 0.1 for decimal input support
- Parsing: Changed from parseInt to parseFloat

**November 2025 - QuestionBankManager UI Improvements:**
- Moved points input field to same row as question header ("Câu hỏi X")
- Points field now displays inline with centered input (width: 20px)
- Fixed bug: Form now properly resets when switching from edit to create mode
- Added handleOpenCreate() to ensure clean form state when creating new questions

**November 2025 - Point-Based Scoring System:**
- Implemented comprehensive point-based scoring where each question has configurable point value
- Questions default to 1 point for backward compatibility with legacy data
- Exam scoring now sums points from correct answers instead of counting number of correct answers
- Pass/fail validation compares earned points against passing score thresholds (both section and exam level)
- Updated UI copy in exam creation/editing to clarify point-based thresholds
- Fixed point parsing: All point values from database are now parsed to numbers (parseFloat) in both exam-taking and exam-result pages
- Result display updated: Shows earned points/total points instead of correct answers/total questions throughout the interface

# User Preferences

Preferred communication style: Simple, everyday language.
Color scheme: Green theme (updated August 2025 - primary: hsl(142, 76%, 36%), accent: hsl(142, 69%, 58%))
Navigation: Service pages displayed directly in header (About Us page removed - August 2025)
Typography: Increased font sizes throughout the site for better readability (August 2025)
Storage: Multi-provider object storage system supporting Replit Object Storage and multiple Cloudflare R2 accounts (August 2025)
Inline Text Editing: Implemented across all main pages for Manager and Admin roles with hover-to-edit functionality (August 2025)
Mobile Optimization: Comprehensive responsive design improvements for all components (August 2025)
Scroll to Top: Smooth scroll-to-top button with responsive design and performance optimization (August 2025)

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with dedicated pages for each service
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack Query for server state management
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **API Structure**: RESTful API with dedicated routes for contact form submissions
- **Data Storage**: In-memory storage implementation with interface for future database integration
- **Database Schema**: Drizzle ORM with PostgreSQL schema definitions for users and contact requests
- **Request Handling**: Express middleware for JSON parsing, CORS, and request logging

## Data Storage Solutions
- **ORM**: Drizzle ORM configured for PostgreSQL with type-safe schema definitions
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Storage Interface**: Abstract storage interface allowing for easy switching between in-memory and persistent storage
- **Migrations**: Drizzle migrations configured in dedicated migrations directory
- **Object Storage**: Multi-provider system supporting Replit Object Storage and external Cloudflare R2 accounts
- **Media Upload**: Presigned URL-based upload system with configurable storage providers

## Authentication and Authorization
- User authentication system with role-based access control (user, manager, admin)
- Session management with PostgreSQL session storage
- Authentication middleware protecting admin routes and edit permissions
- Inline text editing permissions restricted to Manager and Admin roles

## Exam System Architecture
- **Question Management**: QuestionBankManager with support for parent questions and sub-questions
- **Point System**: Each question (parent and sub-questions) has configurable point value (decimal >= 0.1, default 1.0)
  - Database: NUMERIC(10,2) supporting up to 2 decimal places
  - Examples: 1.0, 1.5, 2.25, 0.5
  - Minimum value: 0.1
- **Scoring Logic**: 
  - Section score = sum of points from all correct answers in that section
  - Total exam score = sum of all section scores (not average)
  - Legacy questions without explicit points default to 1 point each
- **Pass/Fail Validation**:
  - Section fails if earned points < section.passingScore
  - Exam fails if any section fails OR total earned points < exam.passingScore
  - Passing scores are point-based thresholds, not percentage-based
- **Exam Taking Flow**: exam-taking.tsx calculates scores in real-time based on points
- **Result Display**: exam-result.tsx shows earned/total points with bilingual Japanese/English headers

## External Dependencies
- **Database**: Neon Database serverless PostgreSQL (@neondatabase/serverless)
- **UI Components**: Extensive Radix UI component collection for accessible UI primitives
- **Development**: Replit-specific development tools and cartographer for enhanced development experience
- **Build Tools**: ESBuild for server bundling, Vite for client bundling
- **Validation**: Zod for runtime type validation and schema definitions