import { useState } from 'react';
import { ClipboardCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { InventoryBatch } from '@/app/types/inventory';

interface InventoryCheckViewProps {
  inventory: InventoryBatch[];
}

interface PhysicalCount {
  batchId: string;
  physicalCount: number;
  remarks: string;
}

export function InventoryCheckView({ inventory }: InventoryCheckViewProps) {
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, PhysicalCount>>({});
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);

  const updatePhysicalCount = (batchId: string, count: number) => {
    setPhysicalCounts(prev => ({
      ...prev,
      [batchId]: {
        batchId,
        physicalCount: count,
        remarks: prev[batchId]?.remarks || '',
      },
    }));
  };

  const updateRemarks = (batchId: string, remarks: string) => {
    setPhysicalCounts(prev => ({
      ...prev,
      [batchId]: {
        ...prev[batchId],
        batchId,
        physicalCount: prev[batchId]?.physicalCount || 0,
        remarks,
      },
    }));
  };

  const getSystemStock = (batch: InventoryBatch) => {
    return batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
  };

  const getVariance = (batch: InventoryBatch) => {
    const systemStock = getSystemStock(batch);
    const physicalCount = physicalCounts[batch.id]?.physicalCount ?? systemStock;
    return physicalCount - systemStock;
  };

  const filteredInventory = showDiscrepanciesOnly
    ? inventory.filter(batch => {
        const variance = getVariance(batch);
        return variance !== 0;
      })
    : inventory;

  const totalDiscrepancies = inventory.filter(batch => getVariance(batch) !== 0).length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Inventory Check</h2>
        <p className="text-gray-600">Physical count verification and variance reporting</p>
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
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDiscrepanciesOnly}
            onChange={(e) => setShowDiscrepanciesOnly(e.target.checked)}
            className="w-4 h-4 text-[#9867C5] rounded focus:ring-[#9867C5]"
          />
          <span className="text-sm text-gray-700">Show discrepancies only</span>
        </label>
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
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Batch Number</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">System Stock</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Physical Count</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Variance</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-600">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((batch) => {
                  const systemStock = getSystemStock(batch);
                  const physicalCount = physicalCounts[batch.id]?.physicalCount ?? systemStock;
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
                      <td className="px-4 py-3 text-sm text-gray-800">{batch.batchNumber}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-semibold text-gray-800">{systemStock}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={physicalCount}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                            const numValue = value === '' ? 0 : parseInt(value, 10);
                            updatePhysicalCount(batch.id, numValue);
                          }}
                          onFocus={(e) => {
                            if (e.target.value === '0') {
                              e.target.select(); // Select all text if it's 0
                            }
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
      <Card className="border-l-4 border-blue-500 bg-blue-50 shadow-sm">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            <strong>Instructions:</strong> Enter the actual physical count for each item. The system will automatically 
            calculate variances. Items with discrepancies will be highlighted in red. Add remarks to explain any differences.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}