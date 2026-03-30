import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { supabase } from '@/app/utils/supabase';
import { authManager } from '@/app/utils/authManager';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { kvStore } from '@/app/utils/kvStore';
import { LoginPage } from '@/app/components/auth/LoginPage';
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
import { BranchManagementView } from '@/app/components/views/BranchManagementView';
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

  // Get fresh authentication token using centralized auth manager
  const getFreshToken = async (): Promise<string | null> => {
    const token = await authManager.getToken();
    if (token) {
      // Update session state if we got a valid token
      const currentSession = await authManager.getSession();
      if (currentSession) {
        setSession(currentSession);
      }
    }
    return token;
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

      // Fetch from SQL database via backend API
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/${branchId}`,
        {
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

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
          beginningInventory: item.quantity || 0,
          quantityReceived: 0,
          dateReceived: item.date_received || item.created_at || '',
          unitCost: item.unit_cost || item.unit_price || 0,
          quantityDispensed: 0,
          expirationDate: item.expiration_date || item.expiry_date || '',
          remarks: item.remarks || ''
        }));
        setInventory(transformedInventory);
      } else {
        console.log('ℹ️ No inventory data found');
        setInventory([]);
      }
      setIsDataLoaded(true);
    } catch (error) {
      console.error('❌ Error fetching inventory:', error);
      setInventory([]);
      setIsDataLoaded(true);
    }
  };

  // Sync inventory to Supabase
  const syncInventoryToCloud = async (inventoryData: InventoryBatch[], branchId: string) => {
    if (!branchId) return false;
    setIsSyncing(true);
    console.log('🔄 Syncing to branch', branchId);
    
    try {
      const token = await getFreshToken();
      if (!token) {
        console.error('❌ No authentication token available for sync');
        setIsSyncing(false);
        return false;
      }

      // Transform inventory to SQL format
      const transformedInventory = inventoryData.map(item => ({
        drug_name: item.drugName,
        generic_name: item.drugName, // Using drugName as generic for now
        dosage: item.dosage || null,
        quantity: (item.beginningInventory + item.quantityReceived - item.quantityDispensed) || 0,
        expiry_date: item.expirationDate,
        batch_number: item.batchNumber,
        supplier: 'N/A',
        unit_price: item.unitCost
      }));

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
          body: JSON.stringify({ inventory: transformedInventory })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync inventory');
      }

      console.log('✅ Inventory synced to SQL database');
      setLastSyncTime(new Date());
      setIsSyncing(false);
      return true;
    } catch (error) {
      console.error('❌ Sync error:', error);
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
    if (isSyncing || !isDataLoaded || !currentBranch || inventory.length === 0) {
      return;
    }
    
    // Debounce sync operations to prevent continuous syncing
    const syncTimeout = setTimeout(async () => {
      console.log('📊 Inventory changed, auto-syncing...');
      const success = await syncInventoryToCloud(inventory, currentBranch.id);
      if (!success) {
        toast.error('Sync Failed', { 
          description: 'Failed to save to cloud. Changes may be lost on refresh.' 
        });
      }
    }, 1000); // Wait 1 second before syncing to batch rapid changes
    
    return () => clearTimeout(syncTimeout);
  }, [inventory, currentBranch?.id]); // Only trigger on inventory or branch changes

  // Ensure data loaded flag is properly set when session changes
  useEffect(() => {
    if (!session) {
      setIsDataLoaded(false);
    }
  }, [session]);

  const handleAddStock = (batch: Omit<InventoryBatch, 'id'>) => {
    const newBatch: InventoryBatch = {
      ...batch,
      id: Math.random().toString(36).substr(2, 9),
    };
    
    setInventory(prev => [...prev, newBatch]);
    toast.success('Stock added successfully!', {
      description: `${batch.drugName} - Batch ${batch.batchNumber}`,
    });
  };

  const handleDispense = (batchId: string, quantity: number) => {
    setInventory(prev => prev.map(batch =>
      batch.id === batchId
        ? { ...batch, quantityDispensed: batch.quantityDispensed + quantity }
        : batch
    ));
    
    const batch = inventory.find(b => b.id === batchId);
    toast.success('Medicine dispensed successfully!', {
      description: `${batch?.drugName} - ${quantity} units`,
    });
  };

  const handleDeleteBatch = (batchId: string) => {
    setInventory(prev => prev.filter(batch => batch.id !== batchId));
    toast.success('Batch deleted successfully!', {
      description: `Batch ${batchId} removed from inventory`,
    });
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (initialSession) {
            console.log('Session found, loading user data...');
            setSession(initialSession);
            // Update auth manager cache
            authManager.updateCache(initialSession);
            const savedBranch = localStorage.getItem('mediflow_current_branch');
            if (savedBranch) {
              const parsedBranch = JSON.parse(savedBranch);
              setCurrentBranch(parsedBranch);
              await fetchInventory(parsedBranch.id);
            }
            setIsLoading(false); // Set loading false after fetch completes
          } else {
            console.log('No active session found');
            setSession(null);
            authManager.clearCache();
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
      
      if (event === 'SIGNED_IN') {
        setSession(currentSession);
        authManager.updateCache(currentSession);
        const savedBranch = localStorage.getItem('mediflow_current_branch');
        if (savedBranch) {
          const parsedBranch = JSON.parse(savedBranch);
          setCurrentBranch(parsedBranch);
          if (currentSession && !isDataLoaded) {
            await fetchInventory(parsedBranch.id);
          }
        }
        setIsLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        authManager.updateCache(currentSession);
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing state');
        setSession(null);
        authManager.clearCache();
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
      // Sign out from Supabase (clears local storage and cookies)
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear all local application state
      setSession(null);
      setCurrentBranch(null);
      localStorage.removeItem('mediflow_current_branch');
      setInventory([]);
      setIsDataLoaded(false);
      setActiveMenuItem('home');
      
      console.log('Logout successful, state cleared.');
      toast.info('Session Ended', { description: 'You have been safely signed out.' });
    } catch (error: any) {
      console.error('Logout error:', error);
      // Emergency state clearing
      setSession(null);
      setCurrentBranch(null);
      setInventory([]);
      setIsDataLoaded(false);
      localStorage.clear(); // Nuclear option to ensure persistence is gone
      window.location.href = '/'; // Force a clean slate
    }
  };

  const renderView = () => {
    switch (activeMenuItem) {
      case 'home':
        return <HomeView inventory={inventory} userToken={session?.access_token} userRole={userRole} />;
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
        return <InventoryCheckView inventory={inventory} />;
      case 'reports':
        return <ReportsView 
          inventory={inventory} 
          userToken={session?.access_token} 
          userRole={userRole}
          userName={userName}
          branchName={currentBranch?.name || 'Unknown Branch'}
        />; 
      case 'alerts':
        return <AlertsView inventory={inventory} userToken={session?.access_token} userRole={userRole} />;
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