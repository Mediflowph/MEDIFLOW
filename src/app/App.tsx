import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { supabase } from '@/app/utils/supabase';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { kvStore } from '@/app/utils/kvStore';
import { logTransaction } from '@/app/utils/transactionLog';
import { LoginPage } from '@/app/components/auth/LoginPage';
import { ResetPasswordPage } from '@/app/components/auth/ResetPasswordPage';
import { ExpiredLinkPage } from '@/app/components/auth/ExpiredLinkPage';
import { MaintenanceScreen } from '@/app/components/MaintenanceScreen';
import { Sidebar } from '@/app/components/Sidebar';
import { Header } from '@/app/components/Header';
import { HomeView } from '@/app/components/views/HomeView';
import { ReceiveMedicationsView } from '@/app/components/views/ReceiveMedicationsView';
import { DispenseMedicinesView } from '@/app/components/views/DispenseMedicinesView';
import { StockOnHandView } from '@/app/components/views/StockOnHandView';
import { StockLocatorView } from '@/app/components/views/StockLocatorView';
import { InventoryCheckView } from '@/app/components/views/InventoryCheckView';
import { ReportsView } from '@/app/components/views/ReportsView';
import { AlertsView } from '@/app/components/views/AlertsView';
import { AdminDashboardView } from '@/app/components/views/AdminDashboardView';
import { BranchInventoryManagementView } from '@/app/components/views/BranchInventoryManagementView';
import { ProfileView } from '@/app/components/views/ProfileView';


export interface InventoryBatch {
  id: string;
  drugName: string;
  program: string;
  dosage: string;
  unit: string;
  batchNumber: string;
  beginningInventory: number;
  quantityReceived: number;
  dateReceived: string;
  unitCost: number;
  quantityDispensed: number;
  expirationDate: string;
  remarks: string;
  category: string;
}

