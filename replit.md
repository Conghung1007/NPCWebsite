# Overview

This project is a Vietnamese business website for N&P Company (Công ty TNHH N&P), a professional service company specializing in visa services, study abroad consulting, Japanese language training, and online examination systems. The application is a full-stack React and Express.js solution designed to present the company's core services with a modern and professional aesthetic. It aims to provide a comprehensive digital presence, including service pages, contact forms, testimonials, company information, and an advanced online exam system with point-based scoring. The website is built to be mobile-responsive and SEO-friendly to attract a broad audience seeking international services and educational assessments.

# User Preferences

Preferred communication style: Simple, everyday language.
Color scheme: Green theme (primary: hsl(142, 76%, 36%), accent: hsl(142, 69%, 58%))
Navigation: Service pages displayed directly in header
Typography: Increased font sizes throughout the site for better readability
Storage: Multi-provider object storage system supporting Replit Object Storage and multiple Cloudflare R2 accounts
Inline Text Editing: Implemented across all main pages for Manager and Admin roles with hover-to-edit functionality
Mobile Optimization: Comprehensive responsive design improvements for all components
Scroll to Top: Smooth scroll-to-top button with responsive design and performance optimization

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, Vite
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Forms**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **API Structure**: RESTful API
- **Database Interaction**: Drizzle ORM for PostgreSQL schema definitions
- **Request Handling**: Express middleware for JSON parsing, CORS, and logging

## Data Storage Solutions
- **ORM**: Drizzle ORM for PostgreSQL
- **Database**: PostgreSQL (configured via `DATABASE_URL`)
- **Object Storage**: Multi-provider system supporting Replit Object Storage and Cloudflare R2 accounts
- **Media Upload**: Presigned URL-based upload system

## Authentication and Authorization
- User authentication with role-based access control (user, manager, admin)
- Session management with PostgreSQL session storage
- Authentication middleware for route protection and edit permissions

## Exam System Architecture
- **Question Management**: Supports parent questions and sub-questions, each with configurable decimal point values (min 0.1, default 1.0).
- **Scoring Logic**: Sums points from correct answers. Section and total exam scores are point-based. Legacy questions default to 1 point.
- **Pass/Fail Validation**: Based on earned points against section and exam passing score thresholds.
- **Question Sets**: Allows multiple named question groups per section, with questions shuffled within their sets. Backward compatible with legacy exams.
- **UI/UX**: Automatic smooth scroll to top when navigating questions in exam, improved audio player caching, immediate cache invalidation for updated questions in exams.

# External Dependencies

- **Database**: Neon Database serverless PostgreSQL (`@neondatabase/serverless`)
- **UI Components**: Radix UI
- **Development**: Replit-specific development tools, Cartographer
- **Build Tools**: ESBuild (server), Vite (client)
- **Validation**: Zod