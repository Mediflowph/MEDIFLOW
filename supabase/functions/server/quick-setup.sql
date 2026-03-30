-- =============================================
-- MEDIFLOW QUICK SETUP
-- Copy and paste this into Supabase SQL Editor for quick testing
-- =============================================

-- Step 1: Add contact fields to branches table (if they don't exist)
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);

-- Step 2: Insert 5 sample branches
INSERT INTO branches (name, location, contact_person, contact_phone, contact_email)
VALUES 
  ('Main Pharmacy', 'Building A, Ground Floor', 'John Doe', '555-0001', 'main@mediflow.com'),
  ('Branch 1 - North Wing', 'Building B, 2nd Floor', 'Jane Smith', '555-0002', 'north@mediflow.com'),
  ('Branch 2 - South Wing', 'Building C, 1st Floor', 'Bob Johnson', '555-0003', 'south@mediflow.com'),
  ('Branch 3 - East Wing', 'Building D, 3rd Floor', 'Alice Brown', '555-0004', 'east@mediflow.com'),
  ('Branch 4 - West Wing', 'Building E, Ground Floor', 'Charlie Wilson', '555-0005', 'west@mediflow.com')
ON CONFLICT (name) DO UPDATE SET
  location = EXCLUDED.location,
  contact_person = EXCLUDED.contact_person,
  contact_phone = EXCLUDED.contact_phone,
  contact_email = EXCLUDED.contact_email;

-- Step 3: Add sample inventory to each branch
DO $$
DECLARE
  branch_record RECORD;
BEGIN
  FOR branch_record IN SELECT id, name FROM branches LOOP
    
    INSERT INTO inventory (branch_id, drug_name, generic_name, dosage, quantity, expiry_date, batch_number, supplier, unit_price)
    VALUES 
      (branch_record.id, 'Paracetamol', 'Acetaminophen', '500mg', 500, CURRENT_DATE + INTERVAL '1 year', 'BATCH-001', 'PharmaCorp', 5.50),
      (branch_record.id, 'Amoxicillin', 'Amoxicillin', '250mg', 300, CURRENT_DATE + INTERVAL '8 months', 'BATCH-002', 'MediSupply Inc', 12.75),
      (branch_record.id, 'Ibuprofen', 'Ibuprofen', '400mg', 400, CURRENT_DATE + INTERVAL '10 months', 'BATCH-003', 'HealthCare Ltd', 8.25),
      (branch_record.id, 'Metformin', 'Metformin HCl', '500mg', 250, CURRENT_DATE + INTERVAL '15 months', 'BATCH-004', 'DiabetesCare', 15.00),
      (branch_record.id, 'Cetirizine', 'Cetirizine HCl', '10mg', 200, CURRENT_DATE + INTERVAL '6 months', 'BATCH-005', 'AllergyCare', 6.50),
      (branch_record.id, 'Omeprazole', 'Omeprazole', '20mg', 180, CURRENT_DATE + INTERVAL '11 months', 'BATCH-006', 'GastroCare', 18.50),
      (branch_record.id, 'Losartan', 'Losartan Potassium', '50mg', 150, CURRENT_DATE + INTERVAL '14 months', 'BATCH-007', 'CardioMed', 22.00),
      (branch_record.id, 'Atorvastatin', 'Atorvastatin Calcium', '20mg', 120, CURRENT_DATE + INTERVAL '13 months', 'BATCH-008', 'CholesterolCare', 28.50),
      (branch_record.id, 'Amlodipine', 'Amlodipine Besylate', '5mg', 160, CURRENT_DATE + INTERVAL '12 months', 'BATCH-009', 'HypertensionRx', 19.75),
      (branch_record.id, 'Aspirin', 'Acetylsalicylic Acid', '100mg', 350, CURRENT_DATE + INTERVAL '9 months', 'BATCH-010', 'CardioMed', 4.25)
    ON CONFLICT DO NOTHING;
    
  END LOOP;
END $$;

-- Step 4: Verify the setup
SELECT 
  'Setup Complete!' as status,
  (SELECT COUNT(*) FROM branches) as total_branches,
  (SELECT COUNT(*) FROM inventory) as total_inventory_items,
  (SELECT SUM(quantity) FROM inventory) as total_units;

-- Show branches
SELECT id, name, location, contact_person FROM branches ORDER BY name;

-- Show inventory summary per branch
SELECT 
  b.name as branch,
  COUNT(i.id) as medicine_types,
  SUM(i.quantity) as total_units
FROM branches b
LEFT JOIN inventory i ON b.id = i.branch_id
GROUP BY b.name
ORDER BY b.name;
