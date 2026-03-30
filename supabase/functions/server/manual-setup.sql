-- =============================================
-- MEDIFLOW MANUAL DATABASE SETUP
-- Execute this SQL in Supabase SQL Editor to initialize the database
-- =============================================

-- =============================================
-- STEP 1: Create all tables (if not exists)
-- =============================================

-- TABLE: branches
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

-- TABLE: users
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

-- TABLE: inventory
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

-- TABLE: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,  -- References auth.users(id)
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- STEP 2: Create indexes for better performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_drug_name ON inventory(drug_name);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================
-- STEP 3: Insert sample branches
-- =============================================

-- Clear existing sample data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE inventory CASCADE;
-- DELETE FROM branches WHERE name LIKE 'Branch%' OR name LIKE 'Main%';

-- Insert sample branches
INSERT INTO branches (name, location, contact_person, contact_phone, contact_email)
VALUES 
  ('Main Pharmacy', 'Building A, Ground Floor', 'John Doe', '555-0001', 'main@mediflow.com'),
  ('Branch 1 - North Wing', 'Building B, 2nd Floor', 'Jane Smith', '555-0002', 'north@mediflow.com'),
  ('Branch 2 - South Wing', 'Building C, 1st Floor', 'Bob Johnson', '555-0003', 'south@mediflow.com'),
  ('Branch 3 - East Wing', 'Building D, 3rd Floor', 'Alice Brown', '555-0004', 'east@mediflow.com'),
  ('Branch 4 - West Wing', 'Building E, Ground Floor', 'Charlie Wilson', '555-0005', 'west@mediflow.com')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- STEP 4: Insert sample inventory for each branch
-- =============================================

