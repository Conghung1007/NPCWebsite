# Overview

This is a Vietnamese business website for N&P Company (Công ty TNHH N&P), a professional service company offering visa services, study abroad consulting, Japanese language training, and flight ticket sales. The application is built as a full-stack React application with Express.js backend, designed to showcase the company's four core services with a modern, professional interface.

The website serves as a comprehensive digital presence for N&P Company, featuring service pages, contact forms, testimonials, and company information. It's designed to be mobile-responsive and SEO-friendly to attract potential customers seeking international services.

# User Preferences

Preferred communication style: Simple, everyday language.
Color scheme: Green theme (updated August 2025 - primary: hsl(142, 76%, 36%), accent: hsl(142, 69%, 58%))
Navigation: Service pages displayed directly in header (About Us page removed - August 2025)
Typography: Increased font sizes throughout the site for better readability (August 2025)
Storage: Multi-provider object storage system supporting Replit Object Storage and multiple Cloudflare R2 accounts (August 2025)

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
- Currently using basic user schema with username/password fields
- Session management structure in place but not fully implemented
- No active authentication middleware currently deployed

## External Dependencies
- **Database**: Neon Database serverless PostgreSQL (@neondatabase/serverless)
- **UI Components**: Extensive Radix UI component collection for accessible UI primitives
- **Development**: Replit-specific development tools and cartographer for enhanced development experience
- **Build Tools**: ESBuild for server bundling, Vite for client bundling
- **Validation**: Zod for runtime type validation and schema definitions