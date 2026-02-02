import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Package, Building, RefreshCw, Search, AlertCircle, Mail, Phone, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { InventoryBatch } from '@/app/types/inventory';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';
import { supabase } from '@/app/utils/supabase';

interface StockLocatorViewProps {
  userToken?: string;
}

interface BranchData {
  userId: string;
  userName: string;
  branchName: string;
  userRole: string;
  userEmail?: string;
  userPhone?: string;
  inventory: InventoryBatch[];
}

interface DrugLocation {
  drugName: string;
  branchName: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userId: string;
  stock: number;
  batchNumber: string;
  dosage: string;
  program: string;
  expirationDate: string;
  daysUntilExpiry: number;
}

export function StockLocatorView({ userToken }: StockLocatorViewProps) {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDrugs, setExpandedDrugs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

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

  // Fetch all branches for Stock Locator
  const fetchAllBranches = async () => {
    if (!userToken) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Stock Locator: Fetching all branches...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/all-branches`,
        {
          headers: {
            "X-User-Token": userToken,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      console.log('🔍 Stock Locator: Response status:', response.status);

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          const errorData = await response.json();
          console.error('🔍 Stock Locator: Permission error:', errorData);
          setError("You don't have permission to access multi-branch data. Please contact your administrator.");
          toast.error("Access denied. Administrator privileges required.");
        } else {
          console.error('🔍 Stock Locator: Server error:', response.status);
          setError("Failed to load branch data. Please try again later.");
          toast.error("Failed to load multi-branch data");
        }
        return;
      }

      const data = await response.json();
      console.log('🔍 Stock Locator: Received data:', data);
      
      // Check if data is empty or invalid
      if (!Array.isArray(data)) {
        console.error('🔍 Stock Locator: Invalid data format:', typeof data);
        setError("Invalid data received from server.");
        return;
      }
      
      console.log(`🔍 Stock Locator: Processing ${data.length} branches...`);
      
      const branchData: BranchData[] = data.map(
        (item: any) => ({
          userId: item.userId,
          userName: item.userName || "Unknown User",
          branchName: item.branchName || "Unknown Branch",
          userRole: item.userRole || "User",
          userEmail: item.userEmail,
          userPhone: item.userPhone,
          inventory: item.value || [],
        }),
      );

      console.log('🔍 Stock Locator: Processed branches:', branchData.length);
      console.log('🔍 Stock Locator: Total inventory items across all branches:', 
        branchData.reduce((sum, b) => sum + (b.inventory?.length || 0), 0)
      );

      setBranches(branchData);
      setError(null);
      toast.success(`Loaded data from ${branchData.length} branch${branchData.length !== 1 ? 'es' : ''}`);
    } catch (error) {
      console.error("🔍 Stock Locator: Error fetching branches:", error);
      setError("Network error. Please check your connection and try again.");
      toast.error("Failed to load multi-branch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userToken) {
      fetchAllBranches();
    }
  }, [userToken]);

  // Get user info from Supabase
  useEffect(() => {
    const checkUserRole = async () => {
      if (!userToken) return;
      
      const { data: { user } } = await supabase.auth.getUser(userToken);
      console.log('🔍 Stock Locator - Current User Role:', user?.user_metadata?.role);
      console.log('🔍 Stock Locator - User Email:', user?.email);
      console.log('🔍 Stock Locator - User Name:', user?.user_metadata?.name);
    };
    
    checkUserRole();
  }, [userToken]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#9867C5]/20 border-t-[#9867C5] rounded-full animate-spin" />
      </div>
    );
  }

  // Collect all drugs from all branches for search
  const allDrugLocations: DrugLocation[] = [];
  
  branches.forEach(branch => {
    branch.inventory.forEach(item => {
      const stock = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
      if (stock > 0) {  // Only show items with stock
        allDrugLocations.push({
          drugName: item.drugName,
          branchName: branch.branchName,
          userName: branch.userName,
          userEmail: branch.userEmail,
          userPhone: branch.userPhone,
          userId: branch.userId,
          stock,
          batchNumber: item.batchNumber,
          dosage: item.dosage,
          program: item.program,
          expirationDate: item.expirationDate,
          daysUntilExpiry: daysUntilExpiry(item.expirationDate)
        });
      }
    });
  });

  // Filter by search query
  const filteredLocations = searchQuery.trim()
    ? allDrugLocations.filter(item => 
        item.drugName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allDrugLocations;

  // Sort by drug name, then branch
  const sortedLocations = [...filteredLocations].sort((a, b) => {
    if (a.drugName !== b.drugName) {
      return a.drugName.localeCompare(b.drugName);
    }
    return a.branchName.localeCompare(b.branchName);
  });

  // Group by drug name
  const groupedDrugs: { [key: string]: DrugLocation[] } = {};
  sortedLocations.forEach(location => {
    if (!groupedDrugs[location.drugName]) {
      groupedDrugs[location.drugName] = [];
    }
    groupedDrugs[location.drugName].push(location);
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Stock Locator</h2>
          <p className="text-gray-600">Search and locate drugs across all branch locations</p>
        </div>
        <button
          onClick={fetchAllBranches}
          className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              📍 Multi-Branch Stock Locator
            </p>
            <p className="text-sm text-blue-700 mt-1">
              This tool searches inventory across all <strong>Pharmacy Staff</strong> branch accounts. 
              Administrator and Health Officer accounts are not included as they manage branches rather than maintain inventory.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="border-none shadow-md">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drug name across all branches..."
              className="w-full pl-14 pr-4 py-4 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9867C5] focus:border-transparent"
              autoFocus
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 mt-3">
              Found {filteredLocations.length} result{filteredLocations.length !== 1 ? 's' : ''} across {Object.keys(groupedDrugs).length} drug{Object.keys(groupedDrugs).length !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {error ? (
        <Card className="border-none shadow-md">
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <p className="text-lg font-semibold text-gray-800 mb-2">Unable to Load Data</p>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchAllBranches}
              className="px-6 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      ) : searchQuery.trim() === '' ? (
        <Card className="border-none shadow-md">
          <CardContent className="py-16 text-center text-gray-500">
            <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Start typing a drug name to search across all branches</p>
            <p className="text-sm mt-2">e.g., "Amoxicillin", "Paracetamol", "Metformin"</p>
          </CardContent>
        </Card>
      ) : filteredLocations.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="py-16 text-center text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No drugs found matching "{searchQuery}"</p>
            <p className="text-sm mt-2">Try a different search term</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedDrugs).map(([drugName, locations]) => {
            const totalStock = locations.reduce((sum, loc) => sum + loc.stock, 0);
            const isExpanded = expandedDrugs.has(drugName);

            return (
              <Card key={drugName} className="border-none shadow-md">
                <CardHeader
                  className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5 cursor-pointer"
                  onClick={() => toggleDrug(drugName)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-gray-800">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[#9867C5]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#9867C5]" />
                      )}
                      <Package className="w-5 h-5 text-[#9867C5]" />
                      {drugName}
                    </CardTitle>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Found in {locations.length} location{locations.length !== 1 ? 's' : ''}</p>
                        <p className="text-2xl font-bold text-[#9867C5]">{totalStock.toLocaleString()} units</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-6">
                    {/* Remove overflow-x-auto to prevent tooltip clipping */}
                    <div>
                      {/* Group locations by branch */}
                      {(() => {
                        // Group by branch name
                        const branchGroups = new Map<string, DrugLocation[]>();
                        locations.forEach(loc => {
                          if (!branchGroups.has(loc.branchName)) {
                            branchGroups.set(loc.branchName, []);
                          }
                          branchGroups.get(loc.branchName)!.push(loc);
                        });

                        return (
                          <div className="space-y-4">
                            {Array.from(branchGroups.entries()).map(([branchName, branchLocations]) => {
                              const totalBranchStock = branchLocations.reduce((sum, loc) => sum + loc.stock, 0);
                              const sampleLocation = branchLocations[0]; // For contact info

                              return (
                                <div key={`${drugName}-${branchName}`} className="border border-gray-200 rounded-lg overflow-hidden">
                                  {/* Branch Header */}
                                  <div className="bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5 px-4 py-3 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="group relative">
                                          <div className="flex items-center gap-2 cursor-help">
                                            <Building className="w-5 h-5 text-[#9867C5]" />
                                            <h3 className="font-bold text-gray-800">{branchName}</h3>
                                          </div>
                                          {/* Contact Info Tooltip - Fixed positioning */}
                                          <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-[100] pointer-events-none">
                                            <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl min-w-[250px] whitespace-normal">
                                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
                                                <Building className="w-4 h-4 text-[#9867C5]" />
                                                <p className="font-semibold">{branchName}</p>
                                              </div>
                                              <div className="space-y-1.5">
                                                {sampleLocation.userEmail && (
                                                  <div className="flex items-center gap-2">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                    <p className="text-gray-300">{sampleLocation.userEmail}</p>
                                                  </div>
                                                )}
                                                {sampleLocation.userPhone && (
                                                  <div className="flex items-center gap-2">
                                                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                    <p className="text-gray-300">{sampleLocation.userPhone}</p>
                                                  </div>
                                                )}
                                                {!sampleLocation.userEmail && !sampleLocation.userPhone && (
                                                  <p className="text-gray-500 italic text-xs mt-1">No contact information available</p>
                                                )}
                                              </div>
                                              {/* Arrow pointing up */}
                                              <div className="absolute left-4 bottom-full w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-gray-900"></div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600">{branchLocations.length} batch{branchLocations.length !== 1 ? 'es' : ''}</span>
                                        <span className="px-3 py-1 bg-[#9867C5] text-white rounded-full font-bold">
                                          {totalBranchStock.toLocaleString()} units
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Batch Table with horizontal scroll only on table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Dosage</th>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Program</th>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Batch Number</th>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Stock</th>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Expiration</th>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {branchLocations.map((location, idx) => {
                                          const isExpiredItem = location.daysUntilExpiry < 0;
                                          const isNearExpiry = location.daysUntilExpiry >= 0 && location.daysUntilExpiry <= 180;
                                          const isLowStock = location.stock > 0 && location.stock < 50;

                                          return (
                                            <tr 
                                              key={idx} 
                                              className={`border-t ${isExpiredItem ? 'bg-red-50' : isNearExpiry ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                                            >
                                              <td className="px-4 py-3 text-gray-600">{location.dosage}</td>
                                              <td className="px-4 py-3">
                                                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                                  {location.program}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 text-gray-600">{location.batchNumber}</td>
                                              <td className="px-4 py-3">
                                                <span className="font-bold text-lg text-[#9867C5]">{location.stock}</span>
                                              </td>
                                              <td className="px-4 py-3">
                                                <div>
                                                  <p className={`text-sm ${isExpiredItem ? 'text-red-600 font-semibold' : isNearExpiry ? 'text-orange-600' : 'text-gray-600'}`}>
                                                    {location.expirationDate}
                                                  </p>
                                                  <p className="text-xs text-gray-500">
                                                    {isExpiredItem 
                                                      ? `${Math.abs(location.daysUntilExpiry)} days overdue`
                                                      : `${location.daysUntilExpiry} days left`
                                                    }
                                                  </p>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                  {isExpiredItem && (
                                                    <span className="inline-block px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold">
                                                      EXPIRED
                                                    </span>
                                                  )}
                                                  {!isExpiredItem && isNearExpiry && location.daysUntilExpiry <= 30 && (
                                                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                                                      Critical (≤30d)
                                                    </span>
                                                  )}
                                                  {!isExpiredItem && isNearExpiry && location.daysUntilExpiry > 30 && (
                                                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-semibold">
                                                      Near Expiry
                                                    </span>
                                                  )}
                                                  {location.stock >= 50 && !isExpiredItem && !isNearExpiry && (
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
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
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