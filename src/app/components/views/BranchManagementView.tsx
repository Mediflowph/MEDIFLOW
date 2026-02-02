import { useState, useEffect } from 'react';
import { Building, User, Mail, Phone, MapPin, Edit2, Save, X, Users, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';

interface BranchManagementViewProps {
  userToken: string;
  userRole?: string;
}

interface BranchUser {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  branchName: string;
  branchLocation?: string;
  branchContact?: string;
  profilePicture?: string;
}

export function BranchManagementView({ userToken, userRole }: BranchManagementViewProps) {
  const [branches, setBranches] = useState<BranchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BranchUser>>({});

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
      const branchUsers: BranchUser[] = data.map((item: any) => ({
        userId: item.userId,
        userName: item.userName || "Unknown User",
        userEmail: item.userEmail || "",
        userRole: item.userRole || "Staff",
        branchName: item.branchName || "Unknown Branch",
        branchLocation: item.branchLocation || "",
        branchContact: item.branchContact || "",
        profilePicture: item.profilePicture || "",
      }));

      setBranches(branchUsers);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to load branch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBranches();
  }, [userToken]);

  const handleEdit = (branch: BranchUser) => {
    setEditingBranch(branch.userId);
    setEditForm({
      userId: branch.userId,
      userName: branch.userName,
      branchName: branch.branchName,
      branchLocation: branch.branchLocation || '',
      branchContact: branch.branchContact || '',
    });
  };

  const handleCancel = () => {
    setEditingBranch(null);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editForm.userId) return;

    try {
      setIsLoading(true);
      
      // Use the update-profile endpoint which exists
      // Note: This updates the user's metadata in Supabase auth
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/update-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': userToken,
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            userId: editForm.userId,
            name: editForm.userName,
            branch: editForm.branchName,
            branchLocation: editForm.branchLocation,
            branchContact: editForm.branchContact,
          })
        }
      );

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        // Try to get error details if it's JSON
        let errorMessage = 'Failed to update branch information';
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            console.error('Could not parse error response:', e);
          }
        } else {
          const text = await response.text();
          console.error('Non-JSON error response:', text);
        }
        throw new Error(errorMessage);
      }

      // Parse response if it's JSON
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log('✅ Branch updated:', result);
      }

      toast.success('Branch Updated', { 
        description: 'Branch information has been saved successfully.' 
      });
      
      setEditingBranch(null);
      setEditForm({});
      fetchAllBranches(); // Refresh data
    } catch (error) {
      console.error('Error updating branch:', error);
      toast.error('Update Failed', { 
        description: error instanceof Error ? error.message : 'Could not save branch changes.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Group branches by unique branch name
  const uniqueBranches = branches.reduce((acc, branch) => {
    if (!acc.find(b => b.branchName === branch.branchName)) {
      acc.push(branch);
    }
    return acc;
  }, [] as BranchUser[]);

  const getBranchStaff = (branchName: string) => {
    return branches.filter(b => b.branchName === branchName);
  };

  if (isLoading && branches.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#9867C5]/20 border-t-[#9867C5] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
            <Building className="w-10 h-10 text-[#9867C5]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Branch Management</h2>
            <p className="text-gray-600">Manage branch locations, staff, and contact information</p>
          </div>
        </div>
        <button
          onClick={fetchAllBranches}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-[#9867C5] shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#9867C5]/10 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-[#9867C5]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Branches</p>
                <p className="text-2xl font-bold text-gray-800">{uniqueBranches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-blue-500 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Staff</p>
                <p className="text-2xl font-bold text-gray-800">{branches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Accounts</p>
                <p className="text-2xl font-bold text-gray-800">{branches.filter(b => b.userRole === 'Staff').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch Cards */}
      <div className="space-y-6">
        {uniqueBranches.map((branch) => {
          const staff = getBranchStaff(branch.branchName);
          
          return (
            <Card key={branch.branchName} className="border-none shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-gray-800">
                    <Building className="w-6 h-6 text-[#9867C5]" />
                    {branch.branchName}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{staff.length} Staff Member{staff.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Branch Contact Info (if available) */}
                {(branch.branchLocation || branch.branchContact) && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#9867C5]" />
                      Branch Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {branch.branchLocation && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{branch.branchLocation}</span>
                        </div>
                      )}
                      {branch.branchContact && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{branch.branchContact}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Staff Members */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700 mb-3">Staff Members</h4>
                  {staff.map((member) => {
                    const isEditing = editingBranch === member.userId;
                    
                    return (
                      <div key={member.userId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        {isEditing ? (
                          // Edit Mode
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Staff Name */}
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Staff Name</label>
                                <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={editForm.userName || ''}
                                    onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9867C5] outline-none"
                                    placeholder="Enter staff name"
                                  />
                                </div>
                              </div>

                              {/* Branch Name */}
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Branch Name</label>
                                <div className="relative">
                                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={editForm.branchName || ''}
                                    onChange={(e) => setEditForm({ ...editForm, branchName: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9867C5] outline-none"
                                    placeholder="Enter branch name"
                                  />
                                </div>
                              </div>

                              {/* Branch Location */}
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Branch Location</label>
                                <div className="relative">
                                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={editForm.branchLocation || ''}
                                    onChange={(e) => setEditForm({ ...editForm, branchLocation: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9867C5] outline-none"
                                    placeholder="Enter branch address"
                                  />
                                </div>
                              </div>

                              {/* Branch Contact */}
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Contact Number</label>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={editForm.branchContact || ''}
                                    onChange={(e) => setEditForm({ ...editForm, branchContact: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9867C5] outline-none"
                                    placeholder="Enter contact number"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 justify-end pt-2 border-t">
                              <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Cancel
                              </button>
                              <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="px-4 py-2 bg-[#9867C5] text-white rounded-lg hover:bg-[#9867C5]/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {/* Profile Picture */}
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9867C5] to-[#9867C5]/70 flex items-center justify-center overflow-hidden">
                                {member.profilePicture ? (
                                  <img src={member.profilePicture} alt={member.userName} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-6 h-6 text-white" />
                                )}
                              </div>
                              
                              {/* Staff Info */}
                              <div>
                                <p className="font-semibold text-gray-800">{member.userName}</p>
                                <div className="flex items-center gap-4 mt-1">
                                  <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <Mail className="w-3 h-3" />
                                    <span>{member.userEmail}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-sm">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      member.userRole === 'Administrator' 
                                        ? 'bg-purple-100 text-purple-700'
                                        : member.userRole === 'Health Officer'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {member.userRole}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleEdit(member)}
                              className="px-4 py-2 text-[#9867C5] border border-[#9867C5] rounded-lg hover:bg-[#9867C5] hover:text-white transition-colors flex items-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {branches.length === 0 && (
          <Card className="border-none shadow-md">
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Building className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No branches found</p>
                <p className="text-sm">Branch data will appear here once staff accounts are created</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}