import { useState, useEffect } from 'react';
import { Shield, RefreshCw, UserCheck, UserX, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { supabase } from '@/app/utils/supabase';
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

export function AdminDashboardView({ userToken }: AdminDashboardViewProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState(userToken);

  // Function to get a fresh token
  const getFreshToken = async (): Promise<string> => {
    try {
      console.log('🔄 Refreshing authentication token...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.error('❌ Failed to get session:', error);
        throw new Error('Failed to get fresh authentication token');
      }
      
      console.log('✅ Fresh token obtained');
      setCurrentToken(session.access_token);
      return session.access_token;
    } catch (error) {
      console.error('❌ Error getting fresh token:', error);
      throw error;
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setIsPendingLoading(true);
      
      // Get fresh token before making request
      const token = await getFreshToken();
      
      console.log('🔍 Fetching pending users...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/pending-users`,
        {
          headers: {
            'X-User-Token': token,
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        // Try to get error details
        let errorMessage = 'Failed to fetch pending users';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('❌ Error response:', errorData);
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          // If endpoint doesn't exist, just set empty array
          setPendingUsers([]);
          return;
        }
        throw new Error(errorMessage);
      }

      // Check if response has content before parsing
      const contentType = response.headers.get('content-type');
      console.log('📄 Content-Type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        console.error('⚠️ Pending users response is not JSON:', contentType);
        const text = await response.text();
        console.error('⚠️ Response text:', text);
        setPendingUsers([]);
        return;
      }

      const text = await response.text();
      console.log('📄 Response text length:', text.length);
      
      if (!text || text.trim() === '') {
        console.log('⚠️ Empty response for pending users');
        setPendingUsers([]);
        return;
      }

      const pendingUsersData = JSON.parse(text);
      console.log('✅ Parsed pending users:', pendingUsersData);
      
      setPendingUsers(Array.isArray(pendingUsersData) ? pendingUsersData : []);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      // Don't show toast error if endpoint doesn't exist - just set empty array
      setPendingUsers([]);
    } finally {
      setIsPendingLoading(false);
    }
  };

  useEffect(() => {
    if (userToken) {
      fetchPendingUsers();
    }
  }, [userToken]);

  const handleApproveUser = async (userId: string) => {
    const confirmApprove = window.confirm(
      `Are you sure you want to approve this user?\n\nUser ID: ${userId}\n\nThis action cannot be undone.`
    );

    if (!confirmApprove) return;

    try {
      setApprovingUserId(userId);
      
      // Get fresh token before making request
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve user');
      }

      const result = await response.json();
      
      toast.success('User Approved', {
        description: result.message || `User has been approved and can now sign in.`
      });

      // Refresh the pending users list
      await fetchPendingUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Approval Failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setApprovingUserId(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    const confirmReject = window.confirm(
      `Are you sure you want to reject this user?\n\nUser ID: ${userId}\n\nThis will permanently delete their account.`
    );

    if (!confirmReject) return;

    try {
      setRejectingUserId(userId);
      
      // Get fresh token before making request
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject user');
      }

      const result = await response.json();
      
      toast.success('User Rejected', {
        description: result.message || `User registration has been rejected and account deleted.`
      });

      // Refresh the pending users list
      await fetchPendingUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Rejection Failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setRejectingUserId(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
            <Shield className="w-10 h-10 text-[#9867C5]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
            <p className="text-gray-600 font-medium">Two-Factor User Approval System</p>
          </div>
        </div>
        <button
          onClick={fetchPendingUsers}
          disabled={isPendingLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 disabled:bg-[#9867C5]/50 text-white rounded-lg transition-colors shadow-md"
        >
          <RefreshCw className={`w-4 h-4 ${isPendingLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Pending Users List */}
      <Card className="border-none shadow-md">
        <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <UserCheck className="w-5 h-5 text-[#9867C5]" />
              Pending User Approvals
            </CardTitle>
            {pendingUsers.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-medium">
                <Clock className="w-3 h-3" />
                {pendingUsers.length} Pending
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            🛡️ Two-Factor Security: All Pharmacy Staff registrations require administrator approval before access is granted
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {isPendingLoading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-300 animate-spin" />
              <p className="text-lg font-medium">Loading pending users...</p>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No pending users found</p>
              <p className="text-sm">Pending user approvals will appear here when staff members register</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((user, index) => (
                <div
                  key={user.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border-l-4 border-amber-500"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-[#9867C5]/10 rounded-lg flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-[#9867C5]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{user.name}</h4>
                        <p className="text-xs text-gray-500">User ID: {user.id.substring(0, 8)}...</p>
                        <p className="text-xs text-gray-500">Email: {user.email}</p>
                        <p className="text-xs text-gray-500">Role: {user.role}</p>
                        <p className="text-xs text-gray-500">Branch: {user.branch}</p>
                        <p className="text-xs text-gray-500">Created At: {new Date(user.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleApproveUser(user.id)}
                        disabled={approvingUserId === user.id}
                        className="flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg transition-colors shadow-sm text-sm font-medium"
                      >
                        <UserCheck className="w-4 h-4" />
                        {approvingUserId === user.id ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleRejectUser(user.id)}
                        disabled={rejectingUserId === user.id}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg transition-colors shadow-sm text-sm font-medium"
                      >
                        <UserX className="w-4 h-4" />
                        {rejectingUserId === user.id ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}