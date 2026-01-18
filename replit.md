# JuniorHit - Tennis Hitting Partner Platform

## Overview

JuniorHit is a web and mobile application designed to help junior USTA tennis players find hitting partners. The platform allows players to create profiles with their UTR (Universal Tennis Rating), search for compatible partners, and schedule hitting sessions through a request system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with custom tennis-themed color palette
- **UI Components**: shadcn/ui component library (New York style)
- **Animations**: Framer Motion for page transitions
- **Build Tool**: Vite with React plugin

The frontend follows a page-based structure with shared components. Key pages include Dashboard, FindPlayers, Requests, and ProfileSetup. Authentication state is managed through a custom `useAuth` hook that interfaces with the Replit Auth system.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints defined in shared route contracts
- **Validation**: Zod schemas for request/response validation
- **Authentication**: Replit Auth integration via OpenID Connect with Passport.js

The server uses a modular structure with routes, storage layer, and auth integration separated into distinct modules. All API routes are prefixed with `/api/` and require authentication.

### Data Storage
- **Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Session Store**: PostgreSQL-backed sessions via connect-pg-simple

Database schema includes:
- `users` - Authentication user records (managed by Replit Auth)
- `sessions` - Session storage for authentication
- `profiles` - Player profiles with UTR rating, bio, location, availability
- `hitRequests` - Hitting session requests between players with status tracking

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Drizzle table definitions and Zod schemas
- `routes.ts` - API route contracts with path, method, and validation schemas
- `models/auth.ts` - Authentication-related table definitions

### Mobile Support
- **Framework**: React Native with Expo
- **Navigation**: React Navigation (native stack)
- **Purpose**: Companion mobile app sharing logic with web (in early development)

## External Dependencies

### Database
- **Neon PostgreSQL**: Serverless Postgres database accessed via `@neondatabase/serverless` package
- **Connection**: Configured via `DATABASE_URL` environment variable

### Authentication
- **Replit Auth**: OpenID Connect-based authentication
- **Dependencies**: `openid-client`, `passport`, `express-session`
- **Session Secret**: Configured via `SESSION_SECRET` environment variable

### Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **date-fns**: Date formatting for schedules
- **lucide-react**: Icon library
- **Radix UI primitives**: Accessible UI component primitives

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development
- **drizzle-kit**: Database migration and schema management