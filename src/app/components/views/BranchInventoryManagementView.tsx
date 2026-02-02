import { useState, useEffect } from "react";
import {
  Building,
  Package,
  Plus,
  Edit,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  Truck,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { InventoryBatch } from "@/app/types/inventory";
import {
  projectId,
  publicAnonKey,
} from "@/../utils/supabase/info";
import { toast } from "sonner";
import { generateExcelReportWithBranchInfo } from "@/app/utils/exportUtils";
import { supabase } from "@/app/utils/supabase";

interface BranchData {
  userId: string;
  userName: string;
  branchName: string;
  userRole: string;
  inventory: InventoryBatch[];
}

interface BranchInventoryManagementViewProps {
  userToken: string;
  userRole: string;
}

export function BranchInventoryManagementView({
  userToken,
  userRole,
}: BranchInventoryManagementViewProps) {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InventoryBatch>>({});
  const [isAddingNew, setIsAddingNew] = useState<{ [key: string]: boolean }>({});
  const [newBatchForm, setNewBatchForm] = useState<{ [key: string]: Omit<InventoryBatch, "id"> }>({});
  const [generatingReportForBranch, setGeneratingReportForBranch] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState(userToken);

  // Get fresh token
  const getFreshToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setCurrentToken(session.access_token);
        return session.access_token;
      }
      return null;
    } catch (error) {
      console.error("Error getting fresh token:", error);
      return null;
    }
  };

  const fetchAllBranches = async () => {
    try {
      setIsLoading(true);
      
      // Get fresh token
      const token = await getFreshToken();
      if (!token) {
        toast.error("Session Expired", {
          description: "Please refresh the page and sign in again.",
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/all-branches`,
        {
          headers: {
            "X-User-Token": token,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        
        if (response.status === 401) {
          toast.error("Session Expired", {
            description: "Please refresh the page and sign in again.",
          });
          setIsLoading(false);
          return;
        }
        
        if (response.status === 404) {
          toast.error("Endpoint Not Found", {
            description: "Branch management endpoint is not available.",
          });
          setIsLoading(false);
          return;
        }
        
        toast.error("Failed to Load Branches", {
          description: `Server error: ${response.status}`,
        });
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log("📦 Branch data received:", data);
      
      // Handle empty or null data
      if (!data || !Array.isArray(data)) {
        console.log("⚠️ No branch data or invalid format, setting empty array");
        setBranches([]);
        setIsLoading(false);
        return;
      }

      const branchData: BranchData[] = data.map(
        (item: any) => ({
          userId: item.userId,
          userName: item.userName || "Unknown User",
          branchName: item.branchName || "Unknown Branch",
          userRole: item.userRole || "User",
          inventory: item.value || [],
        }),
      ).sort((a, b) => {
        // Sort branches alphabetically by city/location name
        return a.branchName.localeCompare(b.branchName);
      });

      console.log("✅ Processed branch data:", branchData.length, "branches");
      setBranches(branchData);
    } catch (error) {
      console.error("❌ Error fetching branches:", error);
      toast.error("Failed to load branch data", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userToken) {
      fetchAllBranches();
    }
  }, [userToken]);

  const handleEditBatch = (batch: InventoryBatch) => {
    setEditingBatch(batch.id);
    setEditFormData(batch);
  };

  const handleSaveEdit = async (
    userId: string,
    branchName: string,
  ) => {
    try {
      const branch = branches.find((b) => b.userId === userId);
      if (!branch || !editingBatch) return;

      const token = await getFreshToken();
      if (!token) {
        toast.error("Session Expired");
        return;
      }

      const updatedInventory = branch.inventory.map((batch) =>
        batch.id === editingBatch
          ? { ...batch, ...editFormData }
          : batch,
      );

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/update-branch/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Token": token,
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ inventory: updatedInventory }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update batch");
      }

      toast.success("Batch Updated", {
        description: `Changes saved to ${branchName}`,
      });

      setEditingBatch(null);
      setEditFormData({});
      await fetchAllBranches();
    } catch (error) {
      console.error("Error updating batch:", error);
      toast.error("Update Failed");
    }
  };

  const handleAddNewBatch = async (
    userId: string,
    branchName: string,
  ) => {
    try {
      const branch = branches.find((b) => b.userId === userId);
      if (!branch) return;

      const formData = newBatchForm[userId];
      if (!formData) return;

      const token = await getFreshToken();
      if (!token) {
        toast.error("Session Expired");
        return;
      }

      const newBatch: InventoryBatch = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        quantityDispensed: 0,
      };

      const updatedInventory = [...branch.inventory, newBatch];

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/update-branch/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Token": token,
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ inventory: updatedInventory }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to add batch");
      }

      toast.success("Stock Delivered", {
        description: `New batch delivered to ${branchName}`,
      });

      setIsAddingNew({ ...isAddingNew, [userId]: false });
      setNewBatchForm({
        ...newBatchForm,
        [userId]: getEmptyForm(),
      });
      await fetchAllBranches();
    } catch (error) {
      console.error("Error adding batch:", error);
      toast.error("Delivery Failed");
    }
  };

  const handleGenerateReport = async (branchId: string, branchName: string) => {
    try {
      setGeneratingReportForBranch(branchId);
      
      const token = await getFreshToken();
      if (!token) {
        toast.error("Session Expired");
        setGeneratingReportForBranch(null);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/generate-report/${branchId}`,
        {
          method: "POST",
          headers: {
            "X-User-Token": token,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate report");
      }

      const reportData = await response.json();

      const excelBlob = await generateExcelReportWithBranchInfo(
        reportData.inventory,
        reportData.userMetadata.branch,
        reportData.userMetadata.name,
        branchId
      );

      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Physical_Inventory_${reportData.userMetadata.branch.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Report Generated", {
        description: `Physical inventory report for ${branchName} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Report Generation Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setGeneratingReportForBranch(null);
    }
  };

  const handleDeleteBranch = async (userId: string, branchName: string) => {
    // Only Administrators can delete entire user accounts
    if (userRole !== 'Administrator') {
      toast.error("Permission Denied", {
        description: "Only Administrators can delete user accounts.",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete this user account?\n\n${branchName}\n\nThis will permanently delete:\n• The user account\n• All inventory data\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error("Session Expired");
        return;
      }

      console.log(`🗑️ Attempting to delete user account: ${userId}`);

      // Delete the entire user account (Admin only endpoint)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/user/${userId}`,
        {
          method: "DELETE",
          headers: {
            "X-User-Token": token,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Delete user error response:', errorData);
        throw new Error(errorData.error || `Failed to delete user account (Status: ${response.status})`);
      }

      const result = await response.json();
      console.log('✅ User account deleted successfully:', result);

      toast.success("User Account Deleted", {
        description: `${branchName} and all associated data has been permanently removed.`,
      });

      await fetchAllBranches();
    } catch (error) {
      console.error("Error deleting user account:", error);
      toast.error("Delete Failed", {
        description: error instanceof Error ? error.message : "Could not delete user account. Please try again.",
      });
    }
  };

  const handleClearUnknownBranches = async () => {
    const unknownBranches = branches.filter(
      (b) => b.branchName === "Unknown Branch" || b.userName === "Unknown User"
    );

    if (unknownBranches.length === 0) {
      toast.info("No Unknown Branches", {
        description: "There are no unknown branches to clear.",
      });
      return;
    }

    if (
      !confirm(
        `This will delete ${unknownBranches.length} unknown branch${unknownBranches.length > 1 ? "es" : ""}.\n\nThis action cannot be undone. Continue?`
      )
    ) {
      return;
    }

    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error("Session Expired");
        return;
      }

      let deletedCount = 0;
      let failedCount = 0;
      
      console.log(`🗑️ Clearing ${unknownBranches.length} unknown branches...`);
      
      for (const branch of unknownBranches) {
        try {
          // Delete only the inventory data (not the user account) for unknown branches
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/inventory/delete-branch/${branch.userId}`,
            {
              method: "DELETE",
              headers: {
                "X-User-Token": token,
                Authorization: `Bearer ${publicAnonKey}`,
              },
            },
          );

          if (response.ok) {
            deletedCount++;
            console.log(`✅ Deleted inventory for unknown branch: ${branch.userId}`);
          } else {
            failedCount++;
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error(`❌ Failed to delete ${branch.userId}:`, errorData);
          }
        } catch (err) {
          failedCount++;
          console.error(`❌ Error deleting ${branch.userId}:`, err);
        }
      }

      if (deletedCount > 0) {
        toast.success("Unknown Branches Cleared", {
          description: `Successfully deleted ${deletedCount} unknown branch${deletedCount > 1 ? "es" : ""}${failedCount > 0 ? `. ${failedCount} failed.` : '.'}`,
        });
      } else {
        toast.error("Clear Failed", {
          description: "Could not delete any unknown branches.",
        });
      }

      await fetchAllBranches();
    } catch (error) {
      console.error("Error clearing unknown branches:", error);
      toast.error("Clear Failed", {
        description: error instanceof Error ? error.message : "Could not clear all unknown branches.",
      });
    }
  };

  const getEmptyForm = (): Omit<InventoryBatch, "id"> => ({
    drugName: "",
    program: "",
    dosage: "",
    unit: "vial",
    batchNumber: "",
    beginningInventory: 0,
    quantityReceived: 0,
    dateReceived: new Date().toISOString().split("T")[0],
    unitCost: 0,
    quantityDispensed: 0,
    expirationDate: "",
    remarks: "",
  });

  const getTotalStats = () => {
    let totalItems = 0;
    let totalLowStock = 0;
    let totalExpired = 0;
    let totalNearExpiry = 0;

    branches.forEach((branch) => {
      totalItems += branch.inventory.length;
      branch.inventory.forEach((item) => {
        const stockOnHand = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
        const expiryDate = new Date(item.expirationDate);
        const today = new Date();
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (stockOnHand < 50) totalLowStock++;
        if (daysUntilExpiry < 0) totalExpired++;
        else if (daysUntilExpiry < 180) totalNearExpiry++;
      });
    });

    return {
      totalBranches: branches.length,
      totalItems,
      totalLowStock,
      totalExpired,
      totalNearExpiry,
    };
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#9867C5]/20 border-t-[#9867C5] rounded-full animate-spin" />
      </div>
    );
  }

  const stats = getTotalStats();

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

  // Health Officer View - Simple Overview Only
  if (userRole === "Health Officer") {
    return (
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
              <Building className="w-10 h-10 text-[#9867C5]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Branch Monitoring</h2>
              <p className="text-gray-600 font-medium">Multi-Branch Inventory Overview</p>
            </div>
          </div>
          <button
            onClick={fetchAllBranches}
            className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                👥 Branch Management System
              </p>
              <p className="text-sm text-blue-700 mt-1">
                This dashboard displays all <strong>Pharmacy Staff</strong> branch accounts and their inventory. 
                Administrator and Health Officer accounts do not appear here as they are managers, not branch operators.
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-none shadow-md bg-gradient-to-br from-[#9867C5] to-[#9867C5]/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Total Branches</p>
                  <p className="text-3xl font-bold text-white mt-1">{stats.totalBranches}</p>
                </div>
                <Building className="w-10 h-10 text-white/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Items</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalItems}</p>
                </div>
                <Package className="w-10 h-10 text-blue-500/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Low Stock</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.totalLowStock}</p>
                </div>
                <TrendingDown className="w-10 h-10 text-yellow-500/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Near Expiry</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">{stats.totalNearExpiry}</p>
                </div>
                <Calendar className="w-10 h-10 text-orange-500/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Expired</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{stats.totalExpired}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-500/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Cards - Grouped by Location */}
        <div className="space-y-6">
          {uniqueLocations.map(([locationName, locationBranches]) => {
            // Calculate aggregate stats for this location
            let locationTotalItems = 0;
            let locationTotalStock = 0;
            let locationLowStock = 0;
            let locationExpired = 0;
            let locationNearExpiry = 0;

            locationBranches.forEach((branch) => {
              locationTotalItems += branch.inventory.length;
              branch.inventory.forEach((item) => {
                const stockOnHand = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
                const expiryDate = new Date(item.expirationDate);
                const today = new Date();
                const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                locationTotalStock += stockOnHand;
                if (stockOnHand >= 1 && stockOnHand < 50) locationLowStock++;
                if (daysUntilExpiry < 0) locationExpired++;
                else if (daysUntilExpiry < 180) locationNearExpiry++;
              });
            });

            return (
              <Card key={locationName} className="border-none shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-gray-800">
                      <Building className="w-6 h-6 text-[#9867C5]" />
                      {locationName}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{locationBranches.length} Staff Account{locationBranches.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Location Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Total Items</p>
                      <p className="text-lg font-bold text-blue-600">{locationTotalItems}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Total Stock</p>
                      <p className="text-lg font-bold text-[#9867C5]">{locationTotalStock}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Low Stock</p>
                      <p className="text-lg font-bold text-yellow-600">{locationLowStock}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Near Expiry</p>
                      <p className="text-lg font-bold text-orange-600">{locationNearExpiry}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Expired</p>
                      <p className="text-lg font-bold text-red-600">{locationExpired}</p>
                    </div>
                  </div>

                  {/* Individual Branch Accounts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {locationBranches.map((branch) => {
            let lowStockCount = 0;
            let expiredCount = 0;
            let nearExpiryCount = 0;
            let totalStock = 0;

            branch.inventory.forEach((item) => {
              const stockOnHand = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
              const expiryDate = new Date(item.expirationDate);
              const today = new Date();
              const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              totalStock += stockOnHand;
              if (stockOnHand < 50) lowStockCount++;
              if (daysUntilExpiry < 0) expiredCount++;
              else if (daysUntilExpiry < 180) nearExpiryCount++;
            });

            return (
              <Card key={branch.userId} className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
                  <CardTitle className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-[#9867C5]" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-800">{branch.userName}</div>
                      <div className="text-xs text-gray-500">{branch.branchName}</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-700">Total Items</span>
                      </div>
                      <span className="font-bold text-blue-600">{branch.inventory.length}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-[#9867C5]/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#9867C5]" />
                        <span className="text-sm text-gray-700">Total Stock</span>
                      </div>
                      <span className="font-bold text-[#9867C5]">{totalStock}</span>
                    </div>

                    {lowStockCount > 0 && (
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-orange-600" />
                          <span className="text-sm text-gray-700">Low Stock</span>
                        </div>
                        <span className="font-bold text-orange-600">{lowStockCount}</span>
                      </div>
                    )}

                    {nearExpiryCount > 0 && (
                      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm text-gray-700">Near Expiry</span>
                        </div>
                        <span className="font-bold text-yellow-600">{nearExpiryCount}</span>
                      </div>
                    )}

                    {expiredCount > 0 && (
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-gray-700">Expired</span>
                        </div>
                        <span className="font-bold text-red-600">{expiredCount}</span>
                      </div>
                    )}

                    <div className="pt-3 border-t">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {branch.userRole}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Administrator View - Full Management with Summary Stats
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#9867C5]/10 rounded-2xl flex items-center justify-center">
            <Building className="w-10 h-10 text-[#9867C5]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Branch Management</h2>
            <p className="text-gray-600 font-medium">Multi-Branch Inventory Control & Stock Delivery</p>
          </div>
        </div>
        <div className="flex gap-2">
          {branches.some(b => b.branchName === "Unknown Branch" || b.userName === "Unknown User") && (
            <button
              onClick={handleClearUnknownBranches}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-md"
            >
              <Trash2 className="w-4 h-4" />
              Clear Unknown Branches
            </button>
          )}
          <button
            onClick={fetchAllBranches}
            className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-[#9867C5] to-[#9867C5]/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Total Branches</p>
                <p className="text-3xl font-bold text-white mt-1">{stats.totalBranches}</p>
              </div>
              <Building className="w-10 h-10 text-white/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Items</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalItems}</p>
              </div>
              <Package className="w-10 h-10 text-blue-500/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Low Stock</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.totalLowStock}</p>
              </div>
              <TrendingDown className="w-10 h-10 text-yellow-500/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Near Expiry</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">{stats.totalNearExpiry}</p>
              </div>
              <Calendar className="w-10 h-10 text-orange-500/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Expired</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.totalExpired}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch List with CRUD - Grouped by Location */}
      <div className="space-y-6">
        {uniqueLocations.map(([locationName, locationBranches]) => (
          <Card key={locationName} className="border-none shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5">
              <CardTitle className="flex items-center gap-3 text-gray-800">
                <Building className="w-6 h-6 text-[#9867C5]" />
                {locationName}
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({locationBranches.length} Staff Account{locationBranches.length !== 1 ? 's' : ''})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {locationBranches.map((branch) => {
          const isExpanded = expandedBranch === branch.userId;
          const isAdding = isAddingNew[branch.userId];

          let lowStockCount = 0;
          let expiredCount = 0;
          let nearExpiryCount = 0;

          branch.inventory.forEach((item) => {
            const stockOnHand = item.beginningInventory + item.quantityReceived - item.quantityDispensed;
            const expiryDate = new Date(item.expirationDate);
            const today = new Date();
            const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (stockOnHand < 50) lowStockCount++;
            if (daysUntilExpiry < 0) expiredCount++;
            else if (daysUntilExpiry < 180) nearExpiryCount++;
          });

          return (
            <Card
              key={branch.userId}
              className="border-none shadow-md"
            >
              <CardHeader
                className="border-b bg-gradient-to-r from-[#9867C5]/10 to-[#9867C5]/5 cursor-pointer"
                onClick={() =>
                  setExpandedBranch(
                    isExpanded ? null : branch.userId,
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-gray-800">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-[#9867C5]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[#9867C5]" />
                    )}
                    <Building className="w-5 h-5 text-[#9867C5]" />
                    {branch.userName} - {branch.branchName}
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center px-3 py-1 bg-white rounded border border-gray-200">
                        <p className="text-xs text-gray-500">Items</p>
                        <p className="text-sm font-bold text-gray-800">{branch.inventory.length}</p>
                      </div>
                      {lowStockCount > 0 && (
                        <div className="text-center px-3 py-1 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-xs text-gray-600">Low</p>
                          <p className="text-sm font-bold text-yellow-600">{lowStockCount}</p>
                        </div>
                      )}
                      {nearExpiryCount > 0 && (
                        <div className="text-center px-3 py-1 bg-orange-50 rounded border border-orange-200">
                          <p className="text-xs text-gray-600">Expiring</p>
                          <p className="text-sm font-bold text-orange-600">{nearExpiryCount}</p>
                        </div>
                      )}
                      {expiredCount > 0 && (
                        <div className="text-center px-3 py-1 bg-red-50 rounded border border-red-200">
                          <p className="text-xs text-gray-600">Expired</p>
                          <p className="text-sm font-bold text-red-600">{expiredCount}</p>
                        </div>
                      )}
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {branch.userRole}
                    </span>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-6">
                  <div className="mb-4 flex justify-between">
                    <button
                      onClick={() => handleGenerateReport(branch.userId, `${branch.userName} - ${branch.branchName}`)}
                      disabled={generatingReportForBranch === branch.userId}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {generatingReportForBranch === branch.userId ? "Generating..." : "Generate Report"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsAddingNew({
                            ...isAddingNew,
                            [branch.userId]: true,
                          });
                          if (!newBatchForm[branch.userId]) {
                            setNewBatchForm({
                              ...newBatchForm,
                              [branch.userId]: getEmptyForm(),
                            });
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-[#9867C5] hover:bg-[#9867C5]/90 text-white rounded-lg transition-colors"
                      >
                        <Truck className="w-4 h-4" />
                        Deliver Stock
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(branch.userId, branch.branchName)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Branch
                      </button>
                    </div>
                  </div>

                  {/* Add New Batch Form */}
                  {isAdding && (
                    <Card className="mb-4 border-2 border-[#9867C5]/30">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <Label>Drug Name</Label>
                            <Input
                              value={
                                newBatchForm[branch.userId]
                                  ?.drugName || ""
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    drugName: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Program</Label>
                            <select
                              value={
                                newBatchForm[branch.userId]
                                  ?.program || ""
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    program: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="">
                                Select Program
                              </option>
                              <option value="EREID">
                                EREID
                              </option>
                              <option value="NIP">NIP</option>
                              <option value="DOH">DOH</option>
                              <option value="LGU">LGU</option>
                              <option value="Donation">
                                Donation
                              </option>
                            </select>
                          </div>
                          <div>
                            <Label>Dosage</Label>
                            <Input
                              value={
                                newBatchForm[branch.userId]
                                  ?.dosage || ""
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    dosage: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Batch Number</Label>
                            <Input
                              value={
                                newBatchForm[branch.userId]
                                  ?.batchNumber || ""
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    batchNumber: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Beginning Inventory</Label>
                            <Input
                              type="number"
                              value={
                                newBatchForm[branch.userId]
                                  ?.beginningInventory || 0
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    beginningInventory:
                                      parseInt(
                                        e.target.value,
                                      ) || 0,
                                  },
                                })
                              }
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                          <div>
                            <Label>Quantity Received</Label>
                            <Input
                              type="number"
                              value={
                                newBatchForm[branch.userId]
                                  ?.quantityReceived || 0
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    quantityReceived:
                                      parseInt(
                                        e.target.value,
                                      ) || 0,
                                  },
                                })
                              }
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                          <div>
                            <Label>Unit Cost</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={
                                newBatchForm[branch.userId]
                                  ?.unitCost || 0
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    unitCost:
                                      parseFloat(
                                        e.target.value,
                                      ) || 0,
                                  },
                                })
                              }
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                          <div>
                            <Label>Expiration Date</Label>
                            <Input
                              type="date"
                              value={
                                newBatchForm[branch.userId]
                                  ?.expirationDate || ""
                              }
                              onChange={(e) =>
                                setNewBatchForm({
                                  ...newBatchForm,
                                  [branch.userId]: {
                                    ...newBatchForm[
                                      branch.userId
                                    ],
                                    expirationDate:
                                      e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              setIsAddingNew({
                                ...isAddingNew,
                                [branch.userId]: false,
                              })
                            }
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              handleAddNewBatch(
                                branch.userId,
                                branch.branchName,
                              )
                            }
                            className="px-4 py-2 bg-[#9867C5] text-white rounded-lg hover:bg-[#9867C5]/90"
                          >
                            <Truck className="w-4 h-4 inline mr-2" />
                            Deliver to Branch
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Inventory Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Drug Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Program
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Batch #
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Beginning
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Received
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Dispensed
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Stock
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Expiry
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-gray-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {branch.inventory.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-4 py-8 text-center text-gray-500"
                            >
                              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              No inventory items
                            </td>
                          </tr>
                        ) : (
                          branch.inventory.map((batch) => {
                            const isEditing =
                              editingBatch === batch.id;
                            const stock =
                              batch.beginningInventory +
                              batch.quantityReceived -
                              batch.quantityDispensed;

                            if (isEditing) {
                              return (
                                <tr
                                  key={batch.id}
                                  className="border-t border-gray-200 bg-blue-50"
                                >
                                  <td className="px-4 py-3">
                                    <Input
                                      value={
                                        editFormData.drugName ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          drugName:
                                            e.target.value,
                                        })
                                      }
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      value={
                                        editFormData.program ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          program:
                                            e.target.value,
                                        })
                                      }
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      value={
                                        editFormData.batchNumber ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          batchNumber:
                                            e.target.value,
                                        })
                                      }
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      type="number"
                                      value={
                                        editFormData.beginningInventory ||
                                        0
                                      }
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          beginningInventory:
                                            parseInt(
                                              e.target.value,
                                            ) || 0,
                                        })
                                      }
                                      className="h-8 w-20"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      type="number"
                                      value={
                                        editFormData.quantityReceived ||
                                        0
                                      }
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          quantityReceived:
                                            parseInt(
                                              e.target.value,
                                            ) || 0,
                                        })
                                      }
                                      className="h-8 w-20"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      type="number"
                                      value={
                                        editFormData.quantityDispensed ||
                                        0
                                      }
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          quantityDispensed:
                                            parseInt(
                                              e.target.value,
                                            ) || 0,
                                        })
                                      }
                                      className="h-8 w-20"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {(editFormData.beginningInventory || 0) + (editFormData.quantityReceived || 0) - (editFormData.quantityDispensed || 0)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      type="date"
                                      value={
                                        editFormData.expirationDate ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          expirationDate:
                                            e.target.value,
                                        })
                                      }
                                      className="h-8"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() =>
                                          handleSaveEdit(
                                            branch.userId,
                                            branch.branchName,
                                          )
                                        }
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                      >
                                        <Save className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingBatch(null);
                                          setEditFormData({});
                                        }}
                                        className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr
                                key={batch.id}
                                className="border-t border-gray-200 hover:bg-gray-50"
                              >
                                <td className="px-4 py-3 text-sm text-gray-800">
                                  {batch.drugName}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                    {batch.program}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-800">
                                  {batch.batchNumber}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-800">
                                  {batch.beginningInventory}
                                </td>
                                <td className="px-4 py-3 text-sm text-[#9867C5]">
                                  +{batch.quantityReceived}
                                </td>
                                <td className="px-4 py-3 text-sm text-blue-600">
                                  -{batch.quantityDispensed}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                                  {stock}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-800">
                                  {batch.expirationDate}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        handleEditBatch(batch)
                                      }
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      title="Edit"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}