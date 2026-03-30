-- MediFlow Database Schema
-- This file contains the SQL code for creating normalized tables for the MediFlow application

-- =============================================
-- TABLE: branches
-- Stores all branch information
-- =============================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  location VARCHAR(255),
  contact_person VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: users
-- Extends auth.users with additional user data
-- Links users to branches
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,  -- References auth.users(id)
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  profile_picture TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: inventory
-- Stores drug inventory items per branch
-- =============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  drug_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  dosage VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE,
  batch_number VARCHAR(100),
  supplier VARCHAR(255),
  unit_price DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: audit_logs
-- Tracks user activity and system events
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,  -- References auth.users(id)
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,  -- Flexible JSON field for additional log details
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- Improve query performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================
-- RELATIONSHIPS
-- =============================================
-- branches 1:N users (one branch has many users)
-- branches 1:N inventory (one branch has many inventory items)
-- branches 1:N audit_logs (one branch has many audit log entries)
-- users (auth.users) 1:N audit_logs (one user has many audit log entries)

-- =============================================
-- NOTES
-- =============================================
-- 1. The users table extends Supabase's built-in auth.users table
-- 2. Users are linked to branches via branch_id foreign key
-- 3. Inventory items are tied to branches, not individual users
-- 4. Audit logs track both user and branch activity
-- 5. JSONB field in audit_logs allows flexible event data storage
