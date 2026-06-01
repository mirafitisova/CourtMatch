-- Migration 006: Ensure users table exists with all required auth columns
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times — uses IF NOT EXISTS / DO $$ guards.

-- Create the users table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS "users" (
  "id"                         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"                      varchar UNIQUE NOT NULL,
  "password_hash"              varchar NOT NULL,
  "first_name"                 varchar,
  "last_name"                  varchar,
  "profile_image_url"          varchar,
  "date_of_birth"              varchar,
  "zip_code"                   varchar,
  "parent_email"               varchar,
  "account_status"             varchar NOT NULL DEFAULT 'ACTIVE',
  "is_admin"                   boolean NOT NULL DEFAULT false,
  "guidelines_accepted_at"     timestamp,
  "email_verification_token"   varchar,
  "email_verification_expiry"  timestamp,
  "email_verified"             boolean NOT NULL DEFAULT false,
  "parent_approval_token"      varchar,
  "parent_approval_sent_at"    timestamp,
  "created_at"                 timestamp DEFAULT now(),
  "updated_at"                 timestamp DEFAULT now()
);

-- Add any columns that may be missing from an older version of the table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth"              varchar;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "zip_code"                   varchar;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_email"               varchar;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_status"             varchar NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guidelines_accepted_at"     timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token"   varchar;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_expiry"  timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified"             boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_approval_token"      varchar;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_approval_sent_at"    timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin"                   boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_image_url"          varchar;
