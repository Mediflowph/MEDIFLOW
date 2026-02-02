import { useState } from 'react';
import { Pill, AlertCircle, Search, Package, Calendar, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { InventoryBatch } from '@/app/types/inventory';

interface DispenseMedicinesViewProps {
  inventory: InventoryBatch[];
  onDispense: (batchId: string, quantity: number) => void;
}

interface DrugMatch {
  batch: InventoryBatch;
  availableStock: number;
  daysToExpiry: number;
}

interface DrugOption {
  drugName: string;
  batches: DrugMatch[];
  totalStock: number;
}

export function DispenseMedicinesView({ inventory, onDispense }: DispenseMedicinesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrugName, setSelectedDrugName] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get all available batches
  const matchedBatches: DrugMatch[] = inventory
    .filter(item => {
      const stock = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
      const isNotExpired = new Date(item.expirationDate) >= new Date();
      return stock > 0 && isNotExpired;
    })
    .map(batch => {
      const availableStock = batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
      const daysToExpiry = Math.floor((new Date(batch.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return { batch, availableStock, daysToExpiry };
    });

  // Group by drug name
  const drugMap = new Map<string, DrugMatch[]>();
  
  matchedBatches.forEach(match => {
    const drugName = match.batch.drugName;
    if (!drugMap.has(drugName)) {
      drugMap.set(drugName, []);
    }
    drugMap.get(drugName)!.push(match);
  });

  const drugOptions: DrugOption[] = [];
  drugMap.forEach((batches, drugName) => {
    // Sort batches by expiration (FEFO)
    const sortedBatches = batches.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
    const totalStock = batches.reduce((sum, match) => sum + match.availableStock, 0);
    drugOptions.push({ drugName, batches: sortedBatches, totalStock });
  });

  // Filter drug options by search query
  const filteredDrugOptions = searchQuery.trim()
    ? drugOptions.filter(option => 
        option.drugName.toLowerCase().includes(searchQuery.toLowerCase())
      ).sort((a, b) => a.drugName.localeCompare(b.drugName))
    : [];

  // Get batches for selected drug
  const selectedDrugBatches = selectedDrugName
    ? drugOptions.find(opt => opt.drugName === selectedDrugName)?.batches || []
    : [];

  const handleSelectDrug = (drugName: string) => {
    setSelectedDrugName(drugName);
    setSelectedBatch(null);
    setQuantity(0);
    setError('');
    setSearchQuery(''); // Clear search after selection
  };

  const handleSelectBatch = (match: DrugMatch) => {
    setSelectedBatch(match.batch);
    setQuantity(0);
    setError('');
  };

  const handleDispenseClick = () => {
    setError('');

    if (!selectedBatch) {
      setError('Please select a drug batch');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    const availableStock = selectedBatch.beginningInventory + selectedBatch.quantityReceived - selectedBatch.quantityDispensed;
    if (quantity > availableStock) {
      setError(`Insufficient stock. Only ${availableStock} units available`);
      return;
    }

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  const handleConfirmDispense = () => {
    if (selectedBatch) {
      onDispense(selectedBatch.id, quantity);
      
      // Reset form
      setQuantity(0);
      setSelectedBatch(null);
      setSelectedDrugName(null);
      setError('');
      setShowConfirmation(false);
    }
  };

  const selectedAvailableStock = selectedBatch
    ? selectedBatch.beginningInventory + selectedBatch.quantityReceived - selectedBatch.quantityDispensed
    : 0;

  const selectedDaysUntilExpiry = selectedBatch
    ? Math.floor((new Date(selectedBatch.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dispense Drugs</h2>
        <p className="text-gray-600">Two-step selection: Choose drug → Select dosage/batch → Dispense with FEFO sorting</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dispense Form */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Pill className="w-5 h-5 text-blue-600" />
              Dispense Form
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Step 1: Drug Search */}
              {!selectedDrugName && (
                <div className="space-y-2">
                  <Label htmlFor="drugSearch">Step 1: Search Drug *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="drugSearch"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type drug name (e.g., Cetirizine)..."
                      className="pl-10 border-gray-300"
                      autoFocus
                    />
                  </div>
                  
                  {/* Drug Search Results */}
                  {filteredDrugOptions.length > 0 && searchQuery.trim() && (
                    <div className="mt-2 max-h-80 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-lg">
                      {filteredDrugOptions.map((option) => (
                        <button
                          key={option.drugName}
                          onClick={() => handleSelectDrug(option.drugName)}
                          className="w-full p-4 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800 mb-1">{option.drugName}</h4>
                              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  {option.batches.length} dosage{option.batches.length !== 1 ? 's' : ''} available
                                </span>
                                <span className="flex items-center gap-1">
                                  <strong>Total Stock:</strong> {option.totalStock}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim() && filteredDrugOptions.length === 0 && (
                    <p className="text-sm text-gray-500 mt-2">No matching drugs found with available stock</p>
                  )}
                </div>
              )}

              {/* Step 2: Dosage/Batch Selection */}
              {selectedDrugName && !selectedBatch && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Step 2: Select Dosage/Batch *</Label>
                    <button
                      onClick={() => setSelectedDrugName(null)}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Change drug
                    </button>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                    <p className="text-xs text-gray-600 mb-1">Selected Drug</p>
                    <p className="font-semibold text-gray-800">{selectedDrugName}</p>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                    {selectedDrugBatches.map((match, idx) => {
                      const isExpiringSoon = match.daysToExpiry <= 180;
                      const isExpiredSoon = match.daysToExpiry <= 30;
                      
                      return (
                        <button
                          key={match.batch.id}
                          onClick={() => handleSelectBatch(match)}
                          className="w-full p-4 text-left hover:bg-[#9867C5]/10 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-800">{match.batch.dosage}</h4>
                                {idx === 0 && (
                                  <span className="px-2 py-0.5 bg-[#9867C5] text-white text-xs rounded">
                                    FEFO First
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <span>
                                  <strong>Unit:</strong> {match.batch.unit}
                                </span>
                                <span>
                                  <strong>Stock:</strong> <span className="font-semibold text-[#9867C5]">{match.availableStock}</span>
                                </span>
                                <span>
                                  <strong>Batch:</strong> {match.batch.batchNumber}
                                </span>
                                <span>
                                  <strong>Program:</strong> {match.batch.program}
                                </span>
                                <span className="col-span-2">
                                  <strong>Expires:</strong> {match.batch.expirationDate} ({match.daysToExpiry}d)
                                </span>
                              </div>
                            </div>
                            {isExpiringSoon && (
                              <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                                isExpiredSoon ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {match.daysToExpiry}d
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Quantity and Confirm */}
              {selectedBatch && (
                <>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">✓ Selected Batch</p>
                    <p className="font-semibold text-gray-800">{selectedBatch.drugName}</p>
                    <p className="text-sm text-gray-600">{selectedBatch.dosage} {selectedBatch.unit} • Batch: {selectedBatch.batchNumber}</p>
                    <button
                      onClick={() => setSelectedBatch(null)}
                      className="text-xs text-blue-600 hover:text-blue-700 underline mt-2"
                    >
                      Change dosage/batch
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">Step 3: Quantity to Dispense *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max={selectedAvailableStock}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      placeholder="Enter quantity"
                      className="border-gray-300"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500">Available: <strong className="text-[#9867C5]">{selectedAvailableStock}</strong> units</p>
                  </div>
                </>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleDispenseClick}
                disabled={!selectedBatch || quantity <= 0}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-md font-medium"
              >
                {!selectedDrugName ? 'Select a drug to continue' :
                 !selectedBatch ? 'Select dosage/batch to continue' :
                 'Dispense Medication'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Batch Details */}
        {selectedBatch && (
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
              <CardTitle className="text-gray-800">Selected Batch Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Drug Name</p>
                    <p className="font-semibold text-gray-800">{selectedBatch.drugName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Dosage</p>
                    <p className="font-semibold text-gray-800">{selectedBatch.dosage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Batch Number</p>
                    <p className="font-semibold text-gray-800">{selectedBatch.batchNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Program</p>
                    <p className="font-semibold text-gray-800">{selectedBatch.program}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Unit</p>
                    <p className="font-semibold text-gray-800">{selectedBatch.unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Unit Cost</p>
                    <p className="font-semibold text-gray-800">₱{selectedBatch.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Beginning Inventory</span>
                    <span className="font-semibold">{selectedBatch.beginningInventory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Quantity Received</span>
                    <span className="font-semibold text-[#9867C5]">+{selectedBatch.quantityReceived}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Quantity Dispensed</span>
                    <span className="font-semibold text-blue-600">-{selectedBatch.quantityDispensed}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold text-gray-800">Available Stock</span>
                    <span className="text-xl font-bold text-[#9867C5]">{selectedAvailableStock}</span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${
                  selectedDaysUntilExpiry && selectedDaysUntilExpiry <= 30 ? 'bg-red-50 border border-red-200' :
                  selectedDaysUntilExpiry && selectedDaysUntilExpiry <= 180 ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-green-50 border border-green-200'
                }`}>
                  <p className="text-xs text-gray-600">Expiration Date</p>
                  <p className="font-semibold text-gray-800">{selectedBatch.expirationDate}</p>
                  <p className="text-xs mt-1 text-gray-600">
                    {selectedDaysUntilExpiry} days remaining
                  </p>
                </div>

                {selectedBatch.remarks && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Remarks</p>
                    <p className="text-sm text-gray-800">{selectedBatch.remarks}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && selectedBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Dispense</h3>
            <div className="space-y-3 mb-6">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Drug Name</p>
                <p className="font-semibold text-gray-800">{selectedBatch.drugName} ({selectedBatch.dosage})</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Batch Number</p>
                <p className="font-semibold text-gray-800">{selectedBatch.batchNumber}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">Quantity to Dispense</p>
                <p className="font-bold text-blue-600 text-xl">{quantity} {selectedBatch.unit}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-gray-600">Remaining After Dispense</p>
                <p className="font-bold text-amber-600 text-xl">{selectedAvailableStock - quantity} {selectedBatch.unit}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispense}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Confirm Dispense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
