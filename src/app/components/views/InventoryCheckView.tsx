import { useState, useEffect } from 'react';
import { ClipboardCheck, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { InventoryBatch } from '@/app/types/inventory';
import { saveDiscrepancy, removeDiscrepancy, loadDiscrepancies, Discrepancy } from '@/app/utils/discrepancyLog';

interface InventoryCheckViewProps {
  inventory: InventoryBatch[];
  onClearInventory?: () => void;
  userRole?: string;
  branchId?: string;
  branchName?: string;
  userName?: string;
  userId?: string;
}

interface PhysicalCount {
  batchId: string;
  physicalCount: number;
  remarks: string;
}

export function InventoryCheckView({
  inventory,
  onClearInventory,
  userRole,
  branchId,
  branchName,
  userName,
  userId
}: InventoryCheckViewProps) {
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, PhysicalCount>>({});
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);

  // Load saved discrepancies on mount
  useEffect(() => {
    if (!branchId) return;

    const savedDiscrepancies = loadDiscrepancies(branchId, 30);
    const countsMap: Record<string, PhysicalCount> = {};

    savedDiscrepancies.forEach(disc => {
      countsMap[disc.batchId] = {
        batchId: disc.batchId,
        physicalCount: disc.physicalCount,
        remarks: disc.remarks,
      };
    });

    setPhysicalCounts(countsMap);
    console.log(`📋 Loaded ${savedDiscrepancies.length} saved discrepancies`);
  }, [branchId]);

  const updatePhysicalCount = (batchId: string, count: number) => {
    setPhysicalCounts(prev => ({
      ...prev,
      [batchId]: {
        batchId,
        physicalCount: count,
        remarks: prev[batchId]?.remarks || '',
      },
    }));

    // Save discrepancy
    saveDiscrepancyForBatch(batchId, count, physicalCounts[batchId]?.remarks || '');
  };

  const updateRemarks = (batchId: string, remarks: string) => {
    setPhysicalCounts(prev => ({
      ...prev,
      [batchId]: {
        ...prev[batchId],
        batchId,
        physicalCount: prev[batchId]?.physicalCount !== undefined ? prev[batchId].physicalCount : getSystemStock(inventory.find(b => b.id === batchId)!),
        remarks,
      },
    }));

    // Save discrepancy with updated remarks
    const batch = inventory.find(b => b.id === batchId);
    if (batch) {
      const currentCount = physicalCounts[batchId]?.physicalCount !== undefined
        ? physicalCounts[batchId].physicalCount
        : getSystemStock(batch);
      saveDiscrepancyForBatch(batchId, currentCount, remarks);
    }
  };

  const saveDiscrepancyForBatch = (batchId: string, physicalCount: number, remarks: string) => {
    if (!branchId || !branchName || !userName || !userId) {
      console.warn('Missing branch/user info, cannot save discrepancy');
      return;
    }

    const batch = inventory.find(b => b.id === batchId);
    if (!batch) return;

    const systemStock = getSystemStock(batch);
    const variance = physicalCount - systemStock;

    // If variance is 0, remove the discrepancy
    if (variance === 0 && !remarks) {
      removeDiscrepancy(branchId, batchId);
      return;
    }

    // Save discrepancy
    const discrepancy: Discrepancy = {
      id: `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      batchId,
      drugName: batch.drugName,
      dosage: batch.dosage,
      batchNumber: batch.batchNumber,
      unit: batch.unit,
      systemStock,
      physicalCount,
      variance,
      remarks,
      timestamp: new Date().toISOString(),
      branchId,
      branchName,
      userName,
      userId,
    };

    saveDiscrepancy(discrepancy);
  };

  const getSystemStock = (batch: InventoryBatch) => {
    return batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
  };

  const getVariance = (batch: InventoryBatch) => {
    const systemStock = getSystemStock(batch);
    // Only calculate variance if physical count has been entered
    if (!(batch.id in physicalCounts)) {
      return 0; // No variance if not yet counted
    }
    const physicalCount = physicalCounts[batch.id].physicalCount;
    return physicalCount - systemStock;
  };

  const filteredInventory = showDiscrepanciesOnly
    ? inventory.filter(batch => {
        const variance = getVariance(batch);
        return variance !== 0;
      })
    : inventory;

  // Sort by Program → Drug Name (same grouping as DOH report)
  const sortedInventory = [...filteredInventory].sort((a, b) => {
    const programCmp = a.program.localeCompare(b.program);
    if (programCmp !== 0) return programCmp;
    return a.drugName.localeCompare(b.drugName);
  });

  const totalDiscrepancies = inventory.filter(batch => getVariance(batch) !== 0).length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Inventory Check</h2>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-2xl font-bold text-gray-800">{inventory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#9867C5]/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#9867C5]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Verified</p>
                <p className="text-2xl font-bold text-gray-800">
                  {Object.keys(physicalCounts).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Discrepancies</p>
                <p className="text-2xl font-bold text-gray-800">{totalDiscrepancies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDiscrepanciesOnly}
            onChange={(e) => setShowDiscrepanciesOnly(e.target.checked)}
            className="w-4 h-4 text-[#9867C5] rounded focus:ring-[#9867C5]"
          />
          <span className="text-sm text-gray-700">Show discrepancies only</span>
        </label>

        {onClearInventory && userRole === 'admin' && (
          <button
            onClick={() => {
              if (window.confirm('⚠️ DEV TOOL\n\nThis will permanently delete ALL inventory data for this branch from the database.\n\nAre you sure?')) {
                onClearInventory();
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            [DEV] Clear All Inventory
          </button>
        )}
      </div>

      {/* Inventory Check Table */}
      <Card className="border-none shadow-md">
        <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <ClipboardCheck className="w-5 h-5 text-[#9867C5]" />
            Physical Count Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Drug Name</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Program</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Batch Number</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">System Stock</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Physical Count</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Variance</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {sortedInventory.map((batch) => {
                  const systemStock = getSystemStock(batch);
                  const hasPhysicalCount = batch.id in physicalCounts;
                  const physicalCount = hasPhysicalCount
                    ? physicalCounts[batch.id].physicalCount
                    : systemStock;
                  const variance = getVariance(batch);
                  const hasDiscrepancy = variance !== 0;

                  return (
                    <tr
                      key={batch.id}
                      className={`border-t border-gray-200 ${
                        hasDiscrepancy ? 'bg-red-50' : 'hover:bg-gray-50'
                      } transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{batch.drugName}</p>
                          <p className="text-xs text-gray-500">{batch.dosage}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{batch.program}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{batch.batchNumber}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-semibold text-gray-800">{systemStock}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={systemStock.toString()}
                          value={hasPhysicalCount ? physicalCount : ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                            const numValue = value === '' ? 0 : parseInt(value, 10);
                            updatePhysicalCount(batch.id, numValue);
                          }}
                          onFocus={(e) => {
                            // Auto-select all text on focus for easy replacement
                            e.target.select();
                          }}
                          className={`w-24 ${hasDiscrepancy ? 'border-red-300 bg-white' : ''}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${
                            variance === 0 ? 'text-[#9867C5]' :
                            variance > 0 ? 'text-blue-600' :
                            'text-red-600'
                          }`}>
                            {variance > 0 ? '+' : ''}{variance}
                          </span>
                          {hasDiscrepancy && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          placeholder="Add remarks..."
                          value={physicalCounts[batch.id]?.remarks || ''}
                          onChange={(e) => updateRemarks(batch.id, e.target.value)}
                          className="w-full"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
    </div>
  );
}
