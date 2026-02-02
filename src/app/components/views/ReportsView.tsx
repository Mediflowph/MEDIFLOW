import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, FileSpreadsheet, Pill, Building, RefreshCw, Calendar, Filter, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { InventoryBatch } from '@/app/types/inventory';
import { exportToExcel, generateExcelReportWithBranchInfo } from '@/app/utils/exportUtils';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';

interface ReportsViewProps {
  inventory: InventoryBatch[];
  userToken?: string;
  userRole?: string;
  userName?: string;
  branchName?: string;
}

interface BranchData {
  userId: string;
  userName: string;
  branchName: string;
  userRole: string;
  inventory: InventoryBatch[];
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  program: string;
  drugName: string;
  expiryStatus: 'all' | 'expired' | 'near-expiry' | 'valid';
  stockStatus: 'all' | 'low' | 'normal' | 'out-of-stock';
}

export function ReportsView({ inventory, userToken, userRole = 'Staff', userName, branchName }: ReportsViewProps) {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingReportFor, setGeneratingReportFor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Date range defaults: Current quarter
  const getQuarterDates = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    
    const startDate = new Date(currentYear, quarterStartMonth, 1);
    const endDate = new Date(currentYear, quarterStartMonth + 3, 0);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  };

  const quarterDates = getQuarterDates();
  
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: '', // Empty by default - show all data
    dateTo: '',   // Empty by default - show all data
    program: 'all',
    drugName: '',
    expiryStatus: 'all',
    stockStatus: 'all',
  });

  // Get unique programs and drugs for filter dropdowns
  const uniquePrograms = useMemo(() => {
    return Array.from(new Set(inventory.map(item => item.program))).sort();
  }, [inventory]);

  const uniqueDrugs = useMemo(() => {
    return Array.from(new Set(inventory.map(item => item.drugName))).sort();
  }, [inventory]);

  // Helper functions
  const isExpired = (expirationDate: string) => {
    return new Date(expirationDate) < new Date();
  };

  const daysUntilExpiry = (expirationDate: string) => {
    return Math.floor((new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStockOnHand = (batch: InventoryBatch) => {
    return batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
  };

  const calculateUtilization = (batch: InventoryBatch) => {
    const total = batch.beginningInventory + batch.quantityReceived;
    return total > 0 ? ((batch.quantityDispensed / total) * 100).toFixed(1) : '0.0';
  };

  const formatPeso = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Apply filters
  const filteredInventory = useMemo(() => {
    return inventory.filter(batch => {
      // Date range filter (based on dateReceived)
      if (filters.dateFrom && batch.dateReceived < filters.dateFrom) return false;
      if (filters.dateTo && batch.dateReceived > filters.dateTo) return false;

      // Program filter
      if (filters.program !== 'all' && batch.program !== filters.program) return false;

      // Drug name filter
      if (filters.drugName && !batch.drugName.toLowerCase().includes(filters.drugName.toLowerCase())) return false;

      // Expiry status filter
      if (filters.expiryStatus !== 'all') {
        const days = daysUntilExpiry(batch.expirationDate);
        if (filters.expiryStatus === 'expired' && days >= 0) return false;
        if (filters.expiryStatus === 'near-expiry' && (days < 0 || days > 180)) return false;
        if (filters.expiryStatus === 'valid' && days <= 180) return false;
      }

      // Stock status filter
      if (filters.stockStatus !== 'all') {
        const stock = getStockOnHand(batch);
        if (filters.stockStatus === 'out-of-stock' && stock > 0) return false;
        if (filters.stockStatus === 'low' && (stock === 0 || stock >= 50)) return false;
        if (filters.stockStatus === 'normal' && stock < 50) return false;
      }

      return true;
    });
  }, [inventory, filters]);

  // Calculate report statistics
  const reportStats = useMemo(() => {
    const totalStock = filteredInventory.reduce((sum, batch) => sum + getStockOnHand(batch), 0);
    const totalValue = filteredInventory.reduce((sum, batch) => {
      const stock = getStockOnHand(batch);
      return sum + (stock * batch.unitCost);
    }, 0);
    const expiredCount = filteredInventory.filter(batch => isExpired(batch.expirationDate)).length;
    const nearExpiryCount = filteredInventory.filter(batch => {
      const days = daysUntilExpiry(batch.expirationDate);
      return days >= 0 && days <= 180;
    }).length;
    const lowStockCount = filteredInventory.filter(batch => {
      const stock = getStockOnHand(batch);
      return stock > 0 && stock < 50;
    }).length;

    return { totalStock, totalValue, expiredCount, nearExpiryCount, lowStockCount };
  }, [filteredInventory]);

  const resetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      program: 'all',
      drugName: '',
      expiryStatus: 'all',
      stockStatus: 'all',
    });
  };

  const activeFilterCount = [
    filters.program !== 'all',
    filters.drugName !== '',
    filters.expiryStatus !== 'all',
    filters.stockStatus !== 'all',
  ].filter(Boolean).length;

  // Fetch all branches for Admin/HO
  const fetchAllBranches = async () => {
    if (!userToken) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/all-branches`,
        {
          headers: {
            "X-User-Token": userToken,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch branch data");
      }

      const data = await response.json();
      const branchData: BranchData[] = data.map(
        (item: any) => ({
          userId: item.userId,
          userName: item.userName || "Unknown User",
          branchName: item.branchName || "Unknown Branch",
          userRole: item.userRole || "User",
          inventory: item.value || [],
        }),
      ).sort((a, b) => {
        // Sort branches alphabetically by city/location name
        return a.branchName.localeCompare(b.branchName);
      });

      setBranches(branchData);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to load branch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if ((userRole === 'Administrator' || userRole === 'Health Officer') && userToken) {
      fetchAllBranches();
    }
  }, [userToken, userRole]);

  const handleGenerateBranchReport = async (branchId: string, branchName: string) => {
    try {
      setGeneratingReportFor(branchId);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/generate-report/${branchId}`,
        {
          method: "POST",
          headers: {
            "X-User-Token": userToken!,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate report");
      }

      const reportData = await response.json();

      const excelBlob = await generateExcelReportWithBranchInfo(
        reportData.inventory,
        reportData.userMetadata.branch,
        reportData.userMetadata.name,
        branchId
      );

      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Physical_Inventory_${reportData.userMetadata.branch.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Report Generated", {
        description: `Report for ${branchName} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Report Generation Failed");
    } finally {
      setGeneratingReportFor(null);
    }
  };

  const handleExportAllBranches = async () => {
    if (!userToken) return;
    
    try {
      toast.info("Generating Multi-Branch Report", {
        description: "This may take a few moments..."
      });

      // Consolidate all branch inventories
      const allInventories = branches.flatMap(branch => 
        branch.inventory.map(item => ({
          ...item,
          branchName: branch.branchName,
          branchUser: branch.userName,
        }))
      );

      exportToExcel(allInventories, 'MediFlow_All_Branches_Consolidated_Report');
      toast.success('Excel Exported', { 
        description: `Consolidated report with ${allInventories.length} items from ${branches.length} branches.` 
      });
    } catch (error) {
      toast.error('Export Failed');
    }
  };

  // For Admin and Health Officer - Multi-Branch Reports
  if (userRole === 'Administrator' || userRole === 'Health Officer') {
    if (isLoading) {
      return (
        <div className="p-8 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#9867C5]/20 border-t-[#9867C5] rounded-full animate-spin" />
        </div>
      );
    }

    // Helper function to group branches by location
    const getUniqueLocations = () => {
      const locationMap = new Map<string, BranchData[]>();
      
      branches.forEach((branch) => {
        if (!locationMap.has(branch.branchName)) {
          locationMap.set(branch.branchName, []);
        }
        locationMap.get(branch.branchName)!.push(branch);
      });
      
      // Convert to array and sort by location name
      return Array.from(locationMap.entries())
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
    };

    const uniqueLocations = getUniqueLocations();
    const totalItems = branches.reduce((sum, b) => sum + b.inventory.length, 0);
    const totalBranches = branches.length;

    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
              <Building className="w-10 h-10 text-[#9867C5]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Multi-Branch Reports</h2>
              <p className="text-gray-600 font-medium">Generate consolidated and individual branch reports</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportAllBranches}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export All Branches
            </button>
            <button
              onClick={fetchAllBranches}
              className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-md bg-gradient-to-br from-[#9867C5] to-[#9867C5]/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Total Branches</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalBranches}</p>
                </div>
                <Building className="w-10 h-10 text-white/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Items</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{totalItems}</p>
                </div>
                <FileText className="w-10 h-10 text-blue-500/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Report Date</p>
                  <p className="text-lg font-bold text-gray-800 mt-1">{new Date().toLocaleDateString()}</p>
                </div>
                <Calendar className="w-10 h-10 text-[#9867C5]/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Reports List */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <FileText className="w-5 h-5 text-[#9867C5]" />
              Individual Branch Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {branches.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No branches found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {uniqueLocations.map(([locationName, locationBranches]) => (
                  <div key={locationName} className="space-y-3">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Building className="w-5 h-5 text-[#9867C5]" />
                      {locationName}
                      <span className="text-sm font-normal text-gray-600">
                        ({locationBranches.length} account{locationBranches.length !== 1 ? 's' : ''})
                      </span>
                    </h3>
                    {locationBranches.map((branch) => (
                      <div
                        key={branch.userId}
                        className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#9867C5]/10 rounded-lg flex items-center justify-center">
                            <Building className="w-5 h-5 text-[#9867C5]" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800">{branch.userName} - {branch.branchName}</h4>
                            <p className="text-sm text-gray-600">{branch.inventory.length} items • {branch.userRole}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleGenerateBranchReport(branch.userId, `${branch.userName} - ${branch.branchName}`)}
                          disabled={generatingReportFor === branch.userId}
                          className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          {generatingReportFor === branch.userId ? "Generating..." : "Generate Report"}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Format Info */}
        <Card className="border-l-4 border-[#9867C5] bg-[#9867C5]/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#9867C5] mt-1" />
              <div>
                <p className="font-semibold text-gray-800 mb-1">DOH Standard Format</p>
                <p className="text-sm text-gray-600">
                  All reports are generated using the official DOH Physical Inventory Report format (BGO.HSO.F.PHAR.009) 
                  with proper program grouping, merged cells, and government branding as per Department of Health reporting standards.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For Regular Staff - Standard Single Branch Report
  const handleExportExcel = () => {
    try {
      exportToExcel(inventory, 'MediFlow_Inventory_Report', branchName, userName);
      toast.success('Excel Exported', { description: 'The report has been downloaded.' });
    } catch (error) {
      toast.error('Export Failed', { description: 'Could not generate Excel file.' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
            <Pill className="w-10 h-10 text-[#9867C5]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Physical Inventory Report</h2>
            <p className="text-gray-600 font-medium">BGO.HSO.F.PHAR.009 | City Government of Baguio</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Report Header Info */}
      <Card className="border-none shadow-md bg-[#fff9c4]/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[#f57f17] font-bold uppercase">Health Services Office</p>
              <p className="font-semibold text-gray-800">City Government of Baguio</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Reporting Quarter</p>
              <p className="font-semibold text-gray-800">Q3 (July - September 2025)</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Total Items Tracked</p>
              <p className="font-semibold text-gray-800">{inventory.length} Batches</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Official Form</p>
              <p className="font-semibold text-[#9867C5]">DOH Augmentation/Donation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DOH Format Report Table */}
      <Card className="border-none shadow-md">
        <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <FileText className="w-5 h-5 text-[#9867C5]" />
            Inventory Report (DOH Format)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">No.</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Name & Description</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Program</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Beginning Inventory</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Items Received</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Unit</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Qty Received</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Unit Cost</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Total Cost</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Dispensed</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Stock on Hand</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Utilization %</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Expiry Date</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Expired</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="border border-gray-300 px-3 py-6 text-center text-gray-500">
                      No inventory data available
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((batch, index) => {
                    const totalCost = batch.quantityReceived * batch.unitCost;
                    const stockOnHand = getStockOnHand(batch);
                    const utilization = calculateUtilization(batch);
                    const expired = isExpired(batch.expirationDate);

                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">{index + 1}</td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">
                          <div>
                            <p className="font-medium">{batch.drugName}</p>
                            <p className="text-xs text-gray-500">{batch.dosage}</p>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">{batch.program}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-gray-700">{batch.beginningInventory}</td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">{batch.batchNumber}</td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">{batch.unit}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-gray-700">{batch.quantityReceived}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-gray-700">{formatPeso(batch.unitCost)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-medium text-gray-700">{formatPeso(totalCost)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-blue-600">{batch.quantityDispensed}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-[#9867C5]">{stockOnHand}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-gray-700">{utilization}%</td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">{batch.expirationDate}</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {expired ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">{batch.remarks || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Report Legend */}
      <Card className="border-l-4 border-[#9867C5] bg-[#9867C5]/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-[#9867C5] mt-1" />
            <div>
              <p className="font-semibold text-gray-800 mb-1">Official DOH Report Format</p>
              <p className="text-sm text-gray-600">
                This report follows the Department of Health Physical Inventory Report format (BGO.HSO.F.PHAR.009). 
                Export to Excel to generate the official formatted document with proper headers, merged cells, and program grouping.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}