// Mock initial inventory data
const generateMockData = (): InventoryBatch[] => {
  return [
    {
      id: '1',
      drugName: 'Doxycycline',
      program: 'EREID Program',
      dosage: '100 mg',
      unit: 'capsule',
      batchNumber: 'DOX-2025-001',
      beginningInventory: 0,
      quantityReceived: 7000,
      dateReceived: '2025-09-19',
      unitCost: 1.37,
      quantityDispensed: 0,
      expirationDate: '2027-11-30',
      remarks: '',
      category: 'Antimicrobial'
    },
    {
      id: '2',
      drugName: 'Cetirizine Dihydrochloride',
      program: 'EREID Program',
      dosage: '1 mg/ml, 60 ml',
      unit: 'bottle',
      batchNumber: 'CET-2025-045',
      beginningInventory: 0,
      quantityReceived: 100,
      dateReceived: '2025-09-19',
      unitCost: 48.00,
      quantityDispensed: 100,
      expirationDate: '2028-05-31',
      remarks: '',
      category: 'Antimicrobial'
    },
    {
      id: '3',
      drugName: 'Bacillus Calmette-Guérin (BCG)',
      program: 'NIP-National Immunization Program',
      dosage: 'Vial',
      unit: 'vial',
      batchNumber: 'BCG-2025-089',
      beginningInventory: 375,
      quantityReceived: 0,
      dateReceived: '2025-01-15',
      unitCost: 212.93,
      quantityDispensed: 161,
      expirationDate: '2026-01-30',
      remarks: '',
      category: 'Non-antimicrobial'
    },
    {
      id: '4',
      drugName: 'Hepatitis B Vaccine',
      program: 'NIP-National Immunization Program',
      dosage: 'Vial',
      unit: 'vial',
      batchNumber: 'HEP-2025-234',
      beginningInventory: 7,
      quantityReceived: 90,
      dateReceived: '2028-09-18',
      unitCost: 141.15,
      quantityDispensed: 63,
      expirationDate: '2027-09-30',
      remarks: '',
      category: 'Non-antimicrobial'
    },
    {
      id: '5',
      drugName: 'Human Papilloma Vaccine (HPV)',
      program: 'NIP-National Immunization Program',
      dosage: 'Vial',
      unit: 'vial',
      batchNumber: 'HPV-2024-112',
      beginningInventory: 627,
      quantityReceived: 0,
      dateReceived: '2024-10-08',
      unitCost: 716.37,
      quantityDispensed: 296,
      expirationDate: '2026-11-19',
      remarks: '',
      category: 'Non-antimicrobial'
    },
    {
      id: '6',
      drugName: 'Inactivated Polio Vaccine (IPV)',
      program: 'NIP-National Immunization Program',
      dosage: 'Vial',
      unit: 'vial',
      batchNumber: 'IPV-2025-067',
      beginningInventory: 1075,
      quantityReceived: 0,
      dateReceived: '2025-01-15',
      unitCost: 1190.00,
      quantityDispensed: 91,
      expirationDate: '2026-10-31',
      remarks: '',
      category: 'Non-antimicrobial'
    },
    {
      id: '7',
      drugName: 'Measles and Rubella (MR) Vaccine',
      program: 'NIP-National Immunization Program',
      dosage: 'Vial',
      unit: 'vial',
      batchNumber: 'MRV-2024-012',
      beginningInventory: 666,
      quantityReceived: 0,
      dateReceived: '2024-10-08',
      unitCost: 472.44,
      quantityDispensed: 666,
      expirationDate: '2025-08-31',
      remarks: '',
      category: 'Non-antimicrobial'
    },
    {
      id: '8',
      drugName: 'Pentavalent Vaccine',
      program: 'NIP-National Immunization Program',
      dosage: '1 Dose/Vial',
      unit: 'vial',
      batchNumber: 'PEN-2025-189',
      beginningInventory: 10,
      quantityReceived: 0,
      dateReceived: '2025-03-20',
      unitCost: 67.55,
      quantityDispensed: 0,
      expirationDate: '2027-07-31',
      remarks: '',
      category: 'Non-antimicrobial'
    },
    {
      id: '9',
      drugName: 'Pneumococcal Conjugate Vaccine (PCV10)',
      program: 'NIP-National Immunization Program',
      dosage: '4 dose per vial',
      unit: 'vial',
      batchNumber: 'PCV-2025-223',
      beginningInventory: 1714,
      quantityReceived: 90,
      dateReceived: '2025-09-18',
      unitCost: 1225.60,
      quantityDispensed: 1118,
      expirationDate: '2026-12-31',
      remarks: '',
      category: 'Non-antimicrobial'
    },
    {
      id: '10',
      drugName: 'Tetanus-Diphtheria Vaccine',
      program: 'NIP-National Immunization Program',
      dosage: '10-dose per vial soln',
      unit: 'vial',
      batchNumber: 'TET-2025-334',
      beginningInventory: 1006,
      quantityReceived: 6,
      dateReceived: '2025-05-13',
      unitCost: 1200.00,
      quantityDispensed: 572,
      expirationDate: '2026-12-31',
      remarks: '',
      category: 'Non-antimicrobial'
    },
  ];
};