-- Get branch IDs (we'll use these in the next step)
-- First, let's create a temporary function to populate inventory

DO $$
DECLARE
  branch_record RECORD;
BEGIN
  -- Loop through all branches and add sample inventory
  FOR branch_record IN SELECT id, name FROM branches LOOP
    
    -- Insert sample medicines for each branch
    INSERT INTO inventory (branch_id, drug_name, generic_name, dosage, quantity, expiry_date, batch_number, supplier, unit_price)
    VALUES 
      -- Common medicines
      (branch_record.id, 'Paracetamol', 'Acetaminophen', '500mg', 500 + FLOOR(RANDOM() * 500)::INTEGER, CURRENT_DATE + INTERVAL '1 year', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'PharmaCorp', 5.50),
      (branch_record.id, 'Amoxicillin', 'Amoxicillin', '250mg', 300 + FLOOR(RANDOM() * 300)::INTEGER, CURRENT_DATE + INTERVAL '8 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'MediSupply Inc', 12.75),
      (branch_record.id, 'Ibuprofen', 'Ibuprofen', '400mg', 400 + FLOOR(RANDOM() * 400)::INTEGER, CURRENT_DATE + INTERVAL '10 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'HealthCare Ltd', 8.25),
      (branch_record.id, 'Metformin', 'Metformin HCl', '500mg', 250 + FLOOR(RANDOM() * 250)::INTEGER, CURRENT_DATE + INTERVAL '15 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'DiabetesCare', 15.00),
      (branch_record.id, 'Cetirizine', 'Cetirizine HCl', '10mg', 200 + FLOOR(RANDOM() * 200)::INTEGER, CURRENT_DATE + INTERVAL '6 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'AllergyCare', 6.50),
      (branch_record.id, 'Omeprazole', 'Omeprazole', '20mg', 180 + FLOOR(RANDOM() * 180)::INTEGER, CURRENT_DATE + INTERVAL '11 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'GastroCare', 18.50),
      (branch_record.id, 'Losartan', 'Losartan Potassium', '50mg', 150 + FLOOR(RANDOM() * 150)::INTEGER, CURRENT_DATE + INTERVAL '14 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'CardioMed', 22.00),
      (branch_record.id, 'Atorvastatin', 'Atorvastatin Calcium', '20mg', 120 + FLOOR(RANDOM() * 120)::INTEGER, CURRENT_DATE + INTERVAL '13 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'CholesterolCare', 28.50),
      (branch_record.id, 'Amlodipine', 'Amlodipine Besylate', '5mg', 160 + FLOOR(RANDOM() * 160)::INTEGER, CURRENT_DATE + INTERVAL '12 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'HypertensionRx', 19.75),
      (branch_record.id, 'Ciprofloxacin', 'Ciprofloxacin HCl', '500mg', 90 + FLOOR(RANDOM() * 90)::INTEGER, CURRENT_DATE + INTERVAL '7 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'AntibioticPro', 25.00),
      
      -- Additional medicines for variety
      (branch_record.id, 'Aspirin', 'Acetylsalicylic Acid', '100mg', 350 + FLOOR(RANDOM() * 350)::INTEGER, CURRENT_DATE + INTERVAL '9 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'CardioMed', 4.25),
      (branch_record.id, 'Vitamin C', 'Ascorbic Acid', '500mg', 600 + FLOOR(RANDOM() * 600)::INTEGER, CURRENT_DATE + INTERVAL '18 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'VitaHealth', 3.50),
      (branch_record.id, 'Vitamin D3', 'Cholecalciferol', '1000IU', 400 + FLOOR(RANDOM() * 400)::INTEGER, CURRENT_DATE + INTERVAL '20 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'VitaHealth', 8.75),
      (branch_record.id, 'Loperamide', 'Loperamide HCl', '2mg', 100 + FLOOR(RANDOM() * 100)::INTEGER, CURRENT_DATE + INTERVAL '5 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'GastroCare', 7.50),
      (branch_record.id, 'Ranitidine', 'Ranitidine HCl', '150mg', 140 + FLOOR(RANDOM() * 140)::INTEGER, CURRENT_DATE + INTERVAL '8 months', 'BATCH-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6), 'GastroCare', 11.25);
    
    RAISE NOTICE 'Added inventory for branch: %', branch_record.name;
    
  END LOOP;
END $$;

-- =============================================
-- STEP 5: Verify the data
-- =============================================

-- Count branches
SELECT 'Total Branches:' as info, COUNT(*) as count FROM branches;

-- Count inventory items
SELECT 'Total Inventory Items:' as info, COUNT(*) as count FROM inventory;

-- Show inventory per branch
SELECT 
  b.name as branch_name,
  COUNT(i.id) as inventory_count,
  SUM(i.quantity) as total_quantity
FROM branches b
LEFT JOIN inventory i ON b.id = i.branch_id
GROUP BY b.name
ORDER BY b.name;

-- Show sample inventory
SELECT 
  b.name as branch,
  i.drug_name,
  i.dosage,
  i.quantity,
  i.expiry_date
FROM inventory i
JOIN branches b ON i.branch_id = b.id
ORDER BY b.name, i.drug_name
LIMIT 20;

-- =============================================
-- STEP 6: Create a view for Stock Locator (optional but recommended)
-- =============================================

CREATE OR REPLACE VIEW v_stock_locator AS
SELECT 
  b.id as branch_id,
  b.name as branch_name,
  b.location as branch_location,
  b.contact_person,
  b.contact_phone,
  b.contact_email,
  i.id as inventory_id,
  i.drug_name,
  i.generic_name,
  i.dosage,
  i.quantity,
  i.expiry_date,
  i.batch_number,
  i.supplier,
  i.unit_price,
  CASE 
    WHEN i.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN i.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
    WHEN i.expiry_date < CURRENT_DATE + INTERVAL '180 days' THEN 'near_expiry'
    ELSE 'good'
  END as stock_status,
  (i.expiry_date - CURRENT_DATE) as days_until_expiry
FROM branches b
JOIN inventory i ON b.id = i.branch_id
WHERE i.quantity > 0
ORDER BY i.drug_name, b.name;

-- Grant access to the view
GRANT SELECT ON v_stock_locator TO authenticated;
GRANT SELECT ON v_stock_locator TO anon;

-- Test the view
SELECT 
  drug_name,
  COUNT(DISTINCT branch_id) as available_in_branches,
  SUM(quantity) as total_stock
FROM v_stock_locator
GROUP BY drug_name
ORDER BY drug_name
LIMIT 10;

-- =============================================
-- STEP 7: Enable Row Level Security (RLS) - IMPORTANT FOR PRODUCTION
-- =============================================

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for branches (read-only for all authenticated users)
CREATE POLICY "Allow read access to all authenticated users" ON branches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for service role only" ON branches
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow update for service role only" ON branches
  FOR UPDATE TO service_role USING (true);

CREATE POLICY "Allow delete for service role only" ON branches
  FOR DELETE TO service_role USING (true);

-- Create policies for users (service role only)
CREATE POLICY "Allow all for service role" ON users
  FOR ALL TO service_role USING (true);

-- Create policies for inventory (read for authenticated, modify for service role)
CREATE POLICY "Allow read access to all authenticated users" ON inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all for service role" ON inventory
  FOR ALL TO service_role USING (true);

-- Create policies for audit_logs (service role only)
CREATE POLICY "Allow all for service role" ON audit_logs
  FOR ALL TO service_role USING (true);

-- =============================================
-- FINAL VERIFICATION
-- =============================================

SELECT '✅ Database setup complete!' as status;
SELECT 'Total branches: ' || COUNT(*) FROM branches;
SELECT 'Total inventory items: ' || COUNT(*) FROM inventory;
SELECT 'Stock Locator view ready: v_stock_locator' as info;

-- Show a summary
SELECT 
  '📊 Summary Report' as report_type,
  (SELECT COUNT(*) FROM branches) as total_branches,
  (SELECT COUNT(*) FROM inventory) as total_inventory_items,
  (SELECT SUM(quantity) FROM inventory) as total_medicine_units,
  (SELECT COUNT(DISTINCT drug_name) FROM inventory) as unique_medicines;
