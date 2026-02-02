import { 
  TrendingUp, 
  Package,
  Activity,
  Award,
  Building,
  MapPin,
  Users,
  BarChart3,
  Pill,
  AlertTriangle,
  XCircle,
  Calendar
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { InventoryBatch } from '@/app/types/inventory';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { supabase } from '@/app/utils/supabase';
import { isLowStock } from '@/app/utils/reorderPoint';

interface HomeViewProps {
  inventory: InventoryBatch[];
  userToken?: string;
  userRole?: string;
}

interface BranchDrugData {
  branchName: string;
  dispensed: number;
  received: number;
  utilizationRate: number;
}

interface DrugUtilization {
  drugName: string;
  totalDispensed: number;
  totalReceived: number;
  utilizationRate: number;
  branchCount: number;
  branches: BranchDrugData[];
}

export function HomeView({ inventory, userToken, userRole }: HomeViewProps) {
  const [topUtilizedDrugs, setTopUtilizedDrugs] = useState<DrugUtilization[]>([]);
  const [isLoadingUtilization, setIsLoadingUtilization] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  // Fetch and calculate top utilized drugs across all branches
  const fetchTopUtilizedDrugs = async () => {
    if (!userToken || (userRole !== 'Administrator' && userRole !== 'Health Officer')) {
      return;
    }

    try {
      console.log('📊 [HomeView] Fetching drug utilization data for Admin/HO');
      setIsLoadingUtilization(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/all-branches`,
        {
          headers: {
            'X-User-Token': userToken,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch branch data');
      }

      const allInventories = await response.json();
      console.log('✅ [HomeView] Fetched data from', allInventories.length, 'branches');
      
      // Aggregate drug utilization across all branches with branch details
      const drugMap = new Map<string, { 
        dispensed: number; 
        received: number; 
        branches: Map<string, BranchDrugData> 
      }>();
      
      if (Array.isArray(allInventories)) {
        for (const invData of allInventories) {
          const inventory: InventoryBatch[] = invData.value || [];
          const branchName = invData.branchName || 'Unknown';
          
          inventory.forEach((item) => {
            const existing = drugMap.get(item.drugName) || { 
              dispensed: 0, 
              received: 0, 
              branches: new Map() 
            };
            
            const branchData = existing.branches.get(branchName) || {
              branchName,
              dispensed: 0,
              received: 0,
              utilizationRate: 0
            };
            
            branchData.dispensed += item.quantityDispensed;
            branchData.received += item.quantityReceived;
            branchData.utilizationRate = branchData.received > 0 
              ? (branchData.dispensed / branchData.received) * 100 
              : 0;
            
            existing.dispensed += item.quantityDispensed;
            existing.received += item.quantityReceived;
            existing.branches.set(branchName, branchData);
            
            drugMap.set(item.drugName, existing);
          });
        }
      }
      
      // Convert to array and calculate utilization rate
      const drugUtilization: DrugUtilization[] = Array.from(drugMap.entries())
        .map(([drugName, data]) => ({
          drugName,
          totalDispensed: data.dispensed,
          totalReceived: data.received,
          utilizationRate: data.received > 0 ? Math.min((data.dispensed / data.received) * 100, 100) : 0,
          branchCount: data.branches.size,
          branches: Array.from(data.branches.values()).sort((a, b) => b.dispensed - a.dispensed)
        }))
        .filter(drug => drug.totalDispensed > 0) // Only show drugs that have been dispensed
        .sort((a, b) => b.totalDispensed - a.totalDispensed) // Sort by total dispensed
        .slice(0, 10); // Top 10
      
      console.log('📈 [HomeView] Processed', drugUtilization.length, 'top utilized drugs');
      setTopUtilizedDrugs(drugUtilization);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('❌ [HomeView] Error fetching top utilized drugs:', error);
    } finally {
      setIsLoadingUtilization(false);
    }
  };

  useEffect(() => {
    if (userToken && (userRole === 'Administrator' || userRole === 'Health Officer')) {
      console.log('🏠 [HomeView] Initial load for Admin/HO - fetching utilization data');
      fetchTopUtilizedDrugs();
      
      // Set up auto-refresh every 30 seconds for real-time monitoring
      console.log('⏰ [HomeView] Setting up auto-refresh interval (30s)');
      const intervalId = setInterval(() => {
        console.log('🔄 [HomeView] Auto-refresh triggered');
        setIsAutoRefreshing(true);
        fetchTopUtilizedDrugs().finally(() => setIsAutoRefreshing(false));
      }, 30000); // 30 seconds
      
      // Cleanup interval on unmount
      return () => {
        console.log('🛑 [HomeView] Cleaning up auto-refresh interval');
        clearInterval(intervalId);
      };
    }
  }, [userToken, userRole]);

  // Staff Dashboard (Original)
  if (userRole !== 'Administrator' && userRole !== 'Health Officer') {
    // Calculate statistics
    const totalMedicines = inventory.reduce((sum, item) => {
      const stock = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
      return sum + stock;
    }, 0);

    // Low Stock: Using pharmacy reorder point calculation (matches Alerts & Notifications)
    const lowStock = inventory.filter(item => {
      return isLowStock(item);
    }).length;

    // Near Expiry: ALL items within 180 days (including 0 stock)
    const nearExpiry = inventory.filter(item => {
      const daysUntil = Math.floor((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 180;
    }).length;

    // Expired: ALL expired items (including 0 stock)
    const expired = inventory.filter(item => {
      const daysUntil = Math.floor((new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil < 0;
    }).length;

    const totalDispensed = inventory.reduce((sum, item) => sum + item.quantityDispensed, 0);
    const totalReceived = inventory.reduce((sum, item) => sum + item.quantityReceived, 0);
    const utilizationRate = totalReceived > 0 ? Math.round((totalDispensed / totalReceived) * 100) : 0;

    // Calculate top utilized drugs in this branch
    const drugUtilizationMap = new Map<string, { dispensed: number; received: number }>();
    inventory.forEach(item => {
      const existing = drugUtilizationMap.get(item.drugName) || { dispensed: 0, received: 0 };
      existing.dispensed += item.quantityDispensed;
      existing.received += item.quantityReceived;
      drugUtilizationMap.set(item.drugName, existing);
    });

    const topDrugs = Array.from(drugUtilizationMap.entries())
      .map(([drugName, data]) => ({
        drugName,
        dispensed: data.dispensed,
        received: data.received,
        utilizationRate: data.received > 0 ? Math.min((data.dispensed / data.received) * 100, 100) : 0
      }))
      .filter(drug => drug.dispensed > 0)
      .sort((a, b) => b.dispensed - a.dispensed)
      .slice(0, 5); // Top 5 drugs

    const stats = [
      {
        title: 'Total Medicines in Stock',
        value: totalMedicines.toLocaleString(),
        subtitle: `${inventory.length} unique batches`,
        icon: Package,
        color: 'teal',
      },
      {
        title: 'Low Stock Drugs',
        value: lowStock.toString(),
        subtitle: 'Below reorder point',
        icon: AlertTriangle,
        color: 'yellow',
      },
      {
        title: 'Near-Expiry Drugs',
        value: nearExpiry.toString(),
        subtitle: 'Within 180 days',
        icon: Calendar,
        color: 'orange',
      },
      {
        title: 'Expired Drugs',
        value: expired.toString(),
        subtitle: 'Requires disposal',
        icon: XCircle,
        color: 'red',
      },
    ];

    // Monthly dispensing trends (mock data for chart)
    const monthlyData = [
      { month: 'Jan', dispensed: 1200 },
      { month: 'Feb', dispensed: 1450 },
      { month: 'Mar', dispensed: 1350 },
      { month: 'Apr', dispensed: 1600 },
      { month: 'May', dispensed: 1580 },
      { month: 'Jun', dispensed: 1720 },
    ];

    return (
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard Overview</h2>
          <p className="text-gray-600">City Health Services Office - Drug Inventory System</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            
            return (
              <Card key={stat.title} className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-800 mb-2">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.subtitle}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      stat.color === 'teal' ? 'bg-[#9867C5]/10 text-[#9867C5]' :
                      stat.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                      stat.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stock Utilization */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Activity className="w-5 h-5 text-[#9867C5]" />
                Stock Utilization
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Overall Utilization Rate</span>
                    <span className="font-bold text-2xl text-[#9867C5]">{utilizationRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-[#9867C5] to-[#9867C5]/80 h-4 rounded-full transition-all"
                      style={{ width: `${utilizationRate}%` }}
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{totalReceived.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Total Received</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{totalDispensed.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Total Dispensed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Dispensing Trends */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Monthly Dispensing Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {monthlyData.map((data) => (
                  <div key={data.month} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 w-12">{data.month}</span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-6">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${(data.dispensed / 2000) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">{data.dispensed}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Utilized Drugs */}
        {topDrugs.length > 0 && (
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Award className="w-5 h-5 text-amber-600" />
                Top 5 Most Utilized Drugs
              </CardTitle>
              <p className="text-xs text-gray-600 mt-1">Ranked by total quantity dispensed in your branch</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {topDrugs.map((drug, index) => (
                  <div key={drug.drugName} className="p-4 bg-gradient-to-r from-white to-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      {/* Rank Badge */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                        index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                        'bg-gradient-to-br from-[#9867C5] to-blue-600'
                      }`}>
                        #{index + 1}
                      </div>
                      
                      {/* Drug Info */}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">{drug.drugName}</h4>
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span><strong>{drug.dispensed.toLocaleString()}</strong> dispensed</span>
                          <span><strong>{drug.utilizationRate.toFixed(1)}%</strong> utilization</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-32">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-orange-600 h-2 rounded-full"
                            style={{ width: `${Math.min(drug.utilizationRate, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Admin/Health Officer Dashboard (New Modern Design)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#9867C5] to-blue-600 rounded-3xl shadow-lg mb-4">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#9867C5] to-blue-600 bg-clip-text text-transparent">
            Drug Utilization Analytics
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real-time insights into the most utilized medicines across all branches
          </p>
        </div>

        {/* Stats Overview */}
        {topUtilizedDrugs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-xl bg-gradient-to-br from-white to-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Drugs Tracked</p>
                    <p className="text-3xl font-bold text-gray-800">{topUtilizedDrugs.length}</p>
                  </div>
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <Pill className="w-7 h-7 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-gradient-to-br from-white to-purple-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Units Dispensed</p>
                    <p className="text-3xl font-bold text-gray-800">
                      {topUtilizedDrugs.reduce((sum, d) => sum + d.totalDispensed, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                    <Package className="w-7 h-7 text-[#9867C5]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-gradient-to-br from-white to-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Average Utilization</p>
                    <p className="text-3xl font-bold text-gray-800">
                      {(topUtilizedDrugs.reduce((sum, d) => sum + d.utilizationRate, 0) / topUtilizedDrugs.length).toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                    <Activity className="w-7 h-7 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/5 via-blue-50 to-purple-50 pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-2xl text-gray-800">
                <Award className="w-7 h-7 text-[#9867C5]" />
                Top 10 Most Utilized Drugs
              </CardTitle>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
                <Building className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Multi-Branch</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Ranked by total quantity dispensed • Click on a drug to see branch breakdown
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingUtilization ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-[#9867C5]/20 border-t-[#9867C5] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-lg text-gray-600">Loading utilization data...</p>
              </div>
            ) : topUtilizedDrugs.length > 0 ? (
              <div className="space-y-4">
                {topUtilizedDrugs.map((drug, index) => (
                  <div 
                    key={drug.drugName} 
                    className="group"
                  >
                    {/* Drug Card */}
                    <div 
                      onClick={() => setSelectedDrug(selectedDrug === drug.drugName ? null : drug.drugName)}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedDrug === drug.drugName 
                          ? 'bg-gradient-to-r from-[#9867C5]/10 to-blue-50 border-[#9867C5] shadow-lg' 
                          : 'bg-gradient-to-r from-white to-gray-50 border-gray-200 hover:border-[#9867C5]/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        {/* Rank Badge */}
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 via-orange-500 to-red-500' :
                          'bg-gradient-to-br from-[#9867C5] via-purple-600 to-blue-600'
                        }`}>
                          #{index + 1}
                        </div>
                        
                        {/* Drug Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-800 text-xl mb-2 truncate">{drug.drugName}</h4>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full">
                              <Package className="w-4 h-4 text-blue-600" />
                              <strong className="text-gray-800">{drug.totalDispensed.toLocaleString()}</strong> dispensed
                            </span>
                            <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full">
                              <Building className="w-4 h-4 text-purple-600" />
                              <strong className="text-gray-800">{drug.branchCount}</strong> {drug.branchCount === 1 ? 'branch' : 'branches'}
                            </span>
                            <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full">
                              <Activity className="w-4 h-4 text-green-600" />
                              <strong className="text-gray-800">{drug.utilizationRate.toFixed(1)}%</strong> utilization
                            </span>
                          </div>
                        </div>

                        {/* Utilization Visualization */}
                        <div className="hidden lg:block w-48">
                          <div className="relative">
                            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-[#9867C5] via-blue-500 to-purple-600 h-4 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(drug.utilizationRate, 100)}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-center text-gray-600 mt-1 font-medium">
                              {drug.utilizationRate.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Branch Breakdown - Expandable */}
                    {selectedDrug === drug.drugName && (
                      <div className="mt-3 ml-20 mr-4 p-5 bg-white rounded-xl border border-gray-200 shadow-inner">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                          <MapPin className="w-5 h-5 text-[#9867C5]" />
                          <h5 className="font-semibold text-gray-800">Branch Breakdown</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {drug.branches.map((branch, branchIndex) => (
                            <div 
                              key={branch.branchName} 
                              className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-[#9867C5] rounded-full"></div>
                                  <span className="font-medium text-gray-800">{branch.branchName}</span>
                                </div>
                                <span className="text-xs font-semibold text-[#9867C5] bg-white px-2 py-1 rounded-full">
                                  {branch.utilizationRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="space-y-1.5 text-xs text-gray-600">
                                <div className="flex justify-between">
                                  <span>Dispensed:</span>
                                  <strong className="text-gray-800">{branch.dispensed.toLocaleString()}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Received:</span>
                                  <strong className="text-gray-800">{branch.received.toLocaleString()}</strong>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-[#9867C5] to-blue-600 h-2 rounded-full"
                                  style={{ width: `${Math.min(branch.utilizationRate, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Award className="w-24 h-24 mx-auto mb-4 text-gray-300" />
                <p className="text-xl font-semibold text-gray-700 mb-2">No utilization data available</p>
                <p className="text-gray-600">Data will appear when drugs are dispensed across branches</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}