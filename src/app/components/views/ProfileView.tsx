import { useState, useEffect } from 'react';
import { User, Camera, Save, Building, Mail, Shield, Edit2, X, Phone, MapPin, Users, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';
import { toast } from 'sonner';

interface ProfileViewProps {
  session: any;
  userToken: string;
  onProfileUpdate: () => void;
}

interface BranchUser {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  branchName: string;
  branchContact?: string;
  phone?: string; // Add phone field
  profilePicture?: string;
}

export function ProfileView({ session, userToken, onProfileUpdate }: ProfileViewProps) {
  const [name, setName] = useState(session?.user?.user_metadata?.name || '');
  const [profilePicture, setProfilePicture] = useState(session?.user?.user_metadata?.profilePicture || '');
  const [isLoading, setIsLoading] = useState(false);

  // Branch management state (for Admins only)
  const [branches, setBranches] = useState<BranchUser[]>([]);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BranchUser>>({});

  const userRole = session?.user?.user_metadata?.role || 'Staff';
  const userBranch = session?.user?.user_metadata?.branch || 'N/A';
  const userEmail = session?.user?.email || '';
  
  // Only allow name editing for Administrator and Health Officer
  const canEditInfo = false; // Disabled for all users - name fields are not editable
  const isAdmin = userRole === 'Administrator';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/update-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': userToken,
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ name, profilePicture })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const result = await response.json();
      console.log('✅ Profile updated on server:', result);

      toast.success('Profile Updated', { 
        description: 'Your profile has been saved successfully. Refreshing...' 
      });
      
      // Call the callback to refresh session in parent
      onProfileUpdate();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Update Failed', { description: error instanceof Error ? error.message : 'Could not save your profile changes.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Branch management functions (for Admins only)
  const fetchAllBranches = async () => {
    if (!userToken || !isAdmin) return;
    
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
        branchContact: item.branchContact || "",
        phone: item.phone || "", // Add phone field
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
    if (isAdmin) {
      fetchAllBranches();
    }
  }, [userToken, isAdmin]);

  const handleEditBranch = (branch: BranchUser) => {
    setEditingBranch(branch.userId);
    setEditForm({
      userId: branch.userId,
      userName: branch.userName,
      branchName: branch.branchName,
      phone: branch.phone || branch.branchContact || '', // Use phone, fallback to branchContact
    });
  };

  const handleCancelEdit = () => {
    setEditingBranch(null);
    setEditForm({});
  };

  const handleSaveBranch = async () => {
    if (!editForm.userId) return;

    try {
      setIsLoading(true);
      
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
            branchContact: editForm.phone, // Use phone for branchContact
          })
        }
      );

      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
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

      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log('✅ Branch updated:', result);
      }

      toast.success('Branch Updated', { 
        description: 'Branch information has been saved successfully.' 
      });
      
      setEditingBranch(null);
      setEditForm({});
      fetchAllBranches();
    } catch (error) {
      console.error('Error updating branch:', error);
      toast.error('Update Failed', { 
        description: error instanceof Error ? error.message : 'Could not save branch changes.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueBranches = branches.reduce((acc, branch) => {
    if (!acc.find(b => b.branchName === branch.branchName)) {
      acc.push(branch);
    }
    return acc;
  }, [] as BranchUser[]).sort((a, b) => {
    // Sort branches alphabetically by city/location name
    return a.branchName.localeCompare(b.branchName);
  });

  const getBranchStaff = (branchName: string) => {
    return branches.filter(b => b.branchName === branchName);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
          <User className="w-10 h-10 text-[#9867C5]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{isAdmin ? 'Branch Profile' : 'Profile Settings'}</h2>
          <p className="text-gray-600 font-medium">{isAdmin ? 'Manage your profile and branch information' : 'Manage your account information'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Picture Section */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="text-gray-800 text-lg">Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#9867C5] to-[#9867C5]/70 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-white" />
                  )}
                </div>
                <label
                  htmlFor="profile-upload"
                  className="absolute bottom-0 right-0 w-10 h-10 bg-[#9867C5] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#9867C5]/90 transition-colors shadow-lg"
                >
                  <Camera className="w-5 h-5 text-white" />
                  <input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-sm text-gray-500 text-center">Click the camera icon to upload a new picture</p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="border-none shadow-md md:col-span-2">
          <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
            <CardTitle className="text-gray-800 text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed"
                    placeholder="Enter your full name"
                    disabled={true}
                  />
                </div>
                <p className="text-xs text-gray-500 ml-1">Name cannot be changed</p>
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 ml-1">Email cannot be changed</p>
              </div>

              {/* Role (Read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 ml-1">Role</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userRole}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Branch (Read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 ml-1">Branch</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userBranch}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                disabled={isLoading}
                className="w-full py-3 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white font-semibold rounded-xl shadow-lg shadow-[#9867C5]/40 transition-all transform active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch Management Section (Admin Only) */}
      {isAdmin && branches.length > 0 && (
        <div className="space-y-6 mt-8">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Branch Staff Management</h3>
              <p className="text-gray-600 text-sm">Edit branch staff names, details, and contact information</p>
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
                  {/* Branch Contact Info */}
                  {(branch.branchContact) && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#9867C5]" />
                        Branch Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
                    {staff.map((member) => {
                      const isEditing = editingBranch === member.userId;
                      
                      return (
                        <div key={member.userId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          {isEditing ? (
                            // Edit Mode
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-2 block">Contact Number</label>
                                  <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      value={editForm.phone || ''}
                                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9867C5] outline-none"
                                      placeholder="Enter contact number"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2 justify-end pt-2 border-t">
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveBranch}
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
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9867C5] to-[#9867C5]/70 flex items-center justify-center overflow-hidden">
                                  {member.profilePicture ? (
                                    <img src={member.profilePicture} alt={member.userName} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-6 h-6 text-white" />
                                  )}
                                </div>
                                
                                <div>
                                  <p className="font-semibold text-gray-800">{member.userName}</p>
                                  <div className="flex flex-wrap items-center gap-3 mt-1">
                                    <div className="flex items-center gap-1 text-sm text-gray-600">
                                      <Mail className="w-3 h-3" />
                                      <span>{member.userEmail}</span>
                                    </div>
                                    {(member.phone || member.branchContact) && (
                                      <div className="flex items-center gap-1 text-sm text-gray-600">
                                        <Phone className="w-3 h-3" />
                                        <span>{member.phone || member.branchContact}</span>
                                      </div>
                                    )}
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

                              <button
                                onClick={() => handleEditBranch(member)}
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
        </div>
      )}
    </div>
  );
}