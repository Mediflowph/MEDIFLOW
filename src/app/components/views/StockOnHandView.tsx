import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Package, Calendar, AlertTriangle, Building, TrendingDown, RefreshCw, Search, AlertCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { InventoryBatch, DrugSummary } from '@/app/types/inventory';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';

interface StockOnHandViewProps {
  inventory: InventoryBatch[];
  onDeleteBatch?: (batchId: string) => void;
  userToken?: string;
  userRole?: string;
}

interface BranchData {
  userId: string;
  userName: string;
  branchName: string;
  userRole: string;
  inventory: InventoryBatch[];
}

interface BranchStockSummary {
  branchId: string;
  branchName: string;
  userName: string;
  totalItems: number;
  totalStock: number;
  lowStockItems: number;
  expiredItems: number;
  criticalExpiryItems: number;
  topDrugs: { name: string; stock: number }[];
}

export function StockOnHandView({ inventory, onDeleteBatch, userToken, userRole = 'Staff' }: StockOnHandViewProps) {
  const [expandedDrugs, setExpandedDrugs] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string>('');

  // Helper functions - MUST be defined before use
  const isExpired = (expirationDate: string) => {
    return new Date(expirationDate) < new Date();
  };

  const daysUntilExpiry = (expirationDate: string) => {
    return Math.floor((new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const toggleDrug = (drugName: string) => {
    const newExpanded = new Set(expandedDrugs);
    if (newExpanded.has(drugName)) {
      newExpanded.delete(drugName);
    } else {
      newExpanded.add(drugName);
    }
    setExpandedDrugs(newExpanded);
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

  // Fetch all branches for Staff - Stock Locator feature  
  const fetchStaffBranches = async () => {
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
      console.error("Error fetching branches for staff:", error);
      toast.error("Failed to load multi-branch data");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate branch stock summaries
  const generateBranchStockSummaries = (): BranchStockSummary[] => {
    return branches.map((branch) => {
      const now = new Date();
      let totalStock = 0;
      let lowStockItems = 0;
      let expiredItems = 0;
      let criticalExpiryItems = 0;
      const drugStocks: { [key: string]: number } = {};

      branch.inventory.forEach((item) => {
        const stock = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
        totalStock += stock;

        // Accumulate by drug name
        drugStocks[item.drugName] = (drugStocks[item.drugName] || 0) + stock;

        const daysUntilExpiry = Math.floor((new Date(item.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (stock > 0 && stock < 50) lowStockItems++;
        if (daysUntilExpiry < 0) expiredItems++;
        if (daysUntilExpiry >= 0 && daysUntilExpiry <= 180) criticalExpiryItems++;
      });

      // Get top 5 drugs by stock
      const topDrugs = Object.entries(drugStocks)
        .map(([name, stock]) => ({ name, stock }))
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 5);

      return {
        branchId: branch.userId,
        branchName: branch.branchName,
        userName: branch.userName,
        totalItems: branch.inventory.length,
        totalStock,
        lowStockItems,
        expiredItems,
        criticalExpiryItems,
        topDrugs,
      };
    });
  };

  // For Admin and Health Officer - Multi-Branch Stock Overview
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
    const branchSummaries = generateBranchStockSummaries();
    const totalStockAcrossAll = branchSummaries.reduce((sum, b) => sum + b.totalStock, 0);
    const totalItemsAcrossAll = branchSummaries.reduce((sum, b) => sum + b.totalItems, 0);
    const totalLowStock = branchSummaries.reduce((sum, b) => sum + b.lowStockItems, 0);
    const totalExpired = branchSummaries.reduce((sum, b) => sum + b.expiredItems, 0);

    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Multi-Branch Stock Overview</h2>
            <p className="text-gray-600">Consolidated inventory across all branch locations</p>
          </div>
          <button
            onClick={fetchAllBranches}
            className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-md bg-gradient-to-br from-[#9867C5] to-[#9867C5]/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Total Stock</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalStockAcrossAll.toLocaleString()}</p>
                  <p className="text-white/60 text-xs mt-1">units across all branches</p>
                </div>
                <Package className="w-10 h-10 text-white/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Items</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{totalItemsAcrossAll}</p>
                  <p className="text-gray-500 text-xs mt-1">unique batches</p>
                </div>
                <Package className="w-10 h-10 text-blue-500/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Low Stock</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">{totalLowStock}</p>
                  <p className="text-gray-500 text-xs mt-1">items need attention</p>
                </div>
                <TrendingDown className="w-10 h-10 text-orange-500/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Expired</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{totalExpired}</p>
                  <p className="text-gray-500 text-xs mt-1">items expired</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-500/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Stock Cards - Grouped by Location */}
        <div className="space-y-6">
          {uniqueLocations.map(([locationName, locationBranches]) => {
            return (
              <Card key={locationName} className="border-none shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
                  <CardTitle className="flex items-center gap-3 text-gray-800">
                    <Building className="w-6 h-6 text-[#9867C5]" />
                    {locationName}
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      ({locationBranches.length} Staff Account{locationBranches.length !== 1 ? 's' : ''})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {locationBranches.map((branch) => {
                      const summary = branchSummaries.find(s => s.branchId === branch.userId);
                      if (!summary) return null;

                      const isExpanded = expandedBranch === summary.branchId;

                      return (
                        <Card key={summary.branchId} className="border-none shadow-md">
                          <CardHeader
                            className="border-b bg-gradient-to-r from-gray-50 to-gray-100 cursor-pointer"
                            onClick={() => setExpandedBranch(isExpanded ? null : summary.branchId)}
                          >
                            <div className="flex items-center justify-between">
                              <CardTitle className="flex items-center gap-3 text-gray-800">
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-[#9867C5]" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-[#9867C5]" />
                                )}
                                <Building className="w-5 h-5 text-[#9867C5]" />
                                {summary.userName} - {summary.branchName}
                              </CardTitle>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-[#9867C5]">{summary.totalStock.toLocaleString()}</p>
                                  <p className="text-xs text-gray-500">units in stock</p>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-6">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                              <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Total Items</p>
                                <p className="text-xl font-bold text-blue-600">{summary.totalItems}</p>
                              </div>
                              {summary.lowStockItems > 0 && (
                                <div className="text-center p-3 bg-orange-50 rounded-lg">
                                  <p className="text-xs text-gray-600 mb-1">Low Stock</p>
                                  <p className="text-xl font-bold text-orange-600">{summary.lowStockItems}</p>
                                </div>
                              )}
                              {summary.criticalExpiryItems > 0 && (
                                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                  <p className="text-xs text-gray-600 mb-1">Critical Exp</p>
                                  <p className="text-xl font-bold text-yellow-600">{summary.criticalExpiryItems}</p>
                                </div>
                              )}
                              {summary.expiredItems > 0 && (
                                <div className="text-center p-3 bg-red-50 rounded-lg">
                                  <p className="text-xs text-gray-600 mb-1">Expired</p>
                                  <p className="text-xl font-bold text-red-600">{summary.expiredItems}</p>
                                </div>
                              )}
                            </div>

                            {/* Detailed Inventory Table */}
                            {isExpanded && (
                              <div className="mt-4 border-t pt-4">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Detailed Inventory</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs text-gray-600">Drug Name</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-600">Program</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-600">Batch</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-600">Stock</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-600">Expiry</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-600">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {branch.inventory.map((item) => {
                                        const stock = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
                                        const daysUntilExpiry = Math.floor(
                                          (new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                                        );
                                        const isExpired = daysUntilExpiry < 0;
                                        const isCritical = daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
                                        const isLowStock = stock > 0 && stock < 50;

                                        return (
                                          <tr key={item.id} className="border-t border-gray-200">
                                            <td className="px-3 py-2 text-gray-800">{item.drugName}</td>
                                            <td className="px-3 py-2">
                                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                                {item.program}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">{item.batchNumber}</td>
                                            <td className="px-3 py-2 font-semibold text-gray-800">{stock}</td>
                                            <td className="px-3 py-2 text-gray-600">{item.expirationDate}</td>
                                            <td className="px-3 py-2">
                                              <div className="flex gap-1">
                                                {isExpired && (
                                                  <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                                    Expired
                                                  </span>
                                                )}
                                                {isCritical && !isExpired && (
                                                  <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                                    Critical
                                                  </span>
                                                )}
                                                {isLowStock && (
                                                  <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                                                    Low
                                                  </span>
                                                )}
                                                {!isExpired && !isCritical && !isLowStock && (
                                                  <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                                    Good
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // For Regular Staff - Local Inventory View
  
  // Group inventory by drug name
  const drugSummaries = inventory.reduce((acc, batch) => {
    const existingDrug = acc.find(d => d.drugName === batch.drugName);
    const stock = batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
    const utilization = (batch.beginningInventory + batch.quantityReceived) > 0
      ? (batch.quantityDispensed / (batch.beginningInventory + batch.quantityReceived)) * 100
      : 0;

    if (existingDrug) {
      existingDrug.totalStock += stock;
      existingDrug.batches.push(batch);
      // Update earliest expiry if this batch expires sooner
      if (new Date(batch.expirationDate) < new Date(existingDrug.earliestExpiry)) {
        existingDrug.earliestExpiry = batch.expirationDate;
      }
    } else {
      acc.push({
        drugName: batch.drugName,
        totalStock: stock,
        program: batch.program,
        earliestExpiry: batch.expirationDate,
        utilization,
        batches: [batch],
      });
    }
    
    return acc;
  }, [] as DrugSummary[]);

  // Calculate utilization for each drug
  drugSummaries.forEach(drug => {
    const totalReceived = drug.batches.reduce((sum, b) => sum + b.beginningInventory + b.quantityReceived, 0);
    const totalDispensed = drug.batches.reduce((sum, b) => sum + b.quantityDispensed, 0);
    drug.utilization = totalReceived > 0 ? Math.min((totalDispensed / totalReceived) * 100, 100) : 0;
  });

  // Filter by search query
  const filteredSummaries = searchQuery.trim()
    ? drugSummaries.filter(drug => 
        drug.drugName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : drugSummaries;

  // Apply alphabet filter
  const alphabetFiltered = selectedLetter
    ? filteredSummaries.filter(drug => 
        drug.drugName.toUpperCase().startsWith(selectedLetter)
      )
    : filteredSummaries;

  // Smart sorting: Expired > Near-Expiry > Low Stock > Normal
  const sortedSummaries = [...alphabetFiltered].sort((a, b) => {
    const aDays = daysUntilExpiry(a.earliestExpiry);
    const bDays = daysUntilExpiry(b.earliestExpiry);
    const aExpired = aDays < 0;
    const bExpired = bDays < 0;
    const aNearExpiry = aDays >= 0 && aDays <= 180;
    const bNearExpiry = bDays >= 0 && bDays <= 180;
    const aLowStock = a.totalStock > 0 && a.totalStock < 50;
    const bLowStock = b.totalStock > 0 && b.totalStock < 50;

    // Priority 1: Expired drugs first
    if (aExpired && !bExpired) return -1;
    if (!aExpired && bExpired) return 1;

    // Priority 2: Near-expiry drugs (within 180 days)
    if (aNearExpiry && !bNearExpiry) return -1;
    if (!aNearExpiry && bNearExpiry) return 1;

    // Priority 3: Low stock drugs
    if (aLowStock && !bLowStock) return -1;
    if (!aLowStock && bLowStock) return 1;

    // Priority 4: Sort by total stock descending (most stock first)
    return b.totalStock - a.totalStock;
  });

  // Calculate summary stats
  const totalStock = drugSummaries.reduce((sum, drug) => sum + drug.totalStock, 0);
  const expiredCount = drugSummaries.filter(drug => daysUntilExpiry(drug.earliestExpiry) < 0).length;
  const nearExpiryCount = drugSummaries.filter(drug => {
    const days = daysUntilExpiry(drug.earliestExpiry);
    return days >= 0 && days <= 180;
  }).length;
  const lowStockCount = drugSummaries.filter(drug => drug.totalStock > 0 && drug.totalStock < 50).length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Stock on Hand</h2>
        <p className="text-gray-600">Current inventory status with batch-level tracking</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-[#9867C5] to-[#9867C5]/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Total Stock</p>
                <p className="text-3xl font-bold text-white mt-1">{totalStock.toLocaleString()}</p>
                <p className="text-white/60 text-xs mt-1">{drugSummaries.length} unique drugs</p>
              </div>
              <Package className="w-10 h-10 text-white/40" />
            </div>
          </CardContent>
        </Card>

        {expiredCount > 0 && (
          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Expired</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{expiredCount}</p>
                  <p className="text-gray-500 text-xs mt-1">needs immediate action</p>
                </div>
                <XCircle className="w-10 h-10 text-red-500/40" />
              </div>
            </CardContent>
          </Card>
        )}

        {nearExpiryCount > 0 && (
          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Near Expiry</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{nearExpiryCount}</p>
                  <p className="text-gray-500 text-xs mt-1">within 180 days</p>
                </div>
                <Clock className="w-10 h-10 text-yellow-500/40" />
              </div>
            </CardContent>
          </Card>
        )}

        {lowStockCount > 0 && (
          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Low Stock</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">{lowStockCount}</p>
                  <p className="text-gray-500 text-xs mt-1">below 50 units</p>
                </div>
                <TrendingDown className="w-10 h-10 text-orange-500/40" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search Bar */}
      <Card className="border-none shadow-md">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drug name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9867C5] focus:border-transparent"
            />
          </div>
        </CardContent>
      </Card>

      {/* Alphabet Filter */}
      <Card className="border-none shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Filter by:</span>
            <button
              onClick={() => setSelectedLetter('')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedLetter === '' 
                  ? 'bg-[#9867C5] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedLetter === letter 
                    ? 'bg-[#9867C5] text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drug List */}
      {sortedSummaries.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="py-16 text-center text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">
              {searchQuery ? `No drugs found matching "${searchQuery}"` : 'No inventory items yet'}
            </p>
            <p className="text-sm mt-2">
              {searchQuery ? 'Try a different search term' : 'Add stock to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedSummaries.map((drug) => {
            const isExpanded = expandedDrugs.has(drug.drugName);
            const days = daysUntilExpiry(drug.earliestExpiry);
            const isExpiredDrug = days < 0;
            const isNearExpiry = days >= 0 && days <= 180;
            const isLowStock = drug.totalStock > 0 && drug.totalStock < 50;

            return (
              <Card key={drug.drugName} className="border-none shadow-md">
                <CardHeader
                  className={`border-b cursor-pointer ${
                    isExpiredDrug
                      ? 'bg-gradient-to-r from-red-50 to-red-100'
                      : isNearExpiry
                      ? 'bg-gradient-to-r from-yellow-50 to-yellow-100'
                      : 'bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5'
                  }`}
                  onClick={() => toggleDrug(drug.drugName)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-gray-800">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[#9867C5]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#9867C5]" />
                      )}
                      <Package className="w-5 h-5 text-[#9867C5]" />
                      {drug.drugName}
                    </CardTitle>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">{drug.program}</p>
                        <p className="text-2xl font-bold text-[#9867C5]">{drug.totalStock.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-1">{drug.batches.length} batch{drug.batches.length !== 1 ? 'es' : ''}</p>
                      </div>
                      <div className="flex gap-2">
                        {isExpiredDrug && (
                          <div className="px-3 py-2 bg-red-100 rounded-lg text-center">
                            <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                            <p className="text-xs font-semibold text-red-700">Expired</p>
                          </div>
                        )}
                        {!isExpiredDrug && isNearExpiry && (
                          <div className="px-3 py-2 bg-yellow-100 rounded-lg text-center">
                            <Clock className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                            <p className="text-xs font-semibold text-yellow-700">{days} days</p>
                          </div>
                        )}
                        {isLowStock && (
                          <div className="px-3 py-2 bg-orange-100 rounded-lg text-center">
                            <TrendingDown className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                            <p className="text-xs font-semibold text-orange-700">Low</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Batch #</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Dosage</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Beginning</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Received</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Dispensed</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">On Hand</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Expiration</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drug.batches.map((batch) => {
                            const stock = batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
                            const batchDays = daysUntilExpiry(batch.expirationDate);
                            const isBatchExpired = batchDays < 0;
                            const isBatchNearExpiry = batchDays >= 0 && batchDays <= 180;

                            return (
                              <tr
                                key={batch.id}
                                className={`border-t ${
                                  isBatchExpired ? 'bg-red-50' : isBatchNearExpiry ? 'bg-yellow-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-4 py-3 font-medium text-gray-800">{batch.batchNumber}</td>
                                <td className="px-4 py-3 text-gray-600">{batch.dosage}</td>
                                <td className="px-4 py-3 text-gray-600">{batch.beginningInventory}</td>
                                <td className="px-4 py-3 text-green-600 font-semibold">+{batch.quantityReceived}</td>
                                <td className="px-4 py-3 text-red-600 font-semibold">-{batch.quantityDispensed}</td>
                                <td className="px-4 py-3 font-bold text-lg text-[#9867C5]">{stock}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <div>
                                      <p
                                        className={`text-sm ${
                                          isBatchExpired ? 'text-red-600 font-semibold' : isBatchNearExpiry ? 'text-orange-600' : 'text-gray-600'
                                        }`}
                                      >
                                        {batch.expirationDate}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {isBatchExpired ? 'Expired' : `${batchDays} days left`}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    {isBatchExpired && (
                                      <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                                        Expired
                                      </span>
                                    )}
                                    {!isBatchExpired && isBatchNearExpiry && (
                                      <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-semibold">
                                        Near Expiry
                                      </span>
                                    )}
                                    {stock < 50 && stock > 0 && (
                                      <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold">
                                        Low Stock
                                      </span>
                                    )}
                                    {stock === 0 && (
                                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                                        Out of Stock
                                      </span>
                                    )}
                                    {stock >= 50 && !isBatchExpired && !isBatchNearExpiry && (
                                      <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                        Good
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}