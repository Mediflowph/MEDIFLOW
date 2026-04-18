import {
  TrendingUp,
  Package,
  Activity,
  Award,
  Building,
  BarChart3,
  Pill,
  AlertTriangle,
  XCircle,
  Calendar,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { InventoryBatch } from '@/app/types/inventory';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { isLowStock } from '@/app/utils/reorderPoint';
import { queuedFetch } from '@/app/utils/fetchQueue';

interface HomeViewProps {
  inventory: InventoryBatch[];
  userToken?: string;
  userRole?: string;
  branchName?: string;
}

interface BranchDrugData {
  branchName: string;
  dispensed: number;
  received: number;
  stock: number;
  utilizationRate: number;
}

interface DrugUtilization {
  drugName: string;
  totalDispensed: number;
  totalReceived: number;
  totalStock: number;
  utilizationRate: number;
  branchCount: number;
  branches: BranchDrugData[];
}

export function HomeView({ inventory, userToken, userRole, branchName }: HomeViewProps) {
  const [topUtilizedDrugs, setTopUtilizedDrugs] = useState<DrugUtilization[]>([]);
  const [isLoadingUtilization, setIsLoadingUtilization] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [adminInventory, setAdminInventory] = useState<InventoryBatch[]>([]);
  const [adminBranchCount, setAdminBranchCount] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // ── Admin/HO: fetch top utilized drugs ──────────────────────────────────────
  const fetchTopUtilizedDrugs = async () => {
    if (!userToken || (userRole !== 'Administrator' && userRole !== 'Health Officer')) return;
    try {
      setIsLoadingUtilization(true);
      // 3-second delay to let other components load first and avoid overwhelming the Edge Function
      await new Promise(r => setTimeout(r, 3000));
      const response = await queuedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/all-branches`,
        { headers: { 'X-User-Token': userToken, 'Authorization': `Bearer ${publicAnonKey}` }, timeoutMs: 90000 }
      );
      if (!response.ok) throw new Error('Failed to fetch branch data');
      const allInventories = await response.json();

      // Track stock at top level too
      const drugMap = new Map<string, { dispensed: number; received: number; stock: number; totalSupply: number; branches: Map<string, BranchDrugData> }>();
      const allInventoryItems: InventoryBatch[] = [];

      if (Array.isArray(allInventories)) {
        setAdminBranchCount(allInventories.length);
        for (const invData of allInventories) {
          const rawInventory = invData.inventory || invData.value || [];
          const branchInventory: InventoryBatch[] = rawInventory.map((item: any) => ({
            id: item.id,
            drugName: item.drug_name || item.drugName || 'Unknown Drug',
            program: item.program || 'General',
            category: item.category || 'Others',
            dosage: item.dosage || '',
            unit: item.unit || 'units',
            batchNumber: item.batch_number || item.batchNumber || '',
            // Fix: check beginning_inventory (snake_case from DB) first, then quantity, then camelCase fallback
            beginningInventory: item.beginning_inventory !== undefined ? item.beginning_inventory : (item.quantity !== undefined ? item.quantity : (item.beginningInventory || 0)),
            quantityReceived: item.quantity_received !== undefined ? item.quantity_received : (item.quantityReceived || 0),
            dateReceived: item.date_received || item.dateReceived || item.created_at || '',
            unitCost: item.unit_cost || item.unit_price || item.unitCost || 0,
            quantityDispensed: item.quantity_dispensed !== undefined ? item.quantity_dispensed : (item.quantityDispensed || 0),
            expirationDate: item.expiration_date || item.expiry_date || item.expirationDate || '',
            remarks: item.remarks || '',
          }));

          allInventoryItems.push(...branchInventory);
          const bName = invData.branchName || invData.userName || 'Unknown Branch';

          console.log(`📊 Processing ${branchInventory.length} items for branch: ${bName}`);

          branchInventory.forEach((item) => {
            // Log each item being processed
            if (item.quantityDispensed > 0 || item.quantityReceived > 0) {
              console.log(`  - ${item.drugName}: dispensed=${item.quantityDispensed}, received=${item.quantityReceived}, beginning=${item.beginningInventory}`);
            }

            const existing = drugMap.get(item.drugName) || { dispensed: 0, received: 0, stock: 0, totalSupply: 0, branches: new Map() };
            const branchData = existing.branches.get(bName) || { branchName: bName, dispensed: 0, received: 0, stock: 0, utilizationRate: 0 };

            const itemStock = Math.max(0, item.beginningInventory + item.quantityReceived - item.quantityDispensed);
            const itemSupply = item.beginningInventory + item.quantityReceived;

            // Accumulate values per branch
            branchData.dispensed += (item.quantityDispensed || 0);
            branchData.received += (item.quantityReceived || 0);
            branchData.stock += itemStock;

            // Calculate branch utilization rate
            const branchSupply = branchData.stock + branchData.dispensed;
            branchData.utilizationRate = branchSupply > 0
              ? Math.min((branchData.dispensed / branchSupply) * 100, 100)
              : 0;

            // Accumulate totals across all branches
            existing.dispensed += (item.quantityDispensed || 0);
            existing.received += (item.quantityReceived || 0);
            existing.stock += itemStock;
            existing.totalSupply += itemSupply;

            existing.branches.set(bName, branchData);
            drugMap.set(item.drugName, existing);
          });

          console.log(`✅ Processed branch ${bName}: ${branchInventory.length} items`);
        }
      }

      console.log(`📋 Total drugs tracked: ${drugMap.size}`);
      drugMap.forEach((data, drugName) => {
        if (data.dispensed > 0) {
          console.log(`  ${drugName}: total dispensed=${data.dispensed}, branches=${data.branches.size}`);
          data.branches.forEach((b, bName) => {
            console.log(`    - ${bName}: dispensed=${b.dispensed}, stock=${b.stock}`);
          });
        }
      });

      const drugUtilization: DrugUtilization[] = Array.from(drugMap.entries())
        .map(([drugName, data]) => ({
          drugName,
          totalDispensed: data.dispensed,
          totalReceived: data.received,
          totalStock: data.stock,
          utilizationRate: data.totalSupply > 0 ? Math.min((data.dispensed / data.totalSupply) * 100, 100) : 0,
          branchCount: data.branches.size,
          branches: Array.from(data.branches.values()).sort((a, b) => b.dispensed - a.dispensed || b.stock - a.stock),
        }))
        // ← Fix: also include drugs that have stock even if no transactions yet
        .filter(drug => drug.totalDispensed > 0 || drug.totalReceived > 0 || drug.totalStock > 0)
        .sort((a, b) => b.totalDispensed - a.totalDispensed || b.totalStock - a.totalStock)
        .slice(0, 10);

      setTopUtilizedDrugs(drugUtilization);
      setAdminInventory(allInventoryItems);
      setLastRefreshTime(new Date());
      console.log(`✅ Loaded ${drugUtilization.length} drugs with utilization data`);
    } catch (error: any) {
      console.error('❌ Error fetching utilization data:', error);
    } finally {
      setIsLoadingUtilization(false);
    }
  };

  useEffect(() => {
    if (userToken && (userRole === 'Administrator' || userRole === 'Health Officer')) {
      fetchTopUtilizedDrugs();
      const intervalId = setInterval(fetchTopUtilizedDrugs, 30000);
      return () => clearInterval(intervalId);
    }
  }, [userToken, userRole]);

  // ════════════════════════════════════════════════════════════════════════════
  // STAFF DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════
  if (userRole !== 'Administrator' && userRole !== 'Health Officer') {
    const now = new Date();

    // ── Period toggle ─────────────────────────────────────────────────────────
    const [viewPeriod, setViewPeriod] = useState<'monthly' | 'yearly'>('monthly');

    // Items whose dateReceived falls in the selected period
    const periodInventory = useMemo(() => {
      return inventory.filter(item => {
        if (!item.dateReceived) return false;
        const d = new Date(item.dateReceived);
        if (viewPeriod === 'monthly') {
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        return d.getFullYear() === now.getFullYear();
      });
    }, [inventory, viewPeriod, now.getFullYear(), now.getMonth()]);

    // ── Summary stats (always full inventory — current stock status) ─────────
    const totalMedicines = inventory.reduce((sum, item) => {
      return sum + Math.max(0, item.beginningInventory + item.quantityReceived - item.quantityDispensed);
    }, 0);
    const lowStock = inventory.filter(item => isLowStock(item)).length;
    const nearExpiry = inventory.filter(item => {
      const days = Math.floor((new Date(item.expirationDate).getTime() - now.getTime()) / 86400000);
      return days > 0 && days <= 180;
    }).length;
    const expired = inventory.filter(item => {
      return Math.floor((new Date(item.expirationDate).getTime() - now.getTime()) / 86400000) < 0;
    }).length;

    // ── Period-based utilization metrics ─────────────────────────────────────
    // Use full inventory for branch-wide utilization rates as requested to correctly account for all stock
    const utilSource = inventory;
    const totalDispensed = utilSource.reduce((s, i) => s + (i.quantityDispensed || 0), 0);
    const totalReceived  = utilSource.reduce((s, i) => s + (i.quantityReceived || 0), 0);
    const totalBeginning = utilSource.reduce((s, i) => s + (i.beginningInventory || 0), 0);
    const totalSupply    = totalBeginning + totalReceived;
    // Fix: Utilization = dispensed / total supply (not stock on hand)
    const stockUtilRate  = totalSupply > 0 ? Math.min(Math.round((totalDispensed / totalSupply) * 100), 100) : 0;

    // Antimicrobial: check from full inventory for accurate branch reporting
    const isAntimicrobial = (item: InventoryBatch) => {
      const cat = (item.category || '').toLowerCase();
      if (cat === 'antimicrobial') return true;
      // Also check program as heuristic
      const prog = (item.program || '').toLowerCase();
      return prog.includes('ereid') || prog.includes('antimicro') || prog.includes('tb');
    };
    const amPeriodItems = periodInventory.filter(isAntimicrobial);
    const antimicrobialItems = amPeriodItems.length > 0 ? amPeriodItems : inventory.filter(isAntimicrobial);
    const amDispensed = antimicrobialItems.reduce((s, i) => s + i.quantityDispensed, 0);
    const amReceived  = antimicrobialItems.reduce((s, i) => s + i.quantityReceived, 0);
    const amSupply    = antimicrobialItems.reduce((s, i) => s + i.beginningInventory + i.quantityReceived, 0);
    const amUtilRate  = amSupply > 0 ? Math.round((amDispensed / amSupply) * 100) : 0;

    // ── Top 10 drugs by dispensed quantity (period-filtered) ─────────────────
    const drugMap = new Map<string, { dispensed: number; received: number; stock: number }>();
    periodInventory.forEach(item => {
      const ex = drugMap.get(item.drugName) || { dispensed: 0, received: 0, stock: 0 };
      ex.dispensed += item.quantityDispensed;
      ex.received  += item.quantityReceived;
      ex.stock     += item.beginningInventory + item.quantityReceived - item.quantityDispensed;
      drugMap.set(item.drugName, ex);
    });

    // Fallback: if period has no data, use full inventory
    const sourceMap = drugMap.size > 0 ? drugMap : (() => {
      const m = new Map<string, { dispensed: number; received: number; stock: number }>();
      inventory.forEach(item => {
        const ex = m.get(item.drugName) || { dispensed: 0, received: 0, stock: 0 };
        ex.dispensed += item.quantityDispensed;
        ex.received  += item.quantityReceived;
        ex.stock     += item.beginningInventory + item.quantityReceived - item.quantityDispensed;
        m.set(item.drugName, ex);
      });
      return m;
    })();

    const topDrugs = Array.from(sourceMap.entries())
      .map(([drugName, data]) => ({
        drugName,
        dispensed: data.dispensed,
        received: data.received,
        stock: data.stock,
        utilizationRate: (data.stock + data.dispensed) > 0
          ? Math.min((data.dispensed / (data.stock + data.dispensed)) * 100, 100)
          : 0,
      }))
      .filter(d => d.dispensed > 0 || d.stock > 0)
      .sort((a, b) => b.dispensed - a.dispensed || b.stock - a.stock)
      .slice(0, 10);

    // ── Trend chart data ──────────────────────────────────────────────────────
    const trendData = useMemo(() => {
      if (viewPeriod === 'monthly') {
        // Last 6 months
        return Array.from({ length: 6 }, (_, i) => {
          const target = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const y = target.getFullYear(), m = target.getMonth();
          const label = target.toLocaleString('default', { month: 'short' });
          const items = inventory.filter(item => {
            const d = new Date(item.dateReceived || '');
            return d.getFullYear() === y && d.getMonth() === m;
          });
          return {
            label,
            dispensed: items.reduce((s, it) => s + it.quantityDispensed, 0),
            received:  items.reduce((s, it) => s + it.quantityReceived, 0),
          };
        });
      } else {
        // Last 12 months
        return Array.from({ length: 12 }, (_, i) => {
          const target = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
          const y = target.getFullYear(), m = target.getMonth();
          const label = target.toLocaleString('default', { month: 'short' });
          const items = inventory.filter(item => {
            const d = new Date(item.dateReceived || '');
            return d.getFullYear() === y && d.getMonth() === m;
          });
          return {
            label,
            dispensed: items.reduce((s, it) => s + it.quantityDispensed, 0),
            received:  items.reduce((s, it) => s + it.quantityReceived, 0),
          };
        });
      }
    }, [inventory, viewPeriod]);

    const maxTrendValue = Math.max(...trendData.map(d => Math.max(d.dispensed, d.received)), 1);
    const hasTrendData  = trendData.some(d => d.dispensed > 0 || d.received > 0);

    const periodLabel = viewPeriod === 'monthly'
      ? now.toLocaleString('default', { month: 'long', year: 'numeric' })
      : now.getFullYear().toString();

    const stats = [
      { title: 'Total Medicines in Stock', value: totalMedicines.toLocaleString(), subtitle: `${inventory.length} unique batches`, icon: Package, color: 'purple' },
      { title: 'Low Stock Drugs',           value: lowStock.toString(),             subtitle: 'Below reorder point',  icon: AlertTriangle, color: 'yellow' },
      { title: 'Near-Expiry Drugs',         value: nearExpiry.toString(),            subtitle: 'Within 180 days',      icon: Calendar,      color: 'orange' },
      { title: 'Expired Drugs',             value: expired.toString(),               subtitle: 'Requires disposal',    icon: XCircle,       color: 'red' },
    ];

    return (
      <div className="p-6 space-y-6">
        {/* Header + Period Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 break-words">Dashboard Overview</h2>
            <p className="text-gray-500 text-sm mt-0.5 break-words">
              {branchName ? `${branchName}` : 'Drug Inventory System'}
            </p>
          </div>
          {/* Period Toggle */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1 shadow-sm self-start sm:self-auto">
            <button
              onClick={() => setViewPeriod('monthly')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewPeriod === 'monthly'
                  ? 'bg-[#9867C5] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {viewPeriod === 'monthly' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Monthly
            </button>
            <button
              onClick={() => setViewPeriod('yearly')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewPeriod === 'yearly'
                  ? 'bg-[#9867C5] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {viewPeriod === 'yearly' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Yearly
            </button>
          </div>
        </div>

        {/* Period label pill */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#9867C5]/10 text-[#9867C5] rounded-full text-xs font-semibold">
            <Calendar className="w-3 h-3" />
            Showing: {periodLabel}
          </span>
          <span className="text-xs text-gray-400">
            (Stock status metrics always reflect current totals)
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="border-none shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-800 mb-1">{stat.value}</p>
                      <p className="text-xs text-gray-400">{stat.subtitle}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      stat.color === 'purple' ? 'bg-[#9867C5]/10 text-[#9867C5]' :
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

        {/* Utilization Metrics (period-aware) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Stock Utilization */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Activity className="w-5 h-5 text-[#9867C5]" />
                Stock Utilization
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Overall dispensed vs received — {periodLabel}</p>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Utilization Rate</span>
                    <span className="font-bold text-2xl text-[#9867C5]">{stockUtilRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className="bg-gradient-to-r from-[#9867C5] to-[#9867C5]/80 h-4 rounded-full transition-all"
                      style={{ width: `${stockUtilRate}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{totalReceived.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Received</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{totalDispensed.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Dispensed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Antimicrobial Utilization */}
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Antimicrobial Utilization
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Antimicrobials only — {periodLabel}</p>
            </CardHeader>
            <CardContent className="pt-5">
              {antimicrobialItems.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No antimicrobial data for this period</p>
                  <p className="text-xs mt-1">Tag drugs as "Antimicrobial" in Receive Medications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Utilization Rate</span>
                      <span className="font-bold text-2xl text-emerald-600">{amUtilRate}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-green-400 h-4 rounded-full transition-all"
                        style={{ width: `${amUtilRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-800">{amReceived.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Received</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-800">{amDispensed.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Dispensed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-emerald-600">{antimicrobialItems.length}</p>
                      <p className="text-xs text-gray-500">Batches</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                {viewPeriod === 'monthly' ? 'Monthly Dispensing Trends (Last 6 Months)' : 'Monthly Dispensing Trends (Last 12 Months)'}
              </CardTitle>
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {!hasTrendData ? (
              <div className="text-center py-8 text-gray-400">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No dispensing data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {trendData.map((data) => (
                  <div key={data.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-medium text-gray-700 w-10">{data.label}</span>
                      <span>
                        {data.received > 0 ? `${data.received.toLocaleString()} recv` : ''}
                        {data.received > 0 && data.dispensed > 0 ? ' · ' : ''}
                        {data.dispensed > 0 ? `${data.dispensed.toLocaleString()} disp` : ''}
                        {data.received === 0 && data.dispensed === 0 ? 'no activity' : ''}
                      </span>
                    </div>

                    {/* Received bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-400 to-indigo-500 h-3 rounded-full transition-all flex items-center justify-end pr-1.5"
                          style={{ width: `${Math.max((data.received / maxTrendValue) * 100, data.received > 0 ? 2 : 0)}%` }}
                        >
                          {data.received > 0 && <span className="text-[9px] text-white font-medium">{data.received}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Dispensed bar (separate row) */}
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-[#9867C5] h-3 rounded-full transition-all flex items-center justify-end pr-1.5"
                          style={{ width: `${Math.max((data.dispensed / maxTrendValue) * 100, data.dispensed > 0 ? 2 : 0)}%` }}
                        >
                          {data.dispensed > 0 && <span className="text-[9px] text-white font-medium">{data.dispensed}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 border-t text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 inline-block" />
                    Received
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-full bg-gradient-to-r from-purple-500 to-[#9867C5] inline-block" />
                    Dispensed
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 10 Most Utilized Drugs */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Award className="w-5 h-5 text-amber-600" />
                Top 10 Most Utilized Drugs
              </CardTitle>
              <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                {drugMap.size === 0 ? 'All time' : periodLabel}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Ranked by quantity dispensed in your branch</p>
          </CardHeader>
          <CardContent className="pt-5">
            {topDrugs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Pill className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No drug utilization data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topDrugs.map((drug, index) => {
                  const maxDispensed = topDrugs[0]?.dispensed || 1;
                  return (
                    <div key={drug.drugName} className="flex items-center gap-3 p-3 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 hover:shadow-sm transition-all">
                      {/* Rank Badge */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0 ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                        index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                        'bg-gradient-to-br from-[#9867C5] to-blue-600'
                      }`}>
                        #{index + 1}
                      </div>

                      {/* Drug Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 text-sm truncate">{drug.drugName}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span><strong className="text-gray-700">{drug.dispensed.toLocaleString()}</strong> dispensed</span>
                          <span><strong className="text-gray-700">{drug.utilizationRate.toFixed(0)}%</strong> util</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                          <div
                            className="bg-gradient-to-r from-amber-400 to-orange-500 h-1.5 rounded-full"
                            style={{ width: `${(drug.dispensed / maxDispensed) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Stock badge */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[#9867C5]">{drug.stock.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">in stock</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN / HEALTH OFFICER DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════

  // ── Derive admin summary stats from adminInventory ─────────────────────────
  const now = new Date();
  const totalAdminStock = adminInventory.reduce(
    (sum, item) => sum + Math.max(0, item.beginningInventory + item.quantityReceived - item.quantityDispensed), 0
  );
  const uniqueDrugsCount = new Set(adminInventory.map(i => i.drugName)).size;
  const adminLowStockCount = adminInventory.filter(item => isLowStock(item)).length;
  const adminExpiredCount = adminInventory.filter(item =>
    Math.floor((new Date(item.expirationDate).getTime() - now.getTime()) / 86400000) < 0
  ).length;
  const adminNearExpiryCount = adminInventory.filter(item => {
    const days = Math.floor((new Date(item.expirationDate).getTime() - now.getTime()) / 86400000);
    return days >= 0 && days <= 180;
  }).length;
  const totalAdminDispensed = adminInventory.reduce((sum, item) => sum + item.quantityDispensed, 0);
  const totalAdminReceived  = adminInventory.reduce((sum, item) => sum + item.quantityReceived, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#9867C5] to-blue-600 rounded-3xl shadow-lg mb-4">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#9867C5] to-blue-600 bg-clip-text text-transparent">
            Drug Utilization Analytics
          </h1>
          {lastRefreshTime && (
            <p className="text-sm text-gray-500">
              Last updated: {lastRefreshTime.toLocaleTimeString()} • Auto-refreshes every 30 seconds
            </p>
          )}
        </div>

        {/* Top 10 Drug List */}
        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/5 via-blue-50 to-purple-50 pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-2xl text-gray-800">
                <Award className="w-7 h-7 text-[#9867C5]" />
                Top 10 Most Utilized Drugs
              </CardTitle>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchTopUtilizedDrugs}
                  disabled={isLoadingUtilization}
                  className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 disabled:bg-gray-400 text-white rounded-full shadow-md transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingUtilization ? 'animate-spin' : ''}`} />
                  <span className="text-sm font-medium">Refresh</span>
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
                  <Building className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">{adminBranchCount} Branch{adminBranchCount !== 1 ? 'es' : ''}</span>
                </div>
              </div>
            </div>
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
                  <div key={drug.drugName} className="group">
                    <div
                      onClick={() => setSelectedDrug(selectedDrug === drug.drugName ? null : drug.drugName)}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedDrug === drug.drugName
                          ? 'bg-gradient-to-r from-[#9867C5]/10 to-blue-50 border-[#9867C5] shadow-lg'
                          : 'bg-gradient-to-r from-white to-gray-50 border-gray-200 hover:border-[#9867C5]/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0 ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg' :
                          'bg-gradient-to-br from-[#9867C5] to-blue-600'
                        }`}>
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-800 text-lg truncate">{drug.drugName}</h3>
                          <div className="flex items-center gap-6 mt-1 text-sm text-gray-600">
                            <span><strong className="text-gray-800">{drug.totalDispensed.toLocaleString()}</strong> dispensed</span>
                            <span><strong className="text-gray-800">{drug.totalReceived.toLocaleString()}</strong> received</span>
                            <span><strong className="text-gray-800">{drug.totalStock.toLocaleString()}</strong> in stock</span>
                            <span className="hidden md:inline"><strong className="text-gray-800">{drug.branchCount}</strong> branch{drug.branchCount !== 1 ? 'es' : ''}</span>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-[#9867C5] to-blue-500 h-2 rounded-full"
                              style={{ width: `${drug.utilizationRate}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-bold text-[#9867C5]">{drug.utilizationRate.toFixed(1)}%</p>
                          <p className="text-xs text-gray-500">utilization</p>
                        </div>
                      </div>
                    </div>

                    {/* Branch breakdown */}
                    {selectedDrug === drug.drugName && (
                      <div className="mt-2 ml-6 p-5 bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-[#9867C5]/20 shadow-md">
                        <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-200">
                          <Building className="w-4 h-4 text-[#9867C5]" />
                          Branch Breakdown ({drug.branches.length} branch{drug.branches.length !== 1 ? 'es' : ''})
                        </h4>
                        {drug.branches.length === 0 ? (
                          <div className="text-center py-6 text-gray-400">
                            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No branch data available for this drug</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {drug.branches.map(branch => (
                            <div key={branch.branchName} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-[#9867C5]/50 transition-all">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-800 font-semibold text-sm">{branch.branchName}</span>
                                <span className="text-lg font-bold text-[#9867C5]">{branch.utilizationRate.toFixed(1)}%</span>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div className="text-center p-2 bg-purple-50 rounded">
                                  <p className="text-purple-600 font-bold">{branch.dispensed.toLocaleString()}</p>
                                  <p className="text-gray-500">Dispensed</p>
                                </div>
                                <div className="text-center p-2 bg-blue-50 rounded">
                                  <p className="text-blue-600 font-bold">{branch.received.toLocaleString()}</p>
                                  <p className="text-gray-500">Received</p>
                                </div>
                                <div className="text-center p-2 bg-green-50 rounded">
                                  <p className="text-green-600 font-bold">{branch.stock.toLocaleString()}</p>
                                  <p className="text-gray-500">In Stock</p>
                                </div>
                              </div>
                              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-gradient-to-r from-[#9867C5] to-blue-500 h-1.5 rounded-full"
                                  style={{ width: `${branch.utilizationRate}%` }}
                                />
                              </div>
                            </div>
                          ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-xl font-medium">No utilization data available</p>
                <p className="text-sm mt-2">Data will appear once branches receive and dispense medications</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}