export default function App() {
  const [activeMenuItem, setActiveMenuItem] = useState('home');
  const [inventory, setInventory] = useState<InventoryBatch[]>([]);
  const [session, setSession] = useState<any>(null);
  const [currentBranch, setCurrentBranch] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastManualSync, setLastManualSync] = useState<number>(0);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(true);
  // Detect password-recovery flow immediately from the URL hash so we never
  // miss the Supabase PASSWORD_RECOVERY event (which fires during client init,
  // before the onAuthStateChange listener is registered in the useEffect).
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    try {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      return params.get('type') === 'recovery';
    } catch {
      return false;
    }
  });

  // Detect custom KV reset token from ?reset_token= query param (our own flow)
  const [resetToken, setResetToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('reset_token') || null;
    } catch {
      return null;
    }
  });

  // Detect OTP-expired / access_denied errors from Supabase redirect
  const [isLinkExpired, setIsLinkExpired] = useState(() => {
    try {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      return (
        params.get('error') === 'access_denied' &&
        params.get('error_code') === 'otp_expired'
      );
    } catch {
      return false;
    }
  });

  // Get fresh authentication token - Supabase handles refresh automatically
  // IMPORTANT: This function should NOT update local session state to avoid
  // race conditions during logout where it might restore a cleared session
  const getFreshToken = async (): Promise<string | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return null;
    }
    return session.access_token;
  };

  // Fetch inventory from Supabase
  const fetchInventory = async (branchId: string) => {
    try {
      console.log('📥 Fetching inventory for branch from SQL...', branchId);
      if (!branchId) {
        setIsDataLoaded(false);
        return;
      }

      // Admins and Health Officers have "all" as branch ID - don't fetch inventory for them
      if (branchId === 'all' || branchId === 'all-branches') {
        console.log('ℹ️ Admin/Health Officer account - no branch-specific inventory');
        setInventory([]);
        setIsDataLoaded(true);
        return;
      }

      const token = await getFreshToken();
      if (!token) {
        console.error('❌ No authentication token available');
        setInventory([]);
        setIsDataLoaded(true);
        return;
      }

      // Fetch from SQL database via backend API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/${branchId}`,
          {
            headers: {
              'X-User-Token': token,
              'Authorization': `Bearer ${publicAnonKey}`
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('❌ Failed to fetch inventory - HTTP error:', response.status);
          throw new Error('Failed to fetch inventory');
        }

        const data = await response.json();
        console.log('✅ Fetched inventory from SQL:', data);

        if (data && data.length > 0) {
          // Transform SQL data to match the app's inventory format
          const transformedInventory = data.map((item: any) => ({
            id: item.id,
            drugName: item.drug_name,
            program: item.program || 'General',
            dosage: item.dosage || '',
            unit: item.unit || 'units',
            batchNumber: item.batch_number || '',
            beginningInventory: item.beginning_inventory || item.quantity || 0,
            quantityReceived: item.quantity_received || 0,
            dateReceived: item.date_received || item.created_at || '',
            unitCost: item.unit_cost || item.unit_price || 0,
            quantityDispensed: item.quantity_dispensed || 0,
            expirationDate: item.expiration_date || item.expiry_date || '',
            remarks: item.remarks || '',
            category: item.category || (() => {
              const prog = (item.program || '').toLowerCase();
              if (prog.includes('ereid') || prog.includes('tb') || prog.includes('antimicro')) return 'Antimicrobial';
              if (prog.includes('nip') || prog.includes('immuniz')) return 'Non-antimicrobial';
              return 'Others';
            })(),
          }));
          setInventory(transformedInventory);
        } else {
          console.log('ℹ️ No inventory data found');
          setInventory([]);
        }
        setIsDataLoaded(true);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('❌ Inventory fetch timed out after 15 seconds');
        } else {
          console.error('❌ Fetch error:', fetchError);
        }
        setInventory([]);
        setIsDataLoaded(true);
      }
    } catch (error) {
      console.error('❌ Error fetching inventory:', error);
      setInventory([]);
      setIsDataLoaded(true);
    }
  };

  // Sync inventory to Supabase
  const syncInventoryToCloud = async (inventoryData: InventoryBatch[], branchId: string, isManualSync: boolean = false) => {
    if (!branchId) {
      console.log('⚠️ Sync skipped: no branch ID');
      return false;
    }

    setIsSyncing(true);
    if (isManualSync) {
      setLastManualSync(Date.now());
    }
    console.log(`🔄 ${isManualSync ? 'MANUAL' : 'AUTO'} sync to branch ${branchId} (${inventoryData.length} items)`);

    try {
      const token = await getFreshToken();
      if (!token) {
        console.error('❌ No authentication token available for sync');
        setIsSyncing(false);
        return false;
      }

      // Transform inventory to SQL format
      const transformedInventory = inventoryData.map(item => ({
        id: item.id, // Include ID for updates
        drug_name: item.drugName,
        generic_name: item.drugName, // Using drugName as generic for now
        dosage: item.dosage || null,
        quantity: (item.beginningInventory + item.quantityReceived - item.quantityDispensed) || 0,
        expiry_date: item.expirationDate,
        batch_number: item.batchNumber,
        supplier: 'N/A',
        unit_price: item.unitCost,
        program: item.program || 'General',
        unit: item.unit || 'units',
        category: item.category || 'Others',
        beginning_inventory: item.beginningInventory || 0,
        quantity_received: item.quantityReceived || 0,
        date_received: item.dateReceived,
        quantity_dispensed: item.quantityDispensed || 0,
        remarks: item.remarks || ''
      }));

      // Log items with dispensed quantities
      const dispensedItems = transformedInventory.filter(i => i.quantity_dispensed > 0);
      if (dispensedItems.length > 0) {
        console.log(`📦 Syncing ${dispensedItems.length} items with dispensed quantities:`);
        dispensedItems.forEach(item => {
          console.log(`   - ${item.drug_name}: dispensed=${item.quantity_dispensed}, received=${item.quantity_received}, stock=${item.quantity}`);
        });
      } else {
        console.log('📦 No dispensed items in this sync');
      }

      // Send to backend SQL API
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            inventory: transformedInventory,
            branchId: branchId
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Sync failed with status:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to sync inventory');
      }

      const result = await response.json();
      console.log('✅ Inventory synced to SQL database:', result);
      setLastSyncTime(new Date());
      setIsSyncing(false);
      return true;
    } catch (error: any) {
      console.error('❌ Sync error:', error.message || error);
      setIsSyncing(false);
      return false;
    }
  };

  // Auto-sync whenever inventory changes (with debouncing)
  useEffect(() => {
    // Don't sync for admin/health officer accounts with "all" branches
    if (currentBranch?.id === 'all' || currentBranch?.id === 'all-branches') {
      console.log('ℹ️ Skipping auto-sync for admin account');
      return;
    }

    // Don't sync if currently syncing or data hasn't been initially loaded
    if (isSyncing || !isDataLoaded || !currentBranch) {
      return;
    }

    // Allow sync even if inventory is empty (to clear server-side data)
    console.log(`📊 Inventory changed (${inventory.length} items), scheduling auto-sync...`);

    // Debounce sync operations to prevent continuous syncing
    const syncTimeout = setTimeout(async () => {
      // Skip auto-sync if manual sync happened recently (within last 2 seconds)
      const timeSinceManualSync = Date.now() - lastManualSync;
      if (timeSinceManualSync < 2000) {
        console.log('⏭️ Skipping auto-sync: manual sync happened recently');
        return;
      }

      // Get fresh session status at sync time (not from closure)
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession || !currentBranch) {
        console.log('⚠️ Sync cancelled: session or branch cleared during timeout');
        return;
      }

      console.log('🔄 Executing auto-sync...');
      const success = await syncInventoryToCloud(inventory, currentBranch.id, false);
      if (!success) {
        toast.error('Sync Failed', {
          description: 'Failed to save to cloud. Changes may be lost on refresh.'
        });
      }
    }, 1000); // Wait 1 second before syncing to batch rapid changes

    return () => {
      console.log('🧹 Cleanup: clearing pending sync timeout');
      clearTimeout(syncTimeout);
    };
  }, [inventory, currentBranch?.id]); // Only trigger on inventory or branch changes

  // Supabase real-time subscription — re-fetch inventory when the table changes
  useEffect(() => {
    if (!currentBranch?.id || currentBranch.id === 'all' || currentBranch.id === 'all-branches') return;

    console.log(`📡 Setting up real-time subscription for branch: ${currentBranch.id}`);

    const channel = supabase
      .channel(`inventory-realtime-${currentBranch.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        async () => {
          // Check for fresh session at event time (not from closure)
          const { data: { session: currentSession } } = await supabase.auth.getSession();

          if (currentSession && currentBranch) {
            console.log('📡 Real-time: inventory table changed, refreshing…');
            fetchInventory(currentBranch.id);
          } else {
            console.log('⚠️ Real-time event ignored: no active session');
          }
        },
      )
      .subscribe();

    return () => {
      console.log('🔌 Unsubscribing from real-time channel');
      supabase.removeChannel(channel);
    };
  }, [currentBranch?.id]); // Only depend on branch ID changes

  // Ensure data loaded flag is properly set when session changes
  useEffect(() => {
    if (!session) {
      setIsDataLoaded(false);
    }
  }, [session]);

  const handleAddStock = async (batch: Omit<InventoryBatch, 'id'>) => {
    const newBatch: InventoryBatch = {
      ...batch,
      id: Math.random().toString(36).substr(2, 9),
    };

    // Update local state
    const updatedInventory = [...inventory, newBatch];
    setInventory(updatedInventory);

    // Force immediate sync with updated inventory
    if (session && currentBranch) {
      console.log('🔄 Force syncing after receiving stock...');
      await syncInventoryToCloud(updatedInventory, currentBranch.id, true);
    }

    // Log transaction
    if (session && currentBranch && batch.quantityReceived > 0) {
      try {
        await logTransaction(
          'receive',
          {
            drugName: batch.drugName,
            dosage: batch.dosage,
            batchNumber: batch.batchNumber,
            quantity: batch.quantityReceived,
            unit: batch.unit,
          },
          {
            branchId: currentBranch.id,
            branchName: currentBranch.name,
            userName: session.user.user_metadata?.name || session.user.email || 'Unknown',
            userId: session.user.id,
          },
          session.access_token
        );
      } catch (error) {
        console.error('Failed to log receive transaction:', error);
      }
    }

    toast.success('Stock added successfully!', {
      description: `${batch.drugName} - Batch ${batch.batchNumber}`,
    });
  };

  const handleDispense = async (batchId: string, quantity: number) => {
    const batch = inventory.find(b => b.id === batchId);
    if (!batch) {
      console.error('Batch not found:', batchId);
      return;
    }

    // Update local state with new dispensed quantity
    const updatedInventory = inventory.map(b =>
      b.id === batchId
        ? { ...b, quantityDispensed: b.quantityDispensed + quantity }
        : b
    );
    setInventory(updatedInventory);

    console.log(`💊 Dispensing ${quantity} units of ${batch.drugName}`);
    console.log(`   Previous dispensed: ${batch.quantityDispensed}, New dispensed: ${batch.quantityDispensed + quantity}`);

    // Force immediate sync with updated inventory
    if (session && currentBranch) {
      console.log('🔄 Force syncing after dispensing...');
      const syncSuccess = await syncInventoryToCloud(updatedInventory, currentBranch.id, true);
      if (syncSuccess) {
        console.log('✅ Dispense synced successfully');
      } else {
        console.error('❌ Dispense sync failed');
      }
    }

    // Log transaction
    if (session && currentBranch && quantity > 0) {
      try {
        await logTransaction(
          'dispense',
          {
            drugName: batch.drugName,
            dosage: batch.dosage,
            batchNumber: batch.batchNumber,
            quantity: quantity,
            unit: batch.unit,
          },
          {
            branchId: currentBranch.id,
            branchName: currentBranch.name,
            userName: session.user.user_metadata?.name || session.user.email || 'Unknown',
            userId: session.user.id,
          },
          session.access_token
        );
      } catch (error) {
        console.error('Failed to log dispense transaction:', error);
      }
    }

    toast.success('Medicine dispensed successfully!', {
      description: `${batch.drugName} - ${quantity} units`,
    });
  };

  const handleDeleteBatch = async (batchId: string) => {
    try {
      const batch = inventory.find(b => b.id === batchId);
      if (!batch || !currentBranch) return;

      // Delete from local state
      setInventory(prev => prev.filter(b => b.id !== batchId));

      // Delete from database
      const token = await getFreshToken();
      if (token) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/${batchId}`,
          {
            method: 'DELETE',
            headers: {
              'X-User-Token': token,
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );
      }

      toast.success('Batch deleted successfully!', {
        description: `${batch.drugName} removed from inventory`,
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete batch');
    }
  };

  const handleUpdateBatch = async (batchId: string, updates: Partial<InventoryBatch>) => {
    try {
      // Update local state
      setInventory(prev => prev.map(batch =>
        batch.id === batchId ? { ...batch, ...updates } : batch
      ));

      // Update database
      const token = await getFreshToken();
      if (token && currentBranch) {
        const updatedBatch = inventory.find(b => b.id === batchId);
        if (updatedBatch) {
          const merged = { ...updatedBatch, ...updates };
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/${batchId}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-User-Token': token,
                'Authorization': `Bearer ${publicAnonKey}`,
              },
              body: JSON.stringify({
                drug_name: merged.drugName,
                dosage: merged.dosage,
                unit: merged.unit,
                batch_number: merged.batchNumber,
                beginning_inventory: merged.beginningInventory,
                quantity_received: merged.quantityReceived,
                date_received: merged.dateReceived,
                unit_price: merged.unitCost,
                quantity_dispensed: merged.quantityDispensed,
                expiry_date: merged.expirationDate,
                program: merged.program,
                category: merged.category,
                remarks: merged.remarks,
              }),
            }
          );
        }
      }

      toast.success('Batch updated successfully!');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update batch');
    }
  };

  const handleClearInventory = async () => {
    if (!session?.user?.id || !currentBranch?.id) {
      toast.error('Cannot clear inventory', { description: 'No active session or branch.' });
      return;
    }

    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Authentication error', { description: 'Could not get auth token.' });
        return;
      }

      toast.info('Clearing inventory...', { description: 'Deleting all inventory data from the database.' });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/delete-branch/${session.user.id}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      setInventory([]);
      setIsDataLoaded(true);
      toast.success('Inventory Cleared', { description: 'All inventory data has been deleted from the database.' });
    } catch (error: any) {
      console.error('❌ Clear inventory error:', error);
      toast.error('Clear Failed', { description: error.message || 'Could not clear inventory.' });
    }
  };
  
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');

        // ── Password-recovery path ──────────────────────────────────────────
        // detectSessionInUrl is false (needed to prevent auth lock contention),
        // so Supabase won't auto-process the recovery hash.  We do it manually:
        // extract access_token + refresh_token from the hash and call setSession()
        // so that ResetPasswordPage can call supabase.auth.updateUser() successfully.
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        if (hashParams.get('type') === 'recovery') {
          console.log('🔑 Password recovery URL detected — manually restoring session from hash');
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) {
              console.error('❌ Failed to set recovery session:', sessionError);
            } else {
              console.log('✅ Recovery session established — reset form ready');
            }
          }
          if (mounted) setIsLoading(false);
          return;
        }

        // ── Normal login path ───────────────────────────────────────────────
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (mounted) {
          if (initialSession) {
            console.log('Session found, loading user data...');
            setSession(initialSession);

            // Set loading to false FIRST so UI shows up
            setIsLoading(false);

            // Then fetch inventory in background (don't await - prevents blocking)
            const savedBranch = localStorage.getItem('mediflow_current_branch');
            if (savedBranch) {
              try {
                const parsedBranch = JSON.parse(savedBranch);
                setCurrentBranch(parsedBranch);

                // Fetch inventory without blocking - runs in background
                console.log('🔄 Fetching inventory in background...');
                fetchInventory(parsedBranch.id).catch(err => {
                  console.error('❌ Background inventory fetch failed:', err);
                  setIsDataLoaded(true); // Set flag even on error to prevent stuck state
                });
              } catch (err) {
                console.error('❌ Error parsing saved branch:', err);
                localStorage.removeItem('mediflow_current_branch');
                setIsDataLoaded(true);
              }
            } else {
              setIsDataLoaded(true);
            }
          } else {
            console.log('No active session found');
            setSession(null);
            setIsDataLoaded(false);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      console.log('Auth state changed:', event);

      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link — show the reset password form
        setIsPasswordRecovery(true);
        setIsLoading(false);
        return;
      }
      
      if (event === 'SIGNED_IN') {
        setSession(currentSession);
        setIsLoading(false); // Set loading false FIRST

        const savedBranch = localStorage.getItem('mediflow_current_branch');
        if (savedBranch) {
          try {
            const parsedBranch = JSON.parse(savedBranch);
            setCurrentBranch(parsedBranch);

            // Fetch inventory in background without blocking
            if (currentSession && !isDataLoaded) {
              console.log('🔄 Fetching inventory after sign-in...');
              fetchInventory(parsedBranch.id).catch(err => {
                console.error('❌ Background inventory fetch failed:', err);
                setIsDataLoaded(true);
              });
            }
          } catch (err) {
            console.error('❌ Error parsing saved branch on sign-in:', err);
            localStorage.removeItem('mediflow_current_branch');
          }
        }
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing state');
        setSession(null);
        setCurrentBranch(null);
        localStorage.removeItem('mediflow_current_branch');
        setInventory([]);
        setIsDataLoaded(false);
        setActiveMenuItem('home');
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (newSession: any, branch: { id: string; name: string }) => {
    console.log('📝 Login session object:', {
      hasAccessToken: !!newSession?.access_token,
      hasUser: !!newSession?.user,
      userId: newSession?.user?.id,
      tokenPreview: newSession?.access_token ? `${newSession.access_token.substring(0, 30)}...` : 'NO TOKEN',
      branch
    });
    
    setSession(newSession);
    setCurrentBranch(branch);
    localStorage.setItem('mediflow_current_branch', JSON.stringify(branch));
    fetchInventory(branch.id);

    // Ensure admin/HO users always have a row in the users table
    const loginRole = newSession?.user?.user_metadata?.role;
    if (loginRole === 'Administrator' || loginRole === 'Health Officer') {
      fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/ensure-user-row`,
        {
          method: 'POST',
          headers: {
            'X-User-Token': newSession.access_token,
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      ).then(r => r.json())
        .then(d => console.log('✅ ensure-user-row:', d))
        .catch(e => console.warn('⚠️ ensure-user-row failed:', e));
    }

    // Log the audit event
    kvStore.addAuditLog({
      userId: newSession.user.id,
      userName: newSession.user.user_metadata?.name || newSession.user.email,
      branchId: branch.id,
      branchName: branch.name,
    }).catch(console.error);

    const role = newSession.user.user_metadata.role || 'User';
    const name = newSession.user.user_metadata.name || newSession.user.email;
    
    // Set initial view based on role
    if (role === 'Administrator') {
      setActiveMenuItem('admin-dashboard');
    } else {
      setActiveMenuItem('home');
    }
    
    toast.success('Access Granted', { description: `Welcome back, ${name} (${role}) at ${branch.name}` });
  };

  const handleLogout = async () => {
    try {
      console.log('Initiating logout...');

      // Clear all local application state FIRST to prevent any pending sync operations
      // from attempting to run during logout
      setSession(null);
      setCurrentBranch(null);
      setInventory([]);
      setIsDataLoaded(false);
      setIsSyncing(false); // Stop any ongoing sync indicators
      setActiveMenuItem('home');
      localStorage.removeItem('mediflow_current_branch');

      // Then sign out from Supabase (clears local storage and cookies)
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('⚠️ Supabase signOut error:', error);
        // Continue anyway since we've already cleared local state
      }

      console.log('✅ Logout successful, state cleared.');
      toast.info('Session Ended', { description: 'You have been safely signed out.' });
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      // Emergency state clearing - ensure everything is reset
      setSession(null);
      setCurrentBranch(null);
      setInventory([]);
      setIsDataLoaded(false);
      setIsSyncing(false);
      setActiveMenuItem('home');
      localStorage.clear(); // Nuclear option to ensure persistence is gone

      // Force page reload to ensure clean state
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  };

  const renderView = () => {
    switch (activeMenuItem) {
      case 'home':
        return <HomeView inventory={inventory} userToken={session?.access_token} userRole={userRole} branchName={currentBranch?.name} />;
      case 'receive':
        const existingDrugs = Array.from(new Set(inventory.map(item => item.drugName)));
        return <ReceiveMedicationsView onAddStock={handleAddStock} existingDrugs={existingDrugs} inventory={inventory} />;
      case 'dispense':
        return <DispenseMedicinesView inventory={inventory} onDispense={handleDispense} />;
      case 'stock':
        return <StockOnHandView inventory={inventory} onDeleteBatch={handleDeleteBatch} userToken={session?.access_token} userRole={userRole} />;
      case 'stock-locator':
        return <StockLocatorView userToken={session?.access_token} />;
      case 'inventory':
        return <InventoryCheckView inventory={inventory} onClearInventory={handleClearInventory} />;
      case 'reports':
        return <ReportsView
          inventory={inventory}
          userToken={session?.access_token}
          userRole={userRole}
          userName={userName}
          branchName={currentBranch?.name || 'Unknown Branch'}
          onUpdateBatch={handleUpdateBatch}
          onDeleteBatch={handleDeleteBatch}
        />; 
      case 'alerts':
        return <AlertsView inventory={inventory} userToken={session?.access_token} userRole={userRole} branchName={currentBranch?.name} branchId={currentBranch?.id} />;
      case 'admin-dashboard':
        return session?.access_token ? <AdminDashboardView userToken={session.access_token} /> : null;
      case 'branch-management':
        return session?.access_token ? <BranchInventoryManagementView userToken={session.access_token} userRole={userRole} /> : null;
      case 'profile':
        return session?.access_token ? <ProfileView session={session} userToken={session.access_token} onProfileUpdate={async () => {
          // Force a complete session refresh to get updated user metadata
          try {
            console.log('🔄 Refreshing session after profile update...');
            
            // Step 1: Force refresh the session to get new JWT with updated metadata
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('❌ Error refreshing session:', refreshError);
              // Fallback: Get current session
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession) {
                console.log('✅ Using fallback session');
                setSession(currentSession);
              }
            } else if (refreshedSession) {
              console.log('✅ Session refreshed successfully with new metadata');
              setSession(refreshedSession);
            }
            
            // Small delay to ensure state updates
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error('❌ Session refresh error:', err);
          }
        }} /> : null;
      default:
        return <HomeView inventory={inventory} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9867C5] to-blue-700 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (isMaintenanceMode) {
    return <MaintenanceScreen />;
  }

  if (isPasswordRecovery) {
    return (
      <>
        <ResetPasswordPage
          onPasswordReset={() => {
            setIsPasswordRecovery(false);
            setSession(null);
          }}
        />
        <Toaster />
      </>
    );
  }

  // Custom KV-token reset flow — ?reset_token= in query string
  if (resetToken) {
    return (
      <>
        <ResetPasswordPage
          token={resetToken}
          onPasswordReset={() => {
            setResetToken(null);
            // Clean the token from the URL so the login page loads clean
            window.history.replaceState(null, '', window.location.pathname);
          }}
        />
        <Toaster />
      </>
    );
  }

  if (isLinkExpired) {
    return (
      <>
        <ExpiredLinkPage onBack={() => {
          setIsLinkExpired(false);
          // Clean the error hash from the URL so the login page loads clean
          window.history.replaceState(null, '', window.location.pathname);
        }} />
        <Toaster />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  const userRole = session?.user?.user_metadata?.role || 'Staff';
  const userName = session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'User';
  const profilePicture = session?.user?.user_metadata?.profilePicture || '';

  return (
    <>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar Navigation */}
        <Sidebar activeItem={activeMenuItem} onItemClick={setActiveMenuItem} userRole={userRole} />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <Header 
            onLogout={handleLogout} 
            userRole={userRole}
            userName={userName}
            profilePicture={profilePicture}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
          />
          
          {/* Main Dashboard Content */}
          <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
            {renderView()}
          </main>
        </div>
      </div>
      <Toaster />
    </>
  );
}
