import { useState, useEffect } from 'react';
import { authManager } from '@/app/utils/authManager';
import type { Branch, AuditLog } from '@/app/utils/kvStore';
import { Shield, RefreshCw, UserCheck, UserX, Clock, List, Building, Plus, Database, Users, Search, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';

interface AdminDashboardViewProps {
  userToken: string;
}

interface PendingUser {
  id: string;
  email: string;
  name: string;
  role: string;
  branch: string;
  createdAt: string;
}

interface AllUser {
  id: string;
  email: string;
  name: string;
  role: string;
  branchId: string | null;
  branchName: string | null;
  approved: boolean;
}

export function AdminDashboardView({ userToken }: AdminDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'logs' | 'branches' | 'users'>('approvals');
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isBranchesLoading, setIsBranchesLoading] = useState(false);
  const [isAllUsersLoading, setIsAllUsersLoading] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState(userToken);
  
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isPopulatingSamples, setIsPopulatingSamples] = useState(false);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(false);
  const [isCreatingMissingBranches, setIsCreatingMissingBranches] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);

  // Function to get a fresh token using centralized auth manager
  const getFreshToken = async (): Promise<string> => {
    const token = await authManager.getToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    setCurrentToken(token);
    return token;
  };

  const fetchPendingUsers = async () => {
    try {
      setIsPendingLoading(true);
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/pending-users`,
        {
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        setPendingUsers([]);
        return;
      }

      const pendingUsersData = await response.json();
      setPendingUsers(Array.isArray(pendingUsersData) ? pendingUsersData : []);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      setPendingUsers([]);
    } finally {
      setIsPendingLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setIsAllUsersLoading(true);
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/all-users`,
        {
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        setAllUsers([]);
        return;
      }

      const allUsersData = await response.json();
      setAllUsers(Array.isArray(allUsersData) ? allUsersData : []);
    } catch (error) {
      console.error('Error fetching all users:', error);
      setAllUsers([]);
    } finally {
      setIsAllUsersLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setIsLogsLoading(true);
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/audit-logs`,
        {
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      if (!response.ok) {
        console.error('Failed to fetch audit logs:', response.status);
        setAuditLogs([]);
        return;
      }
      const logsData = await response.json();
      setAuditLogs(Array.isArray(logsData) ? logsData : []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setAuditLogs([]);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      setIsBranchesLoading(true);
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/branches`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch branches - HTTP error:', response.status);
        throw new Error('Failed to fetch branches');
      }

      const branchesData = await response.json();
      console.log('✅ Fetched branches from SQL:', branchesData);
      
      // Transform to match old format if needed
      const transformedBranches = Array.isArray(branchesData) ? branchesData.map(b => ({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt || b.created_at,
        inventoryCount: b.inventoryCount || 0,
        hasInventory: b.hasInventory || false
      })) : [];
      
      setBranches(transformedBranches);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setIsBranchesLoading(false);
    }
  };

  useEffect(() => {
    if (userToken) {
      fetchPendingUsers();
      fetchAuditLogs();
      fetchBranches();
      fetchAllUsers();
    }
  }, [userToken]);

  const handleApproveUser = async (userId: string) => {
    if (!window.confirm('Approve this user?')) return;
    try {
      setApprovingUserId(userId);
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/approve-user/${userId}`,
        {
          method: 'POST',
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      if (!response.ok) throw new Error('Failed to approve user');
      toast.success('User Approved');
      await fetchPendingUsers();
    } catch (error) {
      toast.error('Approval Failed');
    } finally {
      setApprovingUserId(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!window.confirm('Reject and delete this user?')) return;
    try {
      setRejectingUserId(userId);
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/reject-user/${userId}`,
        {
          method: 'POST',
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      if (!response.ok) throw new Error('Failed to reject user');
      toast.success('User Rejected');
      await fetchPendingUsers();
    } catch (error) {
      toast.error('Rejection Failed');
    } finally {
      setRejectingUserId(null);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    try {
      setIsCreatingBranch(true);
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/branches`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ name: newBranchName.trim() })
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create branch');
      }

      toast.success('Branch Created', { description: `${newBranchName} is now available for login.` });
      setNewBranchName('');
      await fetchBranches();
    } catch (error: any) {
      toast.error('Creation Failed', { description: error.message });
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const deleteBranch = async (branchId: string, branchName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${branchName}"? This will remove all inventory data for this branch and cannot be undone.`)) return;
    try {
      const token = await getFreshToken();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/branches/${branchId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete branch');
      }
      setBranches(prev => prev.filter(b => b.id !== branchId));
      toast.success('Branch Deleted', { description: `${branchName} has been removed.` });
    } catch (error: any) {
      toast.error('Delete Failed', { description: error.message });
    }
  };

  const initializeInventory = async (branchId: string, branchName: string) => {
    if (!window.confirm(`Initialize base inventory for ${branchName}? This will reset any existing inventory for this branch.`)) return;
    
    try {
      setIsBranchesLoading(true);
      const token = await getFreshToken();
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/branches/${branchId}/initialize-inventory`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to initialize inventory');
      }

      const result = await response.json();
      toast.success('Inventory Initialized', { description: result.message });
      
      // Refresh branches to update inventory counts
      await fetchBranches();
    } catch (error: any) {
      toast.error('Initialization Failed', { description: error.message });
    } finally {
      setIsBranchesLoading(false);
    }
  };

  const handleMigrateToSQL = async () => {
    if (!window.confirm('This will migrate all data from the KV store to the new SQL tables. This is a one-time operation. Continue?')) return;
    
    try {
      setIsMigrating(true);
      const token = await getFreshToken();
      
      toast.info('Migration Started', { description: 'Migrating data from KV store to SQL tables...' });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/migrate-to-sql`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Migration failed');
      }
      
      console.log('Migration results:', result);
      
      toast.success('Migration Complete!', { 
        description: `Migrated ${result.summary.totalMigrated} records with ${result.summary.totalErrors} errors.`
      });
      
      // Show detailed results
      if (result.results) {
        console.log('📊 Migration Details:');
        console.log(`  Branches: ${result.results.branches.migrated} migrated`);
        console.log(`  Users: ${result.results.users.migrated} migrated`);
        console.log(`  Inventory: ${result.results.inventory.migrated} migrated`);
        console.log(`  Audit Logs: ${result.results.auditLogs.migrated} migrated`);
        
        if (result.summary.totalErrors > 0) {
          console.warn('⚠️ Errors occurred during migration:', result.results);
        }
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      toast.error('Migration Failed', { description: error.message });
    } finally {
      setIsMigrating(false);
    }
  };

  const handlePopulateSampleMedicines = async () => {
    if (!window.confirm('This will add 30 sample medicine items to ALL branches. Existing inventory will remain intact. Continue?')) return;
    
    try {
      setIsPopulatingSamples(true);
      const token = await getFreshToken();
      
      toast.info('Populating Samples', { description: 'Adding sample medicines to all branches...' });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/populate-sample-medicines`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to populate sample medicines');
      }
      
      console.log('Population results:', result);
      
      toast.success('Sample Medicines Added!', { 
        description: `Successfully added ${result.totalItemsAdded} items across ${result.branchesProcessed} branches.`
      });
      
      // Show detailed results
      if (result.results) {
        console.log('📊 Population Details:');
        result.results.forEach((branchResult: any) => {
          console.log(`  ${branchResult.branchName}: ${branchResult.itemsAdded} items - ${branchResult.status}`);
        });
      }
      
      // Refresh branches view
      await fetchBranches();
      
    } catch (error: any) {
      console.error('Population error:', error);
      toast.error('Population Failed', { description: error.message });
    } finally {
      setIsPopulatingSamples(false);
    }
  };

  const handleSyncUserBranches = async () => {
    if (!window.confirm('This will sync all user-branch assignments based on their account metadata. This fixes the "0 branches" issue in Stock Locator. Continue?')) return;
    
    try {
      setIsSyncingUsers(true);
      const token = await getFreshToken();
      
      toast.info('Syncing Users', { description: 'Assigning users to branches...' });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/sync-user-branches`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync user branches');
      }
      
      console.log('Sync results:', result);
      
      toast.success('User-Branch Sync Complete!', { 
        description: `Assigned ${result.assigned} users, skipped ${result.skipped}. Errors: ${result.errors.length}`
      });
      
      // Show detailed results
      if (result.errors && result.errors.length > 0) {
        console.log('⚠️ Sync Errors:');
        result.errors.forEach((error: string) => {
          console.log(`  ${error}`);
        });
      }
      
      // Refresh users view
      await fetchAllUsers();
      
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Sync Failed', { description: error.message });
    } finally {
      setIsSyncingUsers(false);
    }
  };

  const handleRunDiagnostic = async () => {
    try {
      setIsDiagnosticLoading(true);
      const token = await getFreshToken();
      
      toast.info('Running Diagnostic', { description: 'Analyzing branch and user assignments...' });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/diagnostic/branch-status`,
        {
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to run diagnostic');
      }
      
      console.log('Diagnostic results:', result);
      setDiagnosticData(result);
      
      const issueCount = 
        (result.issues?.mismatches?.length || 0) + 
        (result.issues?.missingBranches?.length || 0) +
        (result.issues?.usersNotInTable?.length || 0);
      
      if (issueCount === 0) {
        toast.success('No Issues Found!', { description: 'All user-branch assignments are correct.' });
      } else {
        toast.warning('Issues Detected', { description: `Found ${issueCount} issue(s) requiring attention.` });
      }
      
    } catch (error: any) {
      console.error('Diagnostic error:', error);
      toast.error('Diagnostic Failed', { description: error.message });
    } finally {
      setIsDiagnosticLoading(false);
    }
  };

  const handleCreateMissingBranches = async () => {
    if (!window.confirm('This will create any branches that are in user metadata but not in the branches table. Continue?')) return;
    
    try {
      setIsCreatingMissingBranches(true);
      const token = await getFreshToken();
      
      toast.info('Creating Branches', { description: 'Adding missing branches...' });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/create-missing-branches`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create branches');
      }
      
      console.log('Branch creation results:', result);
      
      toast.success('Branches Created!', { 
        description: `Created ${result.created} new branches. Errors: ${result.errors.length}`
      });
      
      if (result.errors && result.errors.length > 0) {
        console.log('⚠️ Branch Creation Errors:');
        result.errors.forEach((error: string) => {
          console.log(`  ${error}`);
        });
      }
      
      // Refresh branches and re-run diagnostic
      await fetchBranches();
      await handleRunDiagnostic();
      
    } catch (error: any) {
      console.error('Branch creation error:', error);
      toast.error('Branch Creation Failed', { description: error.message });
    } finally {
      setIsCreatingMissingBranches(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
            <Shield className="w-10 h-10 text-[#9867C5]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
            <p className="text-gray-600 font-medium">System Administration & Auditing</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleMigrateToSQL}
            disabled={isMigrating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="w-4 h-4" />
            {isMigrating ? 'Migrating...' : 'Migrate to SQL'}
          </button>
          <button
            onClick={() => {
              fetchPendingUsers();
              fetchAuditLogs();
              fetchBranches();
              fetchAllUsers();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'approvals' ? 'border-[#9867C5] text-[#9867C5]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Pending Approvals ({pendingUsers.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'logs' ? 'border-[#9867C5] text-[#9867C5]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Audit Logs
          </div>
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'branches' ? 'border-[#9867C5] text-[#9867C5]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Branches ({branches.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'users' ? 'border-[#9867C5] text-[#9867C5]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <List className="w-4 h-4" />
            All Users
          </div>
        </button>
      </div>

      {activeTab === 'approvals' && (
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="text-gray-800 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#9867C5]" />
              User Registration Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isPendingLoading ? (
              <div className="text-center py-12"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No pending registrations found</div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map(user => (
                  <div key={user.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between border-l-4 border-amber-500">
                    <div>
                      <h4 className="font-semibold text-gray-800">{user.name}</h4>
                      <p className="text-xs text-gray-500">{user.email} • {user.role}</p>
                      <p className="text-xs text-gray-500">Requested Branch: {user.branch}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveUser(user.id)} disabled={approvingUserId === user.id} className="px-3 py-1.5 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600">
                        {approvingUserId === user.id ? '...' : 'Approve'}
                      </button>
                      <button onClick={() => handleRejectUser(user.id)} disabled={rejectingUserId === user.id} className="px-3 py-1.5 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600">
                        {rejectingUserId === user.id ? '...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#9867C5]" />
              User Access Audit Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLogsLoading ? (
              <div className="text-center py-12"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No login activity recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Timestamp</th>
                      <th className="px-6 py-3">User</th>
                      <th className="px-6 py-3">Branch Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {new Date(log.loginTime).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{log.userName}</div>
                          <div className="text-xs text-gray-500">ID: {log.userId.substring(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {log.branchName}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'branches' && (
        <div className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#9867C5]" />
                Initialize New Branch
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateBranch} className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Enter unique branch name (e.g. Baguio South District)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9867C5] outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingBranch || !newBranchName.trim()}
                  className="px-6 py-2 bg-[#9867C5] text-white rounded-lg hover:bg-[#9867C5]/90 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                >
                  <Building className="w-4 h-4" />
                  {isCreatingBranch ? 'Creating...' : 'Create Branch'}
                </button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="border-b bg-gradient-to-r from-green-500/10 to-emerald-500/10">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                Populate Sample Medicines
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium mb-1">
                    Quick Start with Sample Data
                  </p>
                  <p className="text-xs text-gray-600">
                    Instantly add 30 comprehensive medicine items to all branches (Pain Relief, Antibiotics, Cardiovascular, Diabetes, Respiratory, Vitamins, and more)
                  </p>
                </div>
                <button
                  onClick={handlePopulateSampleMedicines}
                  disabled={isPopulatingSamples || branches.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shadow-md"
                >
                  <Database className="w-4 h-4" />
                  {isPopulatingSamples ? 'Populating...' : 'Populate All Branches'}
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="border-b bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Sync User-Branch Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium mb-1">
                    Fix Stock Locator "0 branches" Issue
                  </p>
                  <p className="text-xs text-gray-600">
                    Assigns all Pharmacy Staff users to their branches based on account metadata. This enables Stock Locator to display inventory across all branches.
                  </p>
                </div>
                <button
                  onClick={handleSyncUserBranches}
                  disabled={isSyncingUsers}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shadow-md"
                >
                  <Users className="w-4 h-4" />
                  {isSyncingUsers ? 'Syncing...' : 'Sync All Users'}
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Search className="w-5 h-5 text-amber-600" />
                Stock Locator Diagnostic Tool
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium mb-1">
                    Diagnose Stock Locator Issues
                  </p>
                  <p className="text-xs text-gray-600">
                    Check if branches exist in the database and if users are properly assigned to their branches. This helps identify why Stock Locator might show "0 branches".
                  </p>
                </div>
                <button
                  onClick={handleRunDiagnostic}
                  disabled={isDiagnosticLoading}
                  className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shadow-md"
                >
                  <Search className="w-4 h-4" />
                  {isDiagnosticLoading ? 'Analyzing...' : 'Run Diagnostic'}
                </button>
              </div>

              {diagnosticData && (
                <div className="space-y-4 mt-6 border-t pt-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Branches in Database</p>
                      <p className="text-2xl font-bold text-gray-800">{diagnosticData.branches.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Total Users</p>
                      <p className="text-2xl font-bold text-gray-800">{diagnosticData.users.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Users with Branches</p>
                      <p className="text-2xl font-bold text-green-600">{diagnosticData.users.withBranchAssignment}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Users without Branches</p>
                      <p className="text-2xl font-bold text-red-600">{diagnosticData.users.withoutBranchAssignment}</p>
                    </div>
                  </div>

                  {/* Issues Section */}
                  {(diagnosticData.issues.missingBranches.length > 0 || 
                    diagnosticData.issues.mismatches.length > 0 ||
                    diagnosticData.issues.usersNotInTable.length > 0) && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        Issues Detected
                      </h3>

                      {/* Missing Branches */}
                      {diagnosticData.issues.missingBranches.length > 0 && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-semibold text-red-800 mb-1 flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Missing Branches ({diagnosticData.issues.missingBranches.length})
                              </p>
                              <p className="text-sm text-red-700 mb-2">
                                These branches exist in user metadata but not in the branches table:
                              </p>
                              <ul className="text-xs text-red-600 space-y-1 ml-6 list-disc">
                                {diagnosticData.issues.missingBranches.map((branch: string, idx: number) => (
                                  <li key={idx}>{branch}</li>
                                ))}
                              </ul>
                            </div>
                            <button
                              onClick={handleCreateMissingBranches}
                              disabled={isCreatingMissingBranches}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                            >
                              {isCreatingMissingBranches ? 'Creating...' : 'Create Branches'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* User Mismatches */}
                      {diagnosticData.issues.mismatches.length > 0 && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-semibold text-yellow-800 mb-1 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Users with Branch in Metadata but not in Table ({diagnosticData.issues.mismatches.length})
                              </p>
                              <p className="text-sm text-yellow-700 mb-2">
                                These users have a branch in their auth metadata but no branch_id in the users table:
                              </p>
                              <ul className="text-xs text-yellow-600 space-y-1 ml-6 list-disc max-h-40 overflow-y-auto">
                                {diagnosticData.issues.mismatches.map((mismatch: any, idx: number) => (
                                  <li key={idx}>
                                    {mismatch.name} ({mismatch.email}) - {mismatch.role} - Branch: {mismatch.branchInMetadata}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <button
                              onClick={handleSyncUserBranches}
                              disabled={isSyncingUsers}
                              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                            >
                              {isSyncingUsers ? 'Syncing...' : 'Sync Users'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Users Not in Table */}
                      {diagnosticData.issues.usersNotInTable.length > 0 && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                          <p className="font-semibold text-orange-800 mb-1 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Users Not in Users Table ({diagnosticData.issues.usersNotInTable.length})
                          </p>
                          <p className="text-sm text-orange-700 mb-2">
                            These users exist in auth but not in the users table:
                          </p>
                          <ul className="text-xs text-orange-600 space-y-1 ml-6 list-disc max-h-40 overflow-y-auto">
                            {diagnosticData.issues.usersNotInTable.map((user: any, idx: number) => (
                              <li key={idx}>
                                {user.email} - {user.role} - Branch: {user.branchMetadata || 'N/A'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* All Good Message */}
                  {diagnosticData.issues.missingBranches.length === 0 && 
                   diagnosticData.issues.mismatches.length === 0 &&
                   diagnosticData.issues.usersNotInTable.length === 0 && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                      <p className="font-semibold text-green-800 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        All Systems Operational
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        All branches exist and all users are properly assigned to their branches. Stock Locator should work correctly.
                      </p>
                    </div>
                  )}

                  {/* Branches List */}
                  {diagnosticData.branches.total > 0 && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="font-semibold text-gray-800 mb-2">Branches in Database:</p>
                      <div className="flex flex-wrap gap-2">
                        {diagnosticData.branches.list.map((branch: any) => (
                          <span key={branch.id} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {branch.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Building className="w-5 h-5 text-[#9867C5]" />
                Active Registered Branches
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isBranchesLoading ? (
                <div className="text-center py-12"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
              ) : branches.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No branches registered.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branches.map(branch => (
                    <div key={branch.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <Building className="w-5 h-5 text-[#9867C5]" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{branch.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">ID: {branch.id}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => initializeInventory(branch.id, branch.name)}
                          className="p-2 text-[#9867C5] hover:bg-[#9867C5]/10 rounded-lg"
                          title="Initialize Inventory"
                        >
                          <Database className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteBranch(branch.id, branch.name)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                          title="Delete Branch"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'users' && (
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="text-gray-800 flex items-center gap-2">
              <List className="w-5 h-5 text-[#9867C5]" />
              All Registered Users
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isAllUsersLoading ? (
              <div className="text-center py-12"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
            ) : allUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No users registered.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allUsers.map(user => (
                  <div key={user.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <UserCheck className="w-5 h-5 text-[#9867C5]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{user.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">ID: {user.id}</p>
                        <p className="text-[10px] text-gray-400 font-mono">Role: {user.role}</p>
                        <p className="text-[10px] text-gray-400 font-mono">Branch: {user.branchName || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleApproveUser(user.id)}
                        className="p-2 text-[#9867C5] hover:bg-[#9867C5]/10 rounded-lg"
                        title="Approve User"
                        disabled={user.approved}
                      >
                        <UserCheck className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleRejectUser(user.id)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                        title="Delete User"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}