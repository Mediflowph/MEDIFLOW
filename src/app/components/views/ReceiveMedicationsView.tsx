import { useState, useMemo } from 'react';
import { Plus, PackagePlus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { InventoryBatch } from '@/app/types/inventory';

interface ReceiveMedicationsViewProps {
  onAddStock: (batch: Omit<InventoryBatch, 'id'>) => void;
  existingDrugs?: string[];
  inventory?: InventoryBatch[];
}

// Common drug names for autocomplete
const COMMON_DRUGS = [
  'Amoxicillin', 'Azithromycin', 'Cetirizine', 'Paracetamol', 'Ibuprofen',
  'Metformin', 'Omeprazole', 'Losartan', 'Amlodipine', 'Simvastatin',
  'Atorvastatin', 'Aspirin', 'Ciprofloxacin', 'Doxycycline', 'Clarithromycin',
  'Salbutamol', 'Ranitidine', 'Mefenamic Acid', 'Cotrimoxazole', 'Loperamide'
];

// Common programs (default list)
const DEFAULT_PROGRAMS = [
  'EREID', 'NIP', 'DOH', 'LGU', 'Donation', 'PHIC', 'NHIP', 'TB-DOTS', 'EVRP', 'FHSIS'
];

// Common units (default list)
const DEFAULT_UNITS = [
  'vial', 'capsule', 'tablet', 'bottle', 'box', 'ampule', 'sachet', 'tube'
];

// Common dosage patterns
const DOSAGE_SUGGESTIONS = [
  '500mg', '250mg', '1000mg', '100mg', '50mg', '10mg',
  '5mg', '2.5mg', '100mg/5ml', '250mg/5ml', '20mg', '40mg'
];

export function ReceiveMedicationsView({ onAddStock, existingDrugs = [], inventory = [] }: ReceiveMedicationsViewProps) {
  const [formData, setFormData] = useState({
    drugName: '',
    program: '',
    dosage: '',
    unit: 'vial',
    batchNumber: '',
    beginningInventory: 0,
    quantityReceived: 0,
    dateReceived: new Date().toISOString().split('T')[0],
    unitCost: 0,
    expirationDate: '',
    remarks: '',
  });

  const [showDrugSuggestions, setShowDrugSuggestions] = useState(false);
  const [showProgramSuggestions, setShowProgramSuggestions] = useState(false);
  const [showDosageSuggestions, setShowDosageSuggestions] = useState(false);
  const [showUnitSuggestions, setShowUnitSuggestions] = useState(false);

  // Extract unique programs and units from existing inventory
  const customPrograms = useMemo(() => {
    const programs = inventory.map(item => item.program);
    return Array.from(new Set(programs));
  }, [inventory]);

  const customUnits = useMemo(() => {
    const units = inventory.map(item => item.unit);
    return Array.from(new Set(units));
  }, [inventory]);

  // Combine default and custom programs/units
  const allPrograms = useMemo(() => {
    const combined = [...DEFAULT_PROGRAMS, ...customPrograms];
    return Array.from(new Set(combined)).sort();
  }, [customPrograms]);

  const allUnits = useMemo(() => {
    const combined = [...DEFAULT_UNITS, ...customUnits];
    return Array.from(new Set(combined)).sort();
  }, [customUnits]);

  // Combine existing drugs with common drugs
  const allDrugs = useMemo(() => {
    const combined = [...existingDrugs, ...COMMON_DRUGS];
    return Array.from(new Set(combined)).sort();
  }, [existingDrugs]);

  // Filter drug suggestions
  const drugSuggestions = useMemo(() => {
    if (!formData.drugName || formData.drugName.length < 2) return [];
    const query = formData.drugName.toLowerCase();
    return allDrugs.filter(drug => drug.toLowerCase().includes(query)).slice(0, 8);
  }, [formData.drugName, allDrugs]);

  // Filter program suggestions
  const programSuggestions = useMemo(() => {
    if (!formData.program) return allPrograms;
    const query = formData.program.toLowerCase();
    return allPrograms.filter(prog => prog.toLowerCase().includes(query));
  }, [formData.program, allPrograms]);

  // Filter unit suggestions
  const unitSuggestions = useMemo(() => {
    if (!formData.unit) return allUnits;
    const query = formData.unit.toLowerCase();
    return allUnits.filter(unit => unit.toLowerCase().includes(query));
  }, [formData.unit, allUnits]);

  // Filter dosage suggestions
  const dosageSuggestions = useMemo(() => {
    if (!formData.dosage || formData.dosage.length < 1) return DOSAGE_SUGGESTIONS.slice(0, 6);
    const query = formData.dosage.toLowerCase();
    return DOSAGE_SUGGESTIONS.filter(dos => dos.toLowerCase().includes(query)).slice(0, 8);
  }, [formData.dosage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newBatch: Omit<InventoryBatch, 'id'> = {
      ...formData,
      quantityDispensed: 0,
    };

    onAddStock(newBatch);
    
    // Reset form
    setFormData({
      drugName: '',
      program: '',
      dosage: '',
      unit: 'vial',
      batchNumber: '',
      beginningInventory: 0,
      quantityReceived: 0,
      dateReceived: new Date().toISOString().split('T')[0],
      unitCost: 0,
      expirationDate: '',
      remarks: '',
    });
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Receive Medications</h2>
        <p className="text-gray-600">Add new stock entries with batch tracking and smart suggestions</p>
      </div>

      <Card className="border-none shadow-md max-w-4xl">
        <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <PackagePlus className="w-5 h-5 text-[#9867C5]" />
            New Stock Entry Form
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Drug Name with Autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="drugName">Drug Name *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="drugName"
                    value={formData.drugName}
                    onChange={(e) => {
                      handleChange('drugName', e.target.value);
                      setShowDrugSuggestions(true);
                    }}
                    onFocus={() => setShowDrugSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowDrugSuggestions(false), 200)}
                    placeholder="Type drug name (e.g., Amoxicillin)..."
                    required
                    className="pl-10 border-gray-300"
                  />
                </div>
                {showDrugSuggestions && drugSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {drugSuggestions.map((drug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleChange('drugName', drug);
                          setShowDrugSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-[#9867C5]/10 transition-colors text-sm"
                      >
                        {drug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Program with Autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="program">Program *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="program"
                    value={formData.program}
                    onChange={(e) => {
                      handleChange('program', e.target.value);
                      setShowProgramSuggestions(true);
                    }}
                    onFocus={() => setShowProgramSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowProgramSuggestions(false), 200)}
                    placeholder="Type program (e.g., EREID)..."
                    required
                    className="pl-10 border-gray-300"
                  />
                </div>
                {showProgramSuggestions && programSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {programSuggestions.map((prog, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleChange('program', prog);
                          setShowProgramSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-[#9867C5]/10 transition-colors text-sm"
                      >
                        {prog}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dosage/Description with Suggestions */}
              <div className="space-y-2 relative">
                <Label htmlFor="dosage">Dosage / Description *</Label>
                <Input
                  id="dosage"
                  value={formData.dosage}
                  onChange={(e) => {
                    handleChange('dosage', e.target.value);
                    setShowDosageSuggestions(true);
                  }}
                  onFocus={() => setShowDosageSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDosageSuggestions(false), 200)}
                  placeholder="e.g., 500mg"
                  required
                  className="border-gray-300"
                />
                {showDosageSuggestions && dosageSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {dosageSuggestions.map((dos, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleChange('dosage', dos);
                          setShowDosageSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-[#9867C5]/10 transition-colors text-sm"
                      >
                        {dos}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit with Autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="unit">Unit *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => {
                      handleChange('unit', e.target.value);
                      setShowUnitSuggestions(true);
                    }}
                    onFocus={() => setShowUnitSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowUnitSuggestions(false), 200)}
                    placeholder="Type unit (e.g., vial, tablet)..."
                    required
                    className="pl-10 border-gray-300"
                  />
                </div>
                {showUnitSuggestions && unitSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {unitSuggestions.map((unit, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleChange('unit', unit);
                          setShowUnitSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-[#9867C5]/10 transition-colors text-sm"
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Batch Number */}
              <div className="space-y-2">
                <Label htmlFor="batchNumber">Batch / Lot Number *</Label>
                <Input
                  id="batchNumber"
                  value={formData.batchNumber}
                  onChange={(e) => handleChange('batchNumber', e.target.value)}
                  placeholder="e.g., BAT-2026-001"
                  required
                  className="border-gray-300"
                />
              </div>

              {/* Beginning Inventory */}
              <div className="space-y-2">
                <Label htmlFor="beginningInventory">Beginning Inventory</Label>
                <Input
                  id="beginningInventory"
                  type="number"
                  min="0"
                  value={formData.beginningInventory}
                  onChange={(e) => handleChange('beginningInventory', parseInt(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  className="border-gray-300"
                />
              </div>

              {/* Quantity Received */}
              <div className="space-y-2">
                <Label htmlFor="quantityReceived">Quantity Received *</Label>
                <Input
                  id="quantityReceived"
                  type="number"
                  min="1"
                  value={formData.quantityReceived}
                  onChange={(e) => handleChange('quantityReceived', parseInt(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  required
                  className="border-gray-300"
                />
              </div>

              {/* Date Received */}
              <div className="space-y-2">
                <Label htmlFor="dateReceived">Date Received *</Label>
                <Input
                  id="dateReceived"
                  type="date"
                  value={formData.dateReceived}
                  onChange={(e) => handleChange('dateReceived', e.target.value)}
                  required
                  className="border-gray-300"
                />
              </div>

              {/* Unit Cost */}
              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit Cost (₱)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unitCost}
                  onChange={(e) => handleChange('unitCost', parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  className="border-gray-300"
                />
              </div>

              {/* Expiration Date */}
              <div className="space-y-2">
                <Label htmlFor="expirationDate">Expiration Date *</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => handleChange('expirationDate', e.target.value)}
                  required
                  className="border-gray-300"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="remarks">Remarks / Notes</Label>
                <textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Optional notes about this batch..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9867C5] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add to Inventory
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
