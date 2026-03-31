import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { authManager } from '@/app/utils/authManager';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { isLowStock, getStockStatus, calculateReorderPoint } from '@/app/utils/reorderPoint';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { InventoryBatch } from '@/app/types/inventory';
import { 
  RefreshCw, 
  XCircle, 
  AlertTriangle, 
  Calendar, 
  TrendingDown, 
  Building, 
  Package, 
  Pill, 
  AlertCircle, 
  FileSpreadsheet, 
  PackagePlus,
  Phone,
  User
} from 'lucide-react';

interface AlertsViewProps {
  inventory: InventoryBatch[];
  userToken?: string;
  userRole?: string;
  branchName?: string;
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

interface BranchAlert {
  branchId: string;
  branchName: string;
  userName: string;
  item: InventoryBatch;
  alertType: 'expired' | 'critical' | 'nearExpiry' | 'lowStock';
  severity: 'high' | 'medium' | 'low';
  daysUntilExpiry?: number;
  stockLevel?: number;
}

export function AlertsView({ inventory, userToken, userRole = 'Staff', branchName }: AlertsViewProps) {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [branchAlerts, setBranchAlerts] = useState<BranchAlert[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [allBranches, setAllBranches] = useState<Array<{id: string, name: string}>>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(userToken || null);
  // Track live receiving events for the staff view
  const [liveReceivingEvents, setLiveReceivingEvents] = useState<InventoryBatch[]>([]);
  const [hasNewReceiving, setHasNewReceiving] = useState(false);

  const now = new Date();

  // Get fresh token whenever needed using centralized auth manager
  const getFreshToken = async (): Promise<string | null> => {
    try {
      const token = await authManager.getToken();
      if (token) {
        setCurrentToken(token);
      }
      return token;
    } catch (error) {
      console.error('❌ Error getting token:', error);
      return null;
    }
  };

  // Update token when prop changes
  useEffect(() => {
    if (userToken) {
      setCurrentToken(userToken);
    }
  }, [userToken]);

  // Fetch all branches for HO and Admin
  const fetchAllBranches = async () => {
    if (!currentToken) {
      // Try to get a fresh token
      const freshToken = await getFreshToken();
      if (!freshToken) return;
    }
    
    try {
      setIsLoading(true);
      
      // First, fetch all branches from the branches table
      const branchesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/branches`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );
      
      if (branchesResponse.ok) {
        const branchesData = await branchesResponse.json();
        setAllBranches(branchesData || []);
        console.log('✅ Fetched all branches:', branchesData);
      }
      
      // Then fetch inventory data for branches with users
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/all-branches`,
        {
          headers: {
            "X-User-Token": currentToken!,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server response error:', response.status, errorText);
        
        // Check if it's a 502 or HTML error response (deployment issue)
        if (response.status === 502 || errorText.includes('<!DOCTYPE html>')) {
          throw new Error("⚠️ Server deployment error (502). The Supabase Edge Function is not responding. Please contact administrator to redeploy.");
        }
        
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
            beginningInventory: inv.beginning_inventory !== undefined ? inv.beginning_inventory : (inv.quantity || 0),
            quantityReceived: inv.quantity_received || inv.quantityReceived || 0,
            dateReceived: inv.date_received || inv.dateReceived || inv.created_at || '',
            unitCost: inv.unit_cost || inv.unit_price || inv.unitCost || 0,
            quantityDispensed: inv.quantity_dispensed || inv.quantityDispensed || 0,
            expirationDate: inv.expiration_date || inv.expiry_date || inv.expirationDate || '',
            remarks: inv.remarks || '',
          }));
          return {
            userId: item.userId,
            userName: item.userName || 'Unknown User',
            branchName: item.branchName || 'Unknown Branch',
            userRole: item.userRole || 'User',
            userEmail: item.userEmail || '',
            userPhone: item.userPhone || '',
            inventory: transformedInventory,
          };
        },
      ).sort((a, b) => {
        return a.branchName.localeCompare(b.branchName);
      });

      setBranches(branchData);
      generateBranchAlerts(branchData);
    } catch (error: any) {
      console.error("Error fetching branches:", error);
      const errorMessage = error?.message || "Failed to load branch data";
      toast.error(errorMessage, { duration: 8000 });
    } finally {
      setIsLoading(false);
      setLastRefreshTime(new Date());
    }
  };

  // Generate alerts from all branches
  const generateBranchAlerts = (branchData: BranchData[]) => {
    const alerts: BranchAlert[] = [];

    branchData.forEach((branch) => {
      branch.inventory.forEach((item) => {
        const stockOnHand = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
        const expiryDate = new Date(item.expirationDate);
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Expired items
        if (daysUntilExpiry < 0) {
          alerts.push({
            branchId: branch.userId,
            branchName: branch.branchName,
            userName: branch.userName,
            item,
            alertType: 'expired',
            severity: 'high',
            daysUntilExpiry,
            stockLevel: stockOnHand,
          });
        }
        // Critical expiry (≤30 days)
        else if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
          alerts.push({
            branchId: branch.userId,
            branchName: branch.branchName,
            userName: branch.userName,
            item,
            alertType: 'critical',
            severity: 'high',
            daysUntilExpiry,
            stockLevel: stockOnHand,
          });
        }
        // Near expiry (31-180 days)
        else if (daysUntilExpiry > 30 && daysUntilExpiry <= 180) {
          alerts.push({
            branchId: branch.userId,
            branchName: branch.branchName,
            userName: branch.userName,
            item,
            alertType: 'nearExpiry',
            severity: 'medium',
            daysUntilExpiry,
            stockLevel: stockOnHand,
          });
        }

        // Low stock
        if (stockOnHand > 0 && isLowStock(item)) {
          const stockStatus = getStockStatus(item);
          alerts.push({
            branchId: branch.userId,
            branchName: branch.branchName,
            userName: branch.userName,
            item,
            alertType: 'lowStock',
            severity: stockOnHand < stockStatus.reorderPoint * 0.5 ? 'high' : 'medium', // Critical if below 50% of reorder point
            stockLevel: stockOnHand,
          });
        }
      });
    });

    // Sort by severity and type
    alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const typeOrder = { expired: 0, critical: 1, lowStock: 2, nearExpiry: 3 };
      
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return typeOrder[a.alertType] - typeOrder[b.alertType];
    });

    setBranchAlerts(alerts);
  };

  // Supabase real-time subscription for staff view — inventory INSERT events
  useEffect(() => {
    if (userRole === 'Administrator' || userRole === 'Health Officer') return;

    const channel = supabase
      .channel('alerts-inventory-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventory' },
        (payload) => {
          console.log('📡 [AlertsView] New item received (real-time):', payload.new);
          setHasNewReceiving(true);
          setTimeout(() => setHasNewReceiving(false), 4000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole]);

  // Track inventory changes — update live receiving events list whenever inventory prop changes
  useEffect(() => {
    if (userRole === 'Administrator' || userRole === 'Health Officer') return;
    const nowTs = new Date();
    const recent = [...inventory]
      .filter(item => {
        if (!item.dateReceived) return false;
        const daysSince = Math.floor((nowTs.getTime() - new Date(item.dateReceived).getTime()) / (1000 * 60 * 60 * 24));
        return daysSince <= 30;
      })
      .sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime())
      .slice(0, 8);
    setLiveReceivingEvents(recent);
  }, [inventory, userRole]);

  useEffect(() => {
    if ((userRole === 'Administrator' || userRole === 'Health Officer') && currentToken) {
      console.log('🔔 [AlertsView] Initial load for Admin/HO - fetching branch data');
      fetchAllBranches();
      
      // Set up auto-refresh every 30 seconds for real-time monitoring
      console.log('⏰ [AlertsView] Setting up auto-refresh interval (30s)');
      const intervalId = setInterval(() => {
        console.log('🔄 [AlertsView] Auto-refresh triggered');
        setIsAutoRefreshing(true);
        fetchAllBranches().finally(() => setIsAutoRefreshing(false));
      }, 30000); // 30 seconds
      
      // Cleanup interval on unmount
      return () => {
        console.log('🛑 [AlertsView] Cleaning up auto-refresh interval');
        clearInterval(intervalId);
      };
    }
  }, [currentToken, userRole]);

  // For Admin and Health Officer - Multi-Branch Alerts
  if (userRole === 'Administrator' || userRole === 'Health Officer') {
    const expiredAlerts = branchAlerts.filter(a => a.alertType === 'expired');
    const criticalAlerts = branchAlerts.filter(a => a.alertType === 'critical');
    const nearExpiryAlerts = branchAlerts.filter(a => a.alertType === 'nearExpiry');
    const lowStockAlerts = branchAlerts.filter(a => a.alertType === 'lowStock');

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

    if (isLoading) {
      return (
        <div className="p-8 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#9867C5]/20 border-t-[#9867C5] rounded-full animate-spin" />
        </div>
      );
    }

    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Multi-Branch Alerts & Notifications</h2>
            <p className="text-gray-600">Real-time monitoring across all branch locations</p>
            {lastRefreshTime && (
              <p className="text-xs text-gray-500 mt-1">
                {isAutoRefreshing ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Refreshing...
                  </span>
                ) : (
                  <span>
                    Last updated: {lastRefreshTime.toLocaleTimeString()} • Auto-refresh: ON (every 30s)
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={fetchAllBranches}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-bounce' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <Card className="border-l-4 border-red-500 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expired Items</p>
                  <p className="text-2xl font-bold text-red-600">{expiredAlerts.length}</p>
                  <p className="text-xs text-gray-500">{new Set(expiredAlerts.map(a => a.branchId)).size} branches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-orange-500 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Critical (≤30 days)</p>
                  <p className="text-2xl font-bold text-orange-600">{criticalAlerts.length}</p>
                  <p className="text-xs text-gray-500">{new Set(criticalAlerts.map(a => a.branchId)).size} branches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-yellow-500 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Near Expiry (≤180 days)</p>
                  <p className="text-2xl font-bold text-yellow-600">{nearExpiryAlerts.length}</p>
                  <p className="text-xs text-gray-500">{new Set(nearExpiryAlerts.map(a => a.branchId)).size} branches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-blue-500 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-2xl font-bold text-blue-600">{lowStockAlerts.length}</p>
                  <p className="text-xs text-gray-500">{new Set(lowStockAlerts.map(a => a.branchId)).size} branches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Statistics - Grid Layout */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Building className="w-5 h-5 text-[#9867C5]" />
              Branch Alert Overview
              <span className="ml-auto text-sm font-normal text-gray-500 bg-white/60 px-2.5 py-0.5 rounded-full border border-[#9867C5]/20">
                {branches.length} branch account{branches.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {branches.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Building className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No branch data available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {branches.map((branch) => {
                  const branchExpired = branchAlerts.filter(a => a.branchId === branch.userId && a.alertType === 'expired').length;
                  const branchCritical = branchAlerts.filter(a => a.branchId === branch.userId && a.alertType === 'critical').length;
                  const branchNearExpiry = branchAlerts.filter(a => a.branchId === branch.userId && a.alertType === 'nearExpiry').length;
                  const branchLowStock = branchAlerts.filter(a => a.branchId === branch.userId && a.alertType === 'lowStock').length;
                  const totalAlerts = branchExpired + branchCritical + branchNearExpiry + branchLowStock;

                  const isHighAlert = branchExpired > 0 || branchCritical > 0;
                  const isMediumAlert = !isHighAlert && (branchLowStock > 0 || branchNearExpiry > 0);
                  const isAllClear = totalAlerts === 0;

                  const borderColor = isHighAlert
                    ? 'border-red-400'
                    : isMediumAlert
                    ? 'border-amber-400'
                    : 'border-emerald-400';

                  const headerBg = isHighAlert
                    ? 'bg-red-50'
                    : isMediumAlert
                    ? 'bg-amber-50'
                    : 'bg-emerald-50';

                  const badgeBg = isHighAlert
                    ? 'bg-red-600'
                    : isMediumAlert
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                  return (
                    <div
                      key={branch.userId}
                      className={`relative rounded-xl border-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${borderColor}`}
                    >
                      {/* Alert count badge */}
                      <span className={`absolute top-3 right-3 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow z-10 ${badgeBg}`}>
                        {isAllClear ? '✓' : totalAlerts}
                      </span>

                      {/* Card Header — Branch Name */}
                      <div className={`px-4 pt-4 pb-3 ${headerBg} border-b ${borderColor}`}>
                        <div className="flex items-start gap-2 pr-8">
                          <Building className="w-4 h-4 text-[#9867C5] mt-0.5 shrink-0" />
                          <p className="text-sm font-bold text-gray-800 leading-tight">{branch.branchName}</p>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="px-4 py-3 bg-white space-y-2.5">
                        {/* Contact info */}
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Branch Contact</p>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <p className="text-xs font-semibold text-gray-700 truncate">{branch.userName}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <p className="text-xs text-gray-500 truncate">{branch.userPhone || 'No contact on file'}</p>
                          </div>
                          {branch.userEmail && (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                              <p className="text-[11px] text-gray-400 truncate">{branch.userEmail}</p>
                            </div>
                          )}
                        </div>

                        {/* Inventory count */}
                        <div className="flex items-center gap-1.5 pb-1">
                          <Package className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                          <p className="text-[11px] text-gray-400">{branch.inventory.length} item{branch.inventory.length !== 1 ? 's' : ''} in inventory</p>
                        </div>

                        {/* Alert pills */}
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100">
                          {branchExpired > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                              <XCircle className="w-2.5 h-2.5" />{branchExpired} Expired
                            </span>
                          )}
                          {branchCritical > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold">
                              <AlertTriangle className="w-2.5 h-2.5" />{branchCritical} Critical
                            </span>
                          )}
                          {branchNearExpiry > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold">
                              <Calendar className="w-2.5 h-2.5" />{branchNearExpiry} Near Exp.
                            </span>
                          )}
                          {branchLowStock > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
                              <TrendingDown className="w-2.5 h-2.5" />{branchLowStock} Low Stock
                            </span>
                          )}
                          {isAllClear && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                              ✓ All Clear
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Registered Branches */}
        {allBranches.length > 0 && (
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-teal-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Building className="w-5 h-5 text-green-600" />
                All Registered Branches ({allBranches.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allBranches.map((branch) => {
                  // Check if this branch has users with inventory
                  const hasInventory = branches.some(b => b.branchName === branch.name);
                  const branchUsers = branches.filter(b => b.branchName === branch.name);
                  const totalInventoryItems = branchUsers.reduce((sum, b) => sum + b.inventory.length, 0);
                  
                  return (
                    <div 
                      key={branch.id} 
                      className={`p-4 rounded-lg border-2 ${
                        hasInventory 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{branch.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-1">ID: {branch.id}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          hasInventory 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-400 text-white'
                        }`}>
                          {hasInventory ? '✓ Active' : 'No Data'}
                        </span>
                      </div>
                      {hasInventory && (
                        <div className="text-xs text-gray-600 mt-2">
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            <span>{branchUsers.length} user account{branchUsers.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Pill className="w-3 h-3" />
                            <span>{totalInventoryItems} inventory item{totalInventoryItems !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      )}
                      {!hasInventory && (
                        <p className="text-xs text-gray-500 mt-2">
                          No users or inventory assigned yet
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expired Items Across Branches - Grouped by Location */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-red-50 to-orange-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <XCircle className="w-5 h-5 text-red-600" />
                Expired Items Across Branches
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {expiredAlerts.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No expired items</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {uniqueLocations.map(([locationName, locationBranches]) => {
                    const locationExpiredAlerts = expiredAlerts.filter(alert => 
                      locationBranches.some(branch => branch.userId === alert.branchId)
                    );
                    
                    if (locationExpiredAlerts.length === 0) return null;
                    
                    return (
                      <div key={locationName} className="space-y-2">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 sticky top-0 bg-white py-1">
                          <Building className="w-4 h-4 text-red-600" />
                          {locationName}
                          <span className="text-xs font-normal text-gray-600">
                            ({locationExpiredAlerts.length} item{locationExpiredAlerts.length !== 1 ? 's' : ''})
                          </span>
                        </h4>
                        {locationExpiredAlerts.map((alert, idx) => (
                          <div key={`${alert.branchId}-${alert.item.id}-${idx}`} className="p-3 bg-red-50 border border-red-200 rounded-lg ml-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs text-gray-600 font-medium">{alert.userName}</p>
                                </div>
                                <p className="font-semibold text-gray-800">{alert.item.drugName}</p>
                                <p className="text-sm text-gray-600">{alert.item.dosage}</p>
                                <p className="text-xs text-gray-500 mt-1">{alert.item.batchNumber} • {alert.item.unit}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-red-600">
                                  Expired
                                </p>
                                <p className="text-xs text-gray-600">
                                  {new Date(alert.item.expirationDate).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Stock: {alert.stockLevel}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Critical Expiry Across Branches - Grouped by Location */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-yellow-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Critical Expiry Alert (≤30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {criticalAlerts.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No critical expiry items</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {uniqueLocations.map(([locationName, locationBranches]) => {
                    const locationCriticalAlerts = criticalAlerts.filter(alert => 
                      locationBranches.some(branch => branch.userId === alert.branchId)
                    );
                    
                    if (locationCriticalAlerts.length === 0) return null;
                    
                    return (
                      <div key={locationName} className="space-y-2">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 sticky top-0 bg-white py-1">
                          <Building className="w-4 h-4 text-orange-600" />
                          {locationName}
                          <span className="text-xs font-normal text-gray-600">
                            ({locationCriticalAlerts.length} item{locationCriticalAlerts.length !== 1 ? 's' : ''})
                          </span>
                        </h4>
                        {locationCriticalAlerts.map((alert, idx) => (
                          <div key={`${alert.branchId}-${alert.item.id}-${idx}`} className="p-3 bg-orange-50 border border-orange-200 rounded-lg ml-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs text-gray-600 font-medium">{alert.userName}</p>
                                </div>
                                <p className="font-semibold text-gray-800">{alert.item.drugName}</p>
                                <p className="text-sm text-gray-600">{alert.item.dosage}</p>
                                <p className="text-xs text-gray-500 mt-1">{alert.item.batchNumber} • {alert.item.unit}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-orange-600">
                                  {alert.daysUntilExpiry} days left
                                </p>
                                <p className="text-xs text-gray-600">
                                  {new Date(alert.item.expirationDate).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Stock: {alert.stockLevel}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Near Expiry Across Branches - Grouped by Location */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-yellow-50 to-amber-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Calendar className="w-5 h-5 text-yellow-600" />
                Near Expiry (31-180 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {nearExpiryAlerts.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No near expiry items</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {uniqueLocations.map(([locationName, locationBranches]) => {
                    const locationNearExpiryAlerts = nearExpiryAlerts.filter(alert => 
                      locationBranches.some(branch => branch.userId === alert.branchId)
                    );
                    
                    if (locationNearExpiryAlerts.length === 0) return null;
                    
                    return (
                      <div key={locationName} className="space-y-2">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 sticky top-0 bg-white py-1">
                          <Building className="w-4 h-4 text-yellow-600" />
                          {locationName}
                          <span className="text-xs font-normal text-gray-600">
                            ({locationNearExpiryAlerts.length} item{locationNearExpiryAlerts.length !== 1 ? 's' : ''})
                          </span>
                        </h4>
                        {locationNearExpiryAlerts.map((alert, idx) => (
                          <div key={`${alert.branchId}-${alert.item.id}-${idx}`} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg ml-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs text-gray-600 font-medium">{alert.userName}</p>
                                </div>
                                <p className="font-semibold text-gray-800">{alert.item.drugName}</p>
                                <p className="text-sm text-gray-600">{alert.item.dosage}</p>
                                <p className="text-xs text-gray-500 mt-1">{alert.item.batchNumber} • {alert.item.unit}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-yellow-600">
                                  {alert.daysUntilExpiry} days left
                                </p>
                                <p className="text-xs text-gray-600">
                                  {new Date(alert.item.expirationDate).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Stock: {alert.stockLevel}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Across Branches - Grouped by Location */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <TrendingDown className="w-5 h-5 text-blue-600" />
                Low Stock Warnings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {lowStockAlerts.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No low stock items</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {uniqueLocations.map(([locationName, locationBranches]) => {
                    const locationLowStockAlerts = lowStockAlerts.filter(alert => 
                      locationBranches.some(branch => branch.userId === alert.branchId)
                    );
                    
                    if (locationLowStockAlerts.length === 0) return null;
                    
                    return (
                      <div key={locationName} className="space-y-2">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 sticky top-0 bg-white py-1">
                          <Building className="w-4 h-4 text-blue-600" />
                          {locationName}
                          <span className="text-xs font-normal text-gray-600">
                            ({locationLowStockAlerts.length} item{locationLowStockAlerts.length !== 1 ? 's' : ''})
                          </span>
                        </h4>
                        {locationLowStockAlerts.map((alert, idx) => (
                          <div key={`${alert.branchId}-${alert.item.id}-${idx}`} className="p-3 bg-blue-50 border border-blue-200 rounded-lg ml-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs text-gray-600 font-medium">{alert.userName}</p>
                                </div>
                                <p className="font-semibold text-gray-800">{alert.item.drugName}</p>
                                <p className="text-sm text-gray-600">{alert.item.dosage}</p>
                                <p className="text-xs text-gray-500 mt-1">{alert.item.batchNumber} • {alert.item.unit}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-blue-600">{alert.stockLevel}</p>
                                <p className="text-xs text-gray-600">units remaining</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // For Regular Staff - Local Inventory Alerts
  // Calculate alerts for local inventory
  const currentInventory = inventory;

  const getDaysUntilExpiry = (expirationDate: string) => {
    return Math.floor((new Date(expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStockOnHand = (batch: InventoryBatch) => {
    return batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
  };

  // Categorize items
  const expiredItems = currentInventory.filter(item => {
    const daysUntil = getDaysUntilExpiry(item.expirationDate);
    return daysUntil < 0;
  });

  // Get discrepancies from inventory check - items with variance
  // Variance = (Beginning Inventory + Quantity Received - Quantity Dispensed) vs actual physical count
  // Since we don't have physical count data here, we check for items with remarks indicating manual adjustments
  // In real scenario, this would compare system stock vs physical count from inventory check
  const discrepancies = currentInventory.filter(item => {
    const stock = getStockOnHand(item);
    // Items with remarks might indicate manual adjustments or physical count variances
    return item.remarks && item.remarks.trim() !== '';
  });

  const nearExpiry60 = currentInventory.filter(item => {
    const days = getDaysUntilExpiry(item.expirationDate);
    return days > 30 && days <= 90;
  });

  const nearExpiry90 = currentInventory.filter(item => {
    const days = getDaysUntilExpiry(item.expirationDate);
    return days > 90 && days <= 180;
  });

  const lowStock = currentInventory.filter(item => {
    return isLowStock(item);
  });

  // Sort alerts by priority: Expired > Discrepancies > Near-Expiry > Low Stock
  const sortedExpired = [...expiredItems].sort((a, b) => getDaysUntilExpiry(a.expirationDate) - getDaysUntilExpiry(b.expirationDate));
  const sortedDiscrepancies = [...discrepancies];
  const sortedNear90 = [...nearExpiry60, ...nearExpiry90].sort((a, b) => getDaysUntilExpiry(a.expirationDate) - getDaysUntilExpiry(b.expirationDate));
  const sortedLowStock = [...lowStock].sort((a, b) => {
    const stockA = getStockOnHand(a);
    const stockB = getStockOnHand(b);
    return stockA - stockB;
  });

  // Excel Export for Summary Report
  const exportSummaryReport = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Summary Sheet
      const summaryData = [
        ['Alerts & Notifications Summary Report'],
        ['Generated on:', new Date().toLocaleString()],
        [],
        ['Alert Type', 'Count'],
        ['Expired Items', sortedExpired.length],
        ['Discrepancies', sortedDiscrepancies.length],
        ['Near Expiry (≤180 days)', sortedNear90.length],
        ['Low Stock', sortedLowStock.length],
        [],
        ['Total Alerts', sortedExpired.length + sortedDiscrepancies.length + sortedNear90.length + sortedLowStock.length]
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Expired Items Sheet
      const expiredData = [
        ['Expired Items'],
        ['Drug Name', 'Dosage', 'Batch Number', 'Unit', 'Stock on Hand', 'Expiry Date', 'Days Overdue'],
        ...sortedExpired.map(item => [
          item.drugName,
          item.dosage,
          item.batchNumber,
          item.unit,
          getStockOnHand(item),
          item.expirationDate,
          Math.abs(getDaysUntilExpiry(item.expirationDate))
        ])
      ];
      const expiredSheet = XLSX.utils.aoa_to_sheet(expiredData);
      XLSX.utils.book_append_sheet(workbook, expiredSheet, 'Expired');
      
      // Discrepancies Sheet
      const discrepanciesData = [
        ['Inventory Discrepancies'],
        ['Drug Name', 'Dosage', 'Batch Number', 'Stock on Hand', 'Remarks'],
        ...sortedDiscrepancies.map(item => [
          item.drugName,
          item.dosage,
          item.batchNumber,
          getStockOnHand(item),
          item.remarks || '-'
        ])
      ];
      const discrepanciesSheet = XLSX.utils.aoa_to_sheet(discrepanciesData);
      XLSX.utils.book_append_sheet(workbook, discrepanciesSheet, 'Discrepancies');
      
      // Near Expiry Sheet
      const nearExpiryData = [
        ['Near Expiry Items (≤180 days)'],
        ['Drug Name', 'Dosage', 'Batch Number', 'Unit', 'Stock on Hand', 'Expiry Date', 'Days Until Expiry'],
        ...sortedNear90.map(item => [
          item.drugName,
          item.dosage,
          item.batchNumber,
          item.unit,
          getStockOnHand(item),
          item.expirationDate,
          getDaysUntilExpiry(item.expirationDate)
        ])
      ];
      const nearExpirySheet = XLSX.utils.aoa_to_sheet(nearExpiryData);
      XLSX.utils.book_append_sheet(workbook, nearExpirySheet, 'Near Expiry');
      
      // Low Stock Sheet
      const lowStockData = [
        ['Low Stock Items'],
        ['Drug Name', 'Dosage', 'Batch Number', 'Unit', 'Stock on Hand', 'Program'],
        ...sortedLowStock.map(item => [
          item.drugName,
          item.dosage,
          item.batchNumber,
          item.unit,
          getStockOnHand(item),
          item.program
        ])
      ];
      const lowStockSheet = XLSX.utils.aoa_to_sheet(lowStockData);
      XLSX.utils.book_append_sheet(workbook, lowStockSheet, 'Low Stock');
      
      // Export file
      XLSX.writeFile(workbook, `Alerts_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Report Exported', { description: 'Summary report has been downloaded as Excel file.' });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export Failed', { description: 'Could not generate summary report.' });
    }
  };

  // Recent receiving — driven by live state updated from inventory prop changes
  const recentReceiving = liveReceivingEvents;

  const recentDispensing = inventory
    .filter(item => item.quantityDispensed > 0)
    .sort((a, b) => (b.quantityDispensed || 0) - (a.quantityDispensed || 0))
    .slice(0, 5);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Alerts & Notifications</h2>
          <p className="text-gray-600">
            Real-time monitoring of expiry dates, stock levels, and activity
            {branchName ? ` — ${branchName}` : ''}
          </p>
        </div>
        <button
          onClick={exportSummaryReport}
          className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Summary Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-red-500 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Expired</p>
                <p className="text-2xl font-bold text-red-600">{sortedExpired.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Discrepancies</p>
                <p className="text-2xl font-bold text-orange-600">{sortedDiscrepancies.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-yellow-500 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Near Expiry (≤180 days)</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {sortedNear90.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-blue-500 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Low Stock</p>
                <p className="text-2xl font-bold text-blue-600">{sortedLowStock.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expired Medicines */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-red-50 to-orange-50">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <XCircle className="w-5 h-5 text-red-600" />
              Expired Medicines
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {sortedExpired.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No expired items</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedExpired.map(item => (
                  <div key={item.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{item.drugName}</p>
                        <p className="text-sm text-gray-600">{item.dosage} • {item.unit}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.batchNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-600">
                          Expired: {new Date(item.expirationDate).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600">
                          Stock: {getStockOnHand(item)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discrepancies from Inventory Check */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-yellow-50">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Inventory Discrepancies
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {sortedDiscrepancies.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No discrepancies found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedDiscrepancies.map(item => (
                  <div key={item.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{item.drugName}</p>
                        <p className="text-sm text-gray-600">{item.dosage}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.batchNumber} • {item.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-orange-600">
                          Stock: {getStockOnHand(item)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {item.remarks}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Near Expiry (31-90 days) */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-yellow-50 to-amber-50">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Calendar className="w-5 h-5 text-yellow-600" />
              Near Expiry (31-180 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {sortedNear90.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No near expiry items</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedNear90.map(item => {
                  const days = getDaysUntilExpiry(item.expirationDate);
                  return (
                    <div key={item.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">{item.drugName}</p>
                          <p className="text-sm text-gray-600">{item.dosage}</p>
                          <p className="text-xs text-gray-500 mt-1">Batch: {item.batchNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-yellow-600">
                            {days} days left
                          </p>
                          <p className="text-xs text-gray-600">
                            Exp: {new Date(item.expirationDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Warnings */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              Low Stock Warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {sortedLowStock.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No low stock items</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedLowStock.map(item => {
                  const stock = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
                  return (
                    <div key={item.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">{item.drugName}</p>
                          <p className="text-sm text-gray-600">{item.dosage}</p>
                          <p className="text-xs text-gray-500 mt-1">Batch: {item.batchNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">{stock}</p>
                          <p className="text-xs text-gray-600">units remaining</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Receiving — LIVE */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="flex items-center justify-between text-gray-800">
              <span className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-[#9867C5]" />
                Recent Receiving (Last 30 Days)
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-300 ${
                hasNewReceiving
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasNewReceiving ? 'bg-white animate-ping' : 'bg-green-500 animate-pulse'}`} />
                LIVE
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {recentReceiving.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <PackagePlus className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No receiving activity in the last 30 days</p>
                <p className="text-xs mt-1">New items appear here instantly when received</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {recentReceiving.map((item, idx) => {
                  const daysSince = Math.floor((now.getTime() - new Date(item.dateReceived).getTime()) / (1000 * 60 * 60 * 24));
                  const isToday = daysSince === 0;
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className={`flex justify-between items-center p-3 rounded-lg border transition-all ${
                        isToday
                          ? 'bg-[#9867C5]/10 border-[#9867C5]/30 shadow-sm'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isToday ? 'bg-[#9867C5] animate-pulse' : 'bg-gray-300'}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{item.drugName}</p>
                          {item.dosage && <p className="text-xs text-gray-500">{item.dosage}</p>}
                          {item.batchNumber && <p className="text-xs text-gray-400">Batch: {item.batchNumber}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className={`text-sm font-bold ${item.quantityReceived > 0 ? 'text-[#9867C5]' : 'text-gray-400'}`}>
                          {item.quantityReceived > 0 ? `+${item.quantityReceived.toLocaleString()}` : '—'}
                        </p>
                        <p className="text-xs text-gray-400">{isToday ? 'Today' : `${daysSince}d ago`}</p>
                        {isToday && (
                          <span className="text-[10px] bg-[#9867C5] text-white px-1.5 py-0.5 rounded-full">NEW</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Pill className="w-5 h-5 text-purple-600" />
              Recent Dispensing Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {recentDispensing.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No recent dispensing activity</p>
            ) : (
              <div className="space-y-3">
                {recentDispensing.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-800">{item.drugName}</p>
                      <p className="text-xs text-gray-600">{item.dosage}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-purple-600">-{item.quantityDispensed}</p>
                      <p className="text-xs text-gray-500">Batch: {item.batchNumber}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}