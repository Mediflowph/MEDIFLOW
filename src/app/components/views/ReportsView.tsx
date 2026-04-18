import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, FileSpreadsheet, Pill, Building, RefreshCw, Calendar, Filter, X, ShieldCheck, ToggleLeft, ToggleRight, Edit, Trash2, Save } from 'lucide-react';
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
  onUpdateBatch?: (batchId: string, updates: Partial<InventoryBatch>) => void;
  onDeleteBatch?: (batchId: string) => void;
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
  category: string;
  drugName: string;
  expiryStatus: 'all' | 'expired' | 'near-expiry' | 'valid';
  stockStatus: 'all' | 'low' | 'normal' | 'out-of-stock';
}

export function ReportsView({ inventory, userToken, userRole = 'Staff', userName, branchName, onUpdateBatch, onDeleteBatch }: ReportsViewProps) {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingReportFor, setGeneratingReportFor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [datePeriod, setDatePeriod] = useState<'all' | 'monthly' | 'yearly'>('all');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InventoryBatch>>({});
  
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
    dateFrom: '',
    dateTo: '',
    program: 'all',
    category: 'all',
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
    const totalSupply = batch.beginningInventory + batch.quantityReceived;
    return totalSupply > 0 ? (Math.min((batch.quantityDispensed / totalSupply) * 100, 100)).toFixed(1) : '0.0';
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

      // Category filter
      if (filters.category !== 'all' && (batch.category || 'Others') !== filters.category) return false;

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
    }).sort((a, b) => {
      const programCmp = a.program.localeCompare(b.program);
      if (programCmp !== 0) return programCmp;
      return a.drugName.localeCompare(b.drugName);
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
      category: 'all',
      drugName: '',
      expiryStatus: 'all',
      stockStatus: 'all',
    });
    setDatePeriod('all');
  };

  const activeFilterCount = [
    filters.program !== 'all',
    filters.category !== 'all',
    filters.drugName !== '',
    filters.expiryStatus !== 'all',
    filters.stockStatus !== 'all',
    filters.dateFrom !== '' || filters.dateTo !== '',
  ].filter(Boolean).length;

  // Apply period preset → update dateFrom/dateTo
  const applyPeriodPreset = (period: 'all' | 'monthly' | 'yearly') => {
    setDatePeriod(period);
    const now = new Date();
    if (period === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setFilters(f => ({ ...f, dateFrom: start, dateTo: end }));
    } else if (period === 'yearly') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const end   = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      setFilters(f => ({ ...f, dateFrom: start, dateTo: end }));
    } else {
      setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }));
    }
  };

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
        (item: any) => {
          const rawInventory = item.inventory || item.value || [];
          // Transform SQL snake_case columns to camelCase InventoryBatch format
          const transformedInventory: InventoryBatch[] = rawInventory.map((inv: any) => ({
            id: inv.id,
            drugName: inv.drug_name || inv.drugName || '',
            program: inv.program || 'General',
            dosage: inv.dosage || '',
            unit: inv.unit || 'units',
            batchNumber: inv.batch_number || inv.batchNumber || '',
            beginningInventory: inv.quantity !== undefined ? inv.quantity : (inv.beginning_inventory || inv.beginningInventory || 0),
            quantityReceived: inv.quantity_received || inv.quantityReceived || 0,
            dateReceived: inv.date_received || inv.dateReceived || inv.created_at || '',
            unitCost: inv.unit_cost || inv.unit_price || inv.unitCost || 0,
            quantityDispensed: inv.quantity_dispensed || inv.quantityDispensed || 0,
            expirationDate: inv.expiration_date || inv.expiry_date || inv.expirationDate || '',
            remarks: inv.remarks || '',
            branchId: inv.branch_id || inv.branchId || inv.user_id || item.userId || '',
          }));
          return {
            userId: item.userId,
            userName: item.userName || "Unknown User",
            branchName: item.branchName || "Unknown Branch",
            userRole: item.userRole || "User",
            inventory: transformedInventory,
          };
        },
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

      // Find the branch from already-fetched data — NO server call needed
      const branch = branches.find(b => b.userId === branchId);
      if (!branch) {
        toast.error('Branch not found', { description: 'Could not locate branch data.' });
        return;
      }

      const excelBlob = generateExcelReportWithBranchInfo(
        branch.inventory,
        branch.branchName,
        branch.userName,
        branchId,
      );

      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Physical_Inventory_${branch.branchName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Report Generated', {
        description: `Report for ${branchName} has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Report Generation Failed');
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
                <Calendar className="w-10 h-10 text-[#9867C5]" />
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

  const handleEditBatch = (batchId: string) => {
    const batch = inventory.find(b => b.id === batchId);
    if (batch) {
      setEditingBatchId(batchId);
      setEditFormData(batch);
      // Scroll to edit form
      setTimeout(() => {
        const editForm = document.getElementById('edit-batch-form');
        if (editForm) editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleSaveEdit = () => {
    if (editingBatchId && onUpdateBatch) {
      onUpdateBatch(editingBatchId, editFormData);
      setEditingBatchId(null);
      setEditFormData({});
    }
  };

  const handleDeleteBatch = (batchId: string) => {
    const batch = inventory.find(b => b.id === batchId);
    if (!batch) return;
    if (!confirm(`Delete "${batch.drugName}" (Batch: ${batch.batchNumber})?`)) return;
    if (onDeleteBatch) {
      onDeleteBatch(batchId);
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
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-md border ${
              showFilters || activeFilterCount > 0
                ? 'bg-[#9867C5] text-white border-[#9867C5]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-[#9867C5] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#9867C5]" />
              Filter Report Data
            </h3>
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors">
              <X className="w-3 h-3" />
              Reset all
            </button>
          </div>

          {/* Period Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Period</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { value: 'all',     label: 'All Time' },
                { value: 'monthly', label: `This Month (${new Date().toLocaleString('default', { month: 'long' })})` },
                { value: 'yearly',  label: `This Year (${new Date().getFullYear()})` },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => applyPeriodPreset(opt.value as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    datePeriod === opt.value
                      ? 'bg-[#9867C5] text-white border-[#9867C5]'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#9867C5]/50'
                  }`}
                >
                  {datePeriod === opt.value && opt.value !== 'all' ? '✓ ' : ''}{opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setDatePeriod('all'); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setDatePeriod('all'); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>
          </div>

          {/* Program + Category + Drug + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Program */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Program</label>
              <select
                value={filters.program}
                onChange={e => setFilters(f => ({ ...f, program: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none bg-white"
              >
                <option value="all">All Programs</option>
                {uniquePrograms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Category
              </label>
              <select
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none bg-white"
              >
                <option value="all">All Categories</option>
                <option value="Antimicrobial">Antimicrobial</option>
                <option value="Non-antimicrobial">Non-antimicrobial</option>
                <option value="Others">Others</option>
              </select>
            </div>

            {/* Expiry Status */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiry Status</label>
              <select
                value={filters.expiryStatus}
                onChange={e => setFilters(f => ({ ...f, expiryStatus: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none bg-white"
              >
                <option value="all">All</option>
                <option value="valid">Valid (&gt;180 days)</option>
                <option value="near-expiry">Near Expiry (≤180 days)</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {/* Stock Status */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock Status</label>
              <select
                value={filters.stockStatus}
                onChange={e => setFilters(f => ({ ...f, stockStatus: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none bg-white"
              >
                <option value="all">All</option>
                <option value="normal">Normal Stock</option>
                <option value="low">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Drug Name search */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Drug Name Search</label>
            <input
              type="text"
              placeholder="Filter by drug name..."
              value={filters.drugName}
              onChange={e => setFilters(f => ({ ...f, drugName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
            />
          </div>

          {/* Active filter summary */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500 self-center">{filteredInventory.length} of {inventory.length} items shown</span>
              {filters.category !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  <ShieldCheck className="w-3 h-3" />
                  {filters.category}
                  <button onClick={() => setFilters(f => ({ ...f, category: 'all' }))} className="hover:text-red-500 ml-0.5">×</button>
                </span>
              )}
              {filters.program !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#9867C5]/10 text-[#9867C5] rounded-full text-xs font-medium">
                  {filters.program}
                  <button onClick={() => setFilters(f => ({ ...f, program: 'all' }))} className="hover:text-red-500 ml-0.5">×</button>
                </span>
              )}
              {(filters.dateFrom || filters.dateTo) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <Calendar className="w-3 h-3" />
                  {filters.dateFrom || '…'} → {filters.dateTo || '…'}
                  <button onClick={() => { setFilters(f => ({ ...f, dateFrom: '', dateTo: '' })); setDatePeriod('all'); }} className="hover:text-red-500 ml-0.5">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Report Header Info */}
      <div className="bg-[#fff9c4]/30 border border-[#fde68a] rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[#f57f17] font-bold uppercase">Drug Inventory System</p>
            <p className="font-semibold text-gray-800">{branchName || 'Drug Inventory System'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Period</p>
            <p className="font-semibold text-gray-800">
              {datePeriod === 'monthly' ? new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
              : datePeriod === 'yearly'  ? new Date().getFullYear().toString()
              : 'All Time'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Items Shown</p>
            <p className="font-semibold text-gray-800">{filteredInventory.length} of {inventory.length} Batches</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Category</p>
            <p className="font-semibold text-[#9867C5]">{filters.category === 'all' ? 'All Categories' : filters.category}</p>
          </div>
        </div>
      </div>

      {/* DOH Format Report Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
          <FileText className="w-5 h-5 text-[#9867C5]" />
          <span className="font-semibold text-gray-800">Inventory Report (DOH Format)</span>
          {activeFilterCount > 0 && (
            <span className="ml-auto text-xs bg-[#9867C5]/10 text-[#9867C5] px-2 py-0.5 rounded-full font-medium">
              {filteredInventory.length} results
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">No.</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Name & Description</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Program</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Category</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Beg. Inventory</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Batch/Lot No.</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Unit</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Qty Received</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Unit Cost</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Total Cost</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Dispensed</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Stock on Hand</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Utilization %</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Expiry Date</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Expired</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={16} className="border border-gray-300 px-3 py-8 text-center text-gray-500">
                    <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No inventory data matches the selected filters</p>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((batch, index) => {
                  const totalCost   = batch.quantityReceived * batch.unitCost;
                  const stockOnHand = getStockOnHand(batch);
                  const utilization = calculateUtilization(batch);
                  const expired     = isExpired(batch.expirationDate);
                  const cat         = batch.category || 'Others';

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
                      <td className="border border-gray-300 px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          cat === 'Antimicrobial'     ? 'bg-emerald-100 text-emerald-700' :
                          cat === 'Non-antimicrobial' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                        }`}>
                          {cat}
                        </span>
                      </td>
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
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {expired ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-gray-700">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditBatch(batch.id)}
                            className="text-sm text-gray-500 hover:text-[#9867C5] transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Form */}
      {editingBatchId && (
        <div id="edit-batch-form" className="bg-white rounded-xl border-2 border-[#9867C5] shadow-xl p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <Edit className="w-5 h-5 text-[#9867C5]" />
              Edit Inventory Batch
            </h3>
            <button onClick={() => setEditingBatchId(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Drug Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Drug Name</label>
              <input
                type="text"
                value={editFormData.drugName || ''}
                onChange={e => setEditFormData(f => ({ ...f, drugName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Program */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Program</label>
              <select
                value={editFormData.program || 'General'}
                onChange={e => setEditFormData(f => ({ ...f, program: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none bg-white"
              >
                <option value="General">General</option>
                {uniquePrograms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Category
              </label>
              <select
                value={editFormData.category || 'Others'}
                onChange={e => setEditFormData(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none bg-white"
              >
                <option value="Others">Others</option>
                <option value="Antimicrobial">Antimicrobial</option>
                <option value="Non-antimicrobial">Non-antimicrobial</option>
              </select>
            </div>

            {/* Dosage */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dosage</label>
              <input
                type="text"
                value={editFormData.dosage || ''}
                onChange={e => setEditFormData(f => ({ ...f, dosage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Unit */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</label>
              <input
                type="text"
                value={editFormData.unit || 'units'}
                onChange={e => setEditFormData(f => ({ ...f, unit: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Batch Number */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch/Lot No.</label>
              <input
                type="text"
                value={editFormData.batchNumber || ''}
                onChange={e => setEditFormData(f => ({ ...f, batchNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Beginning Inventory */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Beg. Inventory</label>
              <input
                type="number"
                value={editFormData.beginningInventory || 0}
                onChange={e => setEditFormData(f => ({ ...f, beginningInventory: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Quantity Received */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty Received</label>
              <input
                type="number"
                value={editFormData.quantityReceived || 0}
                onChange={e => setEditFormData(f => ({ ...f, quantityReceived: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Date Received */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date Received
              </label>
              <input
                type="date"
                value={editFormData.dateReceived || ''}
                onChange={e => setEditFormData(f => ({ ...f, dateReceived: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Unit Cost */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Cost</label>
              <input
                type="number"
                step="0.01"
                value={editFormData.unitCost || 0}
                onChange={e => setEditFormData(f => ({ ...f, unitCost: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Quantity Dispensed */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dispensed</label>
              <input
                type="number"
                value={editFormData.quantityDispensed || 0}
                onChange={e => setEditFormData(f => ({ ...f, quantityDispensed: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Expiration Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Expiry Date
              </label>
              <input
                type="date"
                value={editFormData.expirationDate || ''}
                onChange={e => setEditFormData(f => ({ ...f, expirationDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Remarks</label>
              <input
                type="text"
                value={editFormData.remarks || ''}
                onChange={e => setEditFormData(f => ({ ...f, remarks: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#9867C5] outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <button
              onClick={() => setEditingBatchId(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors shadow-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Report Legend */}
      
    </div>
  );
}