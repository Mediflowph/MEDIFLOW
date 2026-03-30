import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { logger } from "npm:hono@4/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// SQL Database helper functions
const getSupabaseClient = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-c88a69d7/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/make-server-c88a69d7/init-admin-accounts", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const adminAccounts = [
      {
        email: 'mediflowa@gmail.com',
        password: 'MediflowADMIN01',
        name: 'Mediflow ADMIN',
        role: 'Administrator',
        branch: 'Main Control'
      },
      {
        email: 'mediflowho@gmail.com',
        password: 'MediflowHO01!',
        name: 'Mediflow HO',
        role: 'Health Officer',
        branch: 'Main Control'
      }
    ];

    const results = [];
    for (const account of adminAccounts) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const userExists = existingUsers?.users.some(u => u.email === account.email);

      if (userExists) {
        results.push({ email: account.email, status: 'already_exists' });
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        user_metadata: { 
          name: account.name, 
          role: account.role, 
          branch: account.branch,
          profilePicture: null,
          approved: true
        },
        email_confirm: true
      });

      if (error) {
        results.push({ email: account.email, status: 'error', error: error.message });
      } else {
        results.push({ email: account.email, status: 'created', userId: data.user.id });
      }
    }

    return c.json({ 
      success: true, 
      message: 'Admin account initialization complete',
      results 
    });
  } catch (err) {
    console.error("Init admin accounts error:", err);
    return c.json({ error: "Failed to initialize admin accounts" }, 500);
  }
});

app.post("/make-server-c88a69d7/signup", async (c) => {
  try {
    const { email, password, name, role, branch } = await c.req.json();

    if (!email || !password || !name || !role || !branch) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const requiresApproval = role === 'Pharmacy Staff';
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        name, 
        role, 
        branch,
        profilePicture: null,
        approved: requiresApproval ? false : true
      },
      email_confirm: true
    });

    if (error) {
      console.error("Signup error:", error);
      return c.json({ error: error.message }, 400);
    }

    // Insert user into SQL users table (without branch_id initially)
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        branch_id: null,  // Will be set when user logs in with a branch
        name: name,
        role: role,
        approved: !requiresApproval
      });
    
    if (insertError) {
      console.error('❌ Error inserting user into users table:', insertError);
      // Don't fail the signup, just log the error
    } else {
      console.log(`�� User inserted into users table: ${email}`);
    }

    console.log(`✅ Created user: ${email} (${role}) - Approved: ${!requiresApproval}`);
    return c.json({ 
      success: true, 
      message: requiresApproval 
        ? 'Account created successfully. Please wait for admin approval before signing in.' 
        : 'Account created successfully',
      userId: data.user.id,
      requiresApproval
    });
  } catch (err) {
    console.error("Signup error:", err);
    return c.json({ error: "Failed to create account" }, 500);
  }
});

const checkAuth = async (c: any) => {
  const userToken = c.req.header('X-User-Token');
  console.log('🔐 User token received:', userToken ? `${userToken.substring(0, 27)}...` : 'NO TOKEN');
  
  if (!userToken) {
    console.log('❌ No user token found in X-User-Token header');
    return { error: 'Auth session missing!' };
  }
  
  console.log('🔑 Verifying user token...');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(userToken);
  
  if (error) {
    console.error('❌ Token verification error:', error.message);
    return { error: `Token verification error: ${error.message}` };
  }
  
  if (!user) {
    console.error('❌ No user found for token');
    return { error: 'Auth session missing!' };
  }
  
  console.log('✅ User authenticated:', user.id);
  return { user };
};

app.get("/make-server-c88a69d7/inventory", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      console.log('❌ Unauthorized inventory fetch attempt');
      return c.json({ error: authResult.error }, 401);
    }

    const supabase = getSupabaseClient();
    
    // Get user's branch assignment from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', authResult.user.id)
      .single();
    
    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return c.json({ error: 'User data not found' }, 404);
    }
    
    if (!userData?.branch_id) {
      console.log('⚠️ User has no branch assigned');
      return c.json([]);
    }

    console.log(`📥 Fetching inventory for user: ${authResult.user.id}, branch: ${userData.branch_id}`);
    
    // Get inventory for user's branch
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', userData.branch_id)
      .order('created_at', { ascending: false });
    
    if (inventoryError) {
      console.error('❌ Error fetching inventory:', inventoryError);
      return c.json({ error: 'Failed to fetch inventory' }, 500);
    }

    console.log(`✅ Retrieved ${inventory?.length || 0} inventory item(s)`);
    return c.json(inventory || []);
  } catch (err) {
    console.error("❌ Fetch inventory error:", err);
    return c.json({ error: "Failed to fetch inventory" }, 500);
  }
});

// Get ALL branch inventories (for Stock Locator and Branch Management)
// IMPORTANT: This must be defined BEFORE /inventory/:branchId to avoid route conflict
app.get("/make-server-c88a69d7/inventory/all-branches", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator' && userRole !== 'Health Officer' && userRole !== 'Pharmacy Staff') {
      return c.json({ error: 'Unauthorized: Admin, Health Officer, or Pharmacy Staff access required' }, 403);
    }

    const supabase = getSupabaseClient();
    
    console.log('🔍 Fetching all branches for stock locator / branch management...');
    
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name, location, contact_person, contact_phone, contact_email')
      .order('name', { ascending: true });
    
    if (branchError) {
      console.error('❌ Error fetching branches:', branchError);
      return c.json({ error: 'Failed to fetch branches' }, 500);
    }

    console.log(`📦 Found ${branches?.length || 0} branches in database`);
    
    if (!branches || branches.length === 0) {
      console.log('⚠️ No branches found in database');
      return c.json([]);
    }
    
    // Get user metadata from Supabase Auth for contact info
    const { data: authUsersData } = await supabase.auth.admin.listUsers();
    const authUserMap = new Map();
    authUsersData?.users.forEach((user: any) => {
      authUserMap.set(user.id, {
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown',
        phone: user.user_metadata?.branchContact || ''
      });
    });

    // Fetch users to get contact information per branch
    const { data: users } = await supabase
      .from('users')
      .select('id, name, role, branch_id')
      .not('branch_id', 'is', null);
    
    const result = [];
    
    for (const branch of branches) {
      // Fetch ALL inventory items for the branch (including 0 qty for management view)
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', branch.id)
        .order('drug_name', { ascending: true });
      
      if (invError) {
        console.error(`❌ Error fetching inventory for branch ${branch.id}:`, invError);
        continue;
      }

      const branchUser = users?.find((u: any) => u.branch_id === branch.id);
      const authUserInfo = branchUser ? authUserMap.get(branchUser.id) : null;
      
      result.push({
        userId: branchUser?.id || branch.id,
        userName: branch.contact_person || authUserInfo?.name || 'Branch Contact',
        branchName: branch.name,
        userRole: branchUser?.role || 'Branch',
        userEmail: branch.contact_email || authUserInfo?.email || '',
        userPhone: branch.contact_phone || authUserInfo?.phone || '',
        inventory: inventory || []
      });
      
      console.log(`📊 Branch "${branch.name}": ${inventory?.length || 0} items`);
    }
    
    console.log(`✅ Retrieved ${result.length} branch inventories from SQL`);
    return c.json(result);
  } catch (err) {
    console.error("❌ Fetch all inventories error:", err);
    return c.json({ error: "Failed to fetch branch inventories" }, 500);
  }
});

// Get inventory by specific branch ID (for admins and when branch is selected)
app.get("/make-server-c88a69d7/inventory/:branchId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      console.log('❌ Unauthorized inventory fetch attempt');
      return c.json({ error: authResult.error }, 401);
    }

    const branchId = c.req.param('branchId');
    if (!branchId) {
      return c.json({ error: 'Branch ID required' }, 400);
    }

    // Handle admin/health officer "all" branch - return empty array
    if (branchId === 'all' || branchId === 'all-branches') {
      console.log(`ℹ️ Admin/Health Officer account requesting inventory with branch: ${branchId} - returning empty array`);
      return c.json([]);
    }

    console.log(`📥 Fetching inventory for branch: ${branchId}`);
    
    const supabase = getSupabaseClient();
    
    // Get inventory for specified branch
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    
    if (inventoryError) {
      console.error('❌ Error fetching inventory:', inventoryError);
      return c.json({ error: 'Failed to fetch inventory' }, 500);
    }

    console.log(`✅ Retrieved ${inventory?.length || 0} inventory item(s) for branch ${branchId}`);
    return c.json(inventory || []);
  } catch (err) {
    console.error("❌ Fetch inventory error:", err);
    return c.json({ error: "Failed to fetch inventory" }, 500);
  }
});

app.post("/make-server-c88a69d7/inventory", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      console.log('❌ Unauthorized inventory save attempt');
      return c.json({ error: authResult.error }, 401);
    }

    const { inventory } = await c.req.json();
    
    if (!Array.isArray(inventory)) {
      return c.json({ error: 'Invalid inventory format' }, 400);
    }

    const supabase = getSupabaseClient();
    
    // Get user's branch
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', authResult.user.id)
      .single();
    
    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return c.json({ error: 'Failed to fetch user data' }, 500);
    }
    
    if (!userData?.branch_id) {
      return c.json({ error: 'User has no branch assigned' }, 400);
    }

    console.log(`💾 Saving inventory for user: ${authResult.user.id}, branch: ${userData.branch_id}`);
    console.log(`📦 Inventory items: ${inventory.length}`);
    
    // Delete existing inventory for this branch
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('branch_id', userData.branch_id);
    
    if (deleteError) {
      console.error('❌ Error deleting old inventory:', deleteError);
      return c.json({ error: 'Failed to update inventory' }, 500);
    }
    
    // Insert new inventory items
    if (inventory.length > 0) {
      const inventoryRecords = inventory.map((item: any) => ({
        branch_id: userData.branch_id,
        drug_name: item.drugName || item.drug_name || 'Unknown',
        generic_name: item.genericName || item.generic_name || null,
        dosage: item.dosage || null,
        quantity: item.quantity !== undefined ? item.quantity 
          : (item.beginningInventory !== undefined ? (item.beginningInventory + (item.quantityReceived || 0) - (item.quantityDispensed || 0)) : 0),
        expiry_date: item.expirationDate || item.expiry_date || item.expiryDate || null,
        batch_number: item.batchNumber || item.batch_number || null,
        supplier: item.supplier || null,
        unit_price: item.unitCost || item.unit_price || item.unitPrice || null,
        program: item.program || null,
        unit: item.unit || null,
        remarks: item.remarks || null
      }));
      
      const { error: insertError } = await supabase
        .from('inventory')
        .insert(inventoryRecords);
      
      if (insertError) {
        console.error('❌ Error inserting inventory:', insertError);
        return c.json({ error: 'Failed to save inventory' }, 500);
      }
    }
    
    console.log(`✅ Successfully saved ${inventory.length} items to inventory table`);
    return c.json({ success: true, itemCount: inventory.length });
  } catch (err) {
    console.error("❌ Save inventory error:", err);
    return c.json({ error: "Failed to save inventory" }, 500);
  }
});

app.put("/make-server-c88a69d7/inventory/update-branch/:userId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator' && userRole !== 'Health Officer') {
      return c.json({ error: 'Unauthorized: Admin or Health Officer access required' }, 403);
    }

    const targetUserId = c.req.param('userId');
    const { inventory } = await c.req.json();
    
    if (!Array.isArray(inventory)) {
      return c.json({ error: 'Invalid inventory format' }, 400);
    }

    console.log(`💾 Admin/HO updating inventory for user: ${targetUserId}`);
    console.log(`📦 Inventory items: ${inventory.length}`);
    
    const supabase = getSupabaseClient();
    
    // Get user's branch from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', targetUserId)
      .single();
    
    if (userError || !userData?.branch_id) {
      return c.json({ error: 'User branch not found' }, 404);
    }
    
    // Delete existing inventory for this branch
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('branch_id', userData.branch_id);
    
    if (deleteError) {
      console.error('❌ Error deleting old inventory:', deleteError);
      return c.json({ error: 'Failed to update inventory' }, 500);
    }
    
    // Insert new inventory items
    if (inventory.length > 0) {
      const inventoryRecords = inventory.map((item: any) => ({
        branch_id: userData.branch_id,
        drug_name: item.drugName || item.drug_name || 'Unknown',
        generic_name: item.genericName || item.generic_name || null,
        dosage: item.dosage || null,
        // Handle both InventoryBatch format (beginningInventory) and SQL format (quantity)
        quantity: item.quantity !== undefined ? item.quantity 
          : (item.beginningInventory !== undefined ? (item.beginningInventory + (item.quantityReceived || 0) - (item.quantityDispensed || 0)) : 0),
        // Handle both expirationDate and expiry_date formats
        expiry_date: item.expirationDate || item.expiry_date || item.expiryDate || null,
        batch_number: item.batchNumber || item.batch_number || null,
        supplier: item.supplier || null,
        // Handle both unitCost and unit_price formats
        unit_price: item.unitCost || item.unit_price || item.unitPrice || null,
        program: item.program || null,
        unit: item.unit || null,
        remarks: item.remarks || null
      }));
      
      const { error: insertError } = await supabase
        .from('inventory')
        .insert(inventoryRecords);
      
      if (insertError) {
        console.error('❌ Error inserting inventory:', insertError);
        return c.json({ error: 'Failed to save inventory' }, 500);
      }
    }
    
    console.log(`✅ Successfully updated inventory for user ${targetUserId}`);
    
    return c.json({ success: true, itemCount: inventory.length });
  } catch (err) {
    console.error("❌ Update branch inventory error:", err);
    return c.json({ error: "Failed to update branch inventory" }, 500);
  }
});

app.get("/make-server-c88a69d7/system-drugs", async (c) => {
  try {
    // System drugs feature deprecated - KV store removed
    console.log('⚠️ System drugs feature is deprecated (KV store removed)');
    return c.json([]);
  } catch (err) {
    console.error("❌ Fetch system drugs error:", err);
    return c.json({ error: "Failed to fetch system drugs" }, 500);
  }
});

app.post("/make-server-c88a69d7/system-drugs", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    // System drugs feature deprecated - KV store removed
    console.log('⚠️ System drugs feature is deprecated (KV store removed)');
    return c.json({ success: true, message: 'Feature deprecated' });
    
    console.log(`✅ Added system drug: ${drug.drugName}`);
    return c.json({ success: true });
  } catch (err) {
    console.error("❌ Add system drug error:", err);
    return c.json({ error: "Failed to add system drug" }, 500);
  }
});

app.post("/make-server-c88a69d7/update-profile", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const { name, profilePicture, userId, branch, branchContact } = await c.req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Determine which user to update
    const targetUserId = userId || authResult.user.id;
    
    // If updating another user, ensure the requester is an admin
    if (targetUserId !== authResult.user.id) {
      const userRole = authResult.user.user_metadata?.role;
      if (userRole !== 'Administrator') {
        return c.json({ error: 'Unauthorized: Administrator access required to update other users' }, 403);
      }
    }

    // Get current user metadata
    const { data: targetUser } = await supabase.auth.admin.getUserById(targetUserId);
    const currentMetadata = targetUser?.user?.user_metadata || {};
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      targetUserId,
      {
        user_metadata: {
          ...currentMetadata,
          name: name !== undefined ? name : currentMetadata.name,
          profilePicture: profilePicture !== undefined ? profilePicture : currentMetadata.profilePicture,
          branch: branch !== undefined ? branch : currentMetadata.branch,
          branchContact: branchContact !== undefined ? branchContact : currentMetadata.branchContact
        }
      }
    );

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    console.log(`✅ Updated profile for user: ${targetUserId}`);
    return c.json({ success: true, user: data.user });
  } catch (err) {
    console.error("❌ Update profile error:", err);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

app.delete("/make-server-c88a69d7/user/:userId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const userIdToDelete = c.req.param('userId');
    
    if (userIdToDelete === authResult.user.id) {
      return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Delete user's inventory by branch
    const { data: userData } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', userIdToDelete)
      .single();

    if (userData?.branch_id) {
      const { error: invError } = await supabase
        .from('inventory')
        .delete()
        .eq('branch_id', userData.branch_id);
      
      if (invError) {
        console.warn(`⚠️ Could not delete inventory for branch ${userData.branch_id}:`, invError);
      } else {
        console.log(`🗑️ Deleted inventory for branch: ${userData.branch_id}`);
      }
    }

    // Delete user from users table
    const { error: userTableError } = await supabase
      .from('users')
      .delete()
      .eq('id', userIdToDelete);

    if (userTableError) {
      console.warn(`⚠️ Could not delete user from users table:`, userTableError);
    }

    // Delete from auth
    const { error } = await supabase.auth.admin.deleteUser(userIdToDelete);
    
    if (error) {
      console.error('❌ Error deleting user:', error);
      return c.json({ error: error.message }, 400);
    }

    console.log(`✅ Deleted user account: ${userIdToDelete}`);
    return c.json({ success: true, message: 'User and inventory deleted successfully' });
  } catch (err) {
    console.error("❌ Delete user error:", err);
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

app.delete("/make-server-c88a69d7/inventory/delete-branch/:userId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator' && userRole !== 'Health Officer') {
      return c.json({ error: 'Unauthorized: Admin or Health Officer access required' }, 403);
    }

    const userIdToDelete = c.req.param('userId');
    
    console.log(`🗑️ Attempting to delete branch inventory for user: ${userIdToDelete}`);
    
    const supabase = getSupabaseClient();

    // Get user's branch
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', userIdToDelete)
      .single();

    if (userError || !userData?.branch_id) {
      console.log(`⚠️ No branch assigned to user: ${userIdToDelete}`);
      return c.json({ 
        success: true, 
        message: 'No branch assigned to user',
        wasDeleted: false 
      });
    }

    // Delete inventory for this branch
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('branch_id', userData.branch_id);

    if (deleteError) {
      console.error('❌ Error deleting inventory:', deleteError);
      return c.json({ error: 'Failed to delete inventory' }, 500);
    }

    console.log(`✅ Deleted inventory for branch: ${userData.branch_id}`);
    return c.json({ 
      success: true, 
      message: 'Branch inventory deleted successfully',
      wasDeleted: true 
    });
  } catch (err) {
    console.error("❌ Delete branch inventory error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to delete branch inventory";
    return c.json({ error: errorMessage }, 500);
  }
});

app.post("/make-server-c88a69d7/cleanup-orphaned-inventories", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existingUserIds = new Set(usersData?.users.map(u => u.id) || []);

    // Get all users from users table
    const { data: usersTableData, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      console.error('❌ Database error:', usersError);
      return c.json({ error: 'Failed to fetch users table' }, 500);
    }

    // Find orphaned users (exist in users table but not in auth)
    const orphanedUserIds: string[] = [];
    for (const user of usersTableData || []) {
      if (!existingUserIds.has(user.id)) {
        orphanedUserIds.push(user.id);
      }
    }

    // Delete orphaned users from users table
    if (orphanedUserIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .in('id', orphanedUserIds);
      
      if (deleteError) {
        console.error('❌ Error deleting orphaned users:', deleteError);
      } else {
        console.log(`🗑️ Cleaned up ${orphanedUserIds.length} orphaned users`);
      }
    }

    return c.json({ 
      success: true, 
      message: `Cleaned up ${orphanedUserIds.length} orphaned user records`,
      deletedCount: orphanedUserIds.length,
      remainingUsers: existingUserIds.size
    });
  } catch (err) {
    console.error("❌ Cleanup error:", err);
    return c.json({ error: "Failed to cleanup orphaned inventories" }, 500);
  }
});

app.post("/make-server-c88a69d7/inventory/generate-report/:userId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator' && userRole !== 'Health Officer') {
      return c.json({ error: 'Unauthorized: Admin or Health Officer access required' }, 403);
    }

    const targetUserId = c.req.param('userId');
    console.log(`📊 Generating report for user: ${targetUserId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get user's auth data
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(targetUserId);
    
    if (userError || !userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get user's branch from users table
    const { data: userTableData, error: userTableError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', targetUserId)
      .single();

    if (userTableError || !userTableData?.branch_id) {
      return c.json({ error: 'User has no branch assigned' }, 404);
    }

    // Get inventory for user's branch
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', userTableData.branch_id);

    if (invError) {
      console.error('❌ Error fetching inventory:', invError);
      return c.json({ error: 'Failed to fetch inventory' }, 500);
    }

    if (!inventory || inventory.length === 0) {
      return c.json({ error: 'No inventory found for this user' }, 404);
    }

    return c.json({
      success: true,
      inventory: inventory,
      userMetadata: {
        name: userData.user.user_metadata?.name || userData.user.email,
        branch: userData.user.user_metadata?.branch || 'Unknown Branch',
        role: userData.user.user_metadata?.role || 'User',
        email: userData.user.email
      }
    });
  } catch (err) {
    console.error("❌ Generate report error:", err);
    return c.json({ error: "Failed to generate report" }, 500);
  }
});

app.get("/make-server-c88a69d7/pending-users", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: usersData, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    const pendingUsers = usersData?.users
      .filter(user => user.user_metadata?.approved === false)
      .map(user => ({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'Unknown',
        role: user.user_metadata?.role || 'Unknown',
        branch: user.user_metadata?.branch || 'Unknown',
        createdAt: user.created_at
      })) || [];

    console.log(`✅ Retrieved ${pendingUsers.length} pending user(s)`);
    return c.json(pendingUsers);
  } catch (err) {
    console.error("❌ Fetch pending users error:", err);
    return c.json({ error: "Failed to fetch pending users" }, 500);
  }
});

app.get("/make-server-c88a69d7/all-users", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get all users from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    // SYNC: Ensure all auth users exist in users table
    // IMPORTANT: We only INSERT new users without overwriting existing branch assignments
    console.log('🔄 Syncing auth users to users table (preserving branch assignments)...');
    for (const authUser of authData?.users || []) {
      // First check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, branch_id')
        .eq('id', authUser.id)
        .single();
      
      if (existingUser) {
        // User exists - only update name, role, approved; NEVER touch branch_id
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: authUser.user_metadata?.name || authUser.email || 'Unknown',
            role: authUser.user_metadata?.role || 'User',
            approved: authUser.user_metadata?.approved !== false
          })
          .eq('id', authUser.id);
        
        if (updateError) {
          console.error(`⚠️ Error updating user ${authUser.email}:`, updateError);
        }
      } else {
        // User doesn't exist - insert with null branch_id (will be set on login)
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            branch_id: null,
            name: authUser.user_metadata?.name || authUser.email || 'Unknown',
            role: authUser.user_metadata?.role || 'User',
            approved: authUser.user_metadata?.approved !== false
          });
        
        if (insertError) {
          console.error(`⚠️ Error inserting user ${authUser.email}:`, insertError);
        }
      }
    }

    // Get all users from users table to get branch information
    const { data: usersTableData, error: usersError } = await supabase
      .from('users')
      .select('id, branch_id');
    
    if (usersError) {
      console.error('❌ Error fetching users table:', usersError);
      return c.json({ error: 'Failed to fetch user data' }, 500);
    }

    // Get all branches
    const { data: branchesData, error: branchesError } = await supabase
      .from('branches')
      .select('id, name');
    
    if (branchesError) {
      console.error('❌ Error fetching branches:', branchesError);
    }

    // Create a map for quick lookups
    const branchMap = new Map((branchesData || []).map(b => [b.id, b.name]));
    const userTableMap = new Map((usersTableData || []).map(u => [u.id, u.branch_id]));

    // Combine auth data with branch information
    const allUsers = (authData?.users || []).map(user => {
      const branchId = userTableMap.get(user.id);
      const userRole = user.user_metadata?.role || 'Unknown';
      
      // For Administrators and Health Officers, show "All Branches" instead of NULL
      let branchName = null;
      if (userRole === 'Administrator' || userRole === 'Health Officer') {
        branchName = 'All Branches';
      } else if (branchId) {
        branchName = branchMap.get(branchId) || 'Unknown Branch';
      } else {
        branchName = 'Not Assigned';
      }

      return {
        id: user.id,
        email: user.email || 'N/A',
        name: user.user_metadata?.name || 'Unknown',
        role: userRole,
        branchId: branchId || null,
        branchName: branchName,
        approved: user.user_metadata?.approved !== false
      };
    });

    console.log(`✅ Retrieved ${allUsers.length} total user(s)`);
    return c.json(allUsers);
  } catch (err) {
    console.error("❌ Fetch all users error:", err);
    return c.json({ error: "Failed to fetch all users" }, 500);
  }
});

app.post("/make-server-c88a69d7/approve-user/:userId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const userIdToApprove = c.req.param('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userIdToApprove);
    
    if (getUserError || !userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
      userIdToApprove,
      {
        user_metadata: {
          ...userData.user.user_metadata,
          approved: true
        }
      }
    );

    if (error) {
      console.error('❌ Error approving user:', error);
      return c.json({ error: error.message }, 400);
    }

    console.log(`✅ Approved user: ${userIdToApprove} (${userData.user.email})`);
    return c.json({ 
      success: true, 
      message: 'User approved successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      }
    });
  } catch (err) {
    console.error("❌ Approve user error:", err);
    return c.json({ error: "Failed to approve user" }, 500);
  }
});

app.post("/make-server-c88a69d7/reject-user/:userId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const userIdToReject = c.req.param('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: userData } = await supabase.auth.admin.getUserById(userIdToReject);
    const userEmail = userData?.user.email || 'unknown';

    const { error } = await supabase.auth.admin.deleteUser(userIdToReject);
    
    if (error) {
      console.error('❌ Error rejecting user:', error);
      return c.json({ error: error.message }, 400);
    }

    console.log(`✅ Rejected and deleted user: ${userIdToReject} (${userEmail})`);
    return c.json({ 
      success: true, 
      message: 'User registration rejected and account deleted'
    });
  } catch (err) {
    console.error("❌ Reject user error:", err);
    return c.json({ error: "Failed to reject user" }, 500);
  }
});

app.get("/make-server-c88a69d7/audit-logs", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const supabase = getSupabaseClient();
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('❌ Error fetching audit logs:', error);
      return c.json({ error: 'Failed to fetch audit logs' }, 500);
    }
    
    // Transform to match frontend format
    const transformedLogs = (logs || []).map(log => ({
      id: log.id,
      userId: log.user_id,
      branchId: log.branch_id,
      action: log.action,
      userName: log.details?.userName || 'Unknown',
      branchName: log.details?.branchName || 'Unknown',
      loginTime: log.details?.loginTime || log.created_at,
      timestamp: log.created_at,
      ...log.details
    }));
    
    return c.json(transformedLogs);
  } catch (err) {
    console.error("❌ Fetch audit logs error:", err);
    return c.json({ error: "Failed to fetch audit logs" }, 500);
  }
});

app.post("/make-server-c88a69d7/audit-logs", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const log = await c.req.json();
    const supabase = getSupabaseClient();
    
    // Find branch ID by branch name if provided
    let branchId = null;
    
    // Handle "All Branches" for Admin/Health Officer
    if (log.branchName && log.branchName !== 'All Branches' && log.branchName !== 'all') {
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .ilike('name', log.branchName)
        .single();
      branchId = branches?.id || null;
    }
    
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: log.userId || authResult.user.id,
        branch_id: branchId,
        action: log.action || 'login',
        details: {
          userName: log.userName,
          branchName: log.branchName,
          loginTime: log.loginTime,
          timestamp: log.timestamp || new Date().toISOString(),
          ...log
        }
      });
    
    if (error) {
      console.error('❌ Error adding audit log:', error);
      return c.json({ error: 'Failed to add audit log' }, 500);
    }
    
    return c.json({ success: true });
  } catch (err) {
    console.error("❌ Add audit log error:", err);
    return c.json({ error: "Failed to add audit log" }, 500);
  }
});

app.get("/make-server-c88a69d7/branches", async (c) => {
  try {
    const supabase = getSupabaseClient();
    
    console.log('📋 Fetching branches...');
    
    // Fetch branches with all fields including contact info
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, location, contact_person, contact_phone, contact_email, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error);
      return c.json({ error: 'Failed to fetch branches' }, 500);
    }
    
    console.log(`✅ Found ${branches?.length || 0} branches`);
    
    // Transform the data - set inventory counts to 0 for now (fast response)
    // Frontend can check individual branches if needed
    const branchesWithInventory = (branches || []).map(branch => ({
      id: branch.id,
      name: branch.name,
      location: branch.location || '',
      contactPerson: branch.contact_person || '',
      contactPhone: branch.contact_phone || '',
      contactEmail: branch.contact_email || '',
      createdAt: branch.created_at,
      inventoryCount: 0,  // Will be checked on-demand
      hasInventory: false  // Will be checked on-demand
    }));
    
    return c.json(branchesWithInventory);
  } catch (err) {
    console.error("❌ Fetch branches error:", err);
    return c.json({ error: "Failed to fetch branches" }, 500);
  }
});

app.post("/make-server-c88a69d7/branches", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const branch = await c.req.json();
    const supabase = getSupabaseClient();
    
    // Check if branch already exists
    const { data: existingBranches } = await supabase
      .from('branches')
      .select('name')
      .ilike('name', branch.name);
    
    if (existingBranches && existingBranches.length > 0) {
      return c.json({ error: 'Branch already exists' }, 400);
    }

    // Let PostgreSQL generate the UUID automatically (don't specify id)
    const { data: newBranch, error } = await supabase
      .from('branches')
      .insert({
        name: branch.name
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating branch:', error);
      return c.json({ error: 'Failed to create branch' }, 500);
    }
    
    console.log(`✅ Created branch: ${newBranch.name}`);
    return c.json({ 
      success: true, 
      branch: {
        id: newBranch.id,
        name: newBranch.name,
        createdAt: newBranch.created_at
      }
    });
  } catch (err) {
    console.error("❌ Create branch error:", err);
    return c.json({ error: "Failed to create branch" }, 500);
  }
});

app.delete("/make-server-c88a69d7/branches/:branchId", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const branchId = c.req.param('branchId');
    const supabase = getSupabaseClient();

    // Delete all inventory for this branch first
    const { error: invError } = await supabase
      .from('inventory')
      .delete()
      .eq('branch_id', branchId);

    if (invError) {
      console.warn(`⚠️ Could not delete inventory for branch ${branchId}:`, invError);
    }

    // Unassign users from this branch
    const { error: userError } = await supabase
      .from('users')
      .update({ branch_id: null })
      .eq('branch_id', branchId);

    if (userError) {
      console.warn(`⚠️ Could not unassign users from branch ${branchId}:`, userError);
    }

    // Delete the branch
    const { error: deleteError } = await supabase
      .from('branches')
      .delete()
      .eq('id', branchId);

    if (deleteError) {
      console.error('❌ Error deleting branch:', deleteError);
      return c.json({ error: 'Failed to delete branch' }, 500);
    }

    console.log(`✅ Deleted branch: ${branchId}`);
    return c.json({ success: true, message: 'Branch deleted successfully' });
  } catch (err) {
    console.error("❌ Delete branch error:", err);
    return c.json({ error: "Failed to delete branch" }, 500);
  }
});

app.post("/make-server-c88a69d7/branches/:branchId/initialize-inventory", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const branchId = c.req.param('branchId');
    const supabase = getSupabaseClient();
    
    // Verify branch exists
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();
    
    if (branchError || !branch) {
      return c.json({ error: 'Branch not found' }, 404);
    }

    // Delete existing inventory for this branch
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('branch_id', branchId);
    
    if (deleteError) {
      console.error('❌ Error deleting old inventory:', deleteError);
      return c.json({ error: 'Failed to clear existing inventory' }, 500);
    }

    // Generate default base inventory
    const defaultInventory = [
      {
        branch_id: branchId,
        drug_name: 'Paracetamol',
        generic_name: 'Acetaminophen',
        dosage: '500mg',
        quantity: 1000,
        expiry_date: '2027-12-31',
        batch_number: 'INIT-001',
        supplier: 'Initial Stock',
        unit_price: 1.50
      },
      {
        branch_id: branchId,
        drug_name: 'Amoxicillin',
        generic_name: 'Amoxicillin',
        dosage: '250mg',
        quantity: 500,
        expiry_date: '2027-06-30',
        batch_number: 'INIT-002',
        supplier: 'Initial Stock',
        unit_price: 3.25
      }
    ];
    
    // Insert new inventory items
    const { error: insertError } = await supabase
      .from('inventory')
      .insert(defaultInventory);
    
    if (insertError) {
      console.error('❌ Error inserting inventory:', insertError);
      return c.json({ error: 'Failed to initialize inventory' }, 500);
    }
    
    console.log(`✅ Initialized inventory for branch: ${branch.name} (${defaultInventory.length} items)`);
    return c.json({ 
      success: true, 
      message: `Initialized ${defaultInventory.length} items for ${branch.name}`
    });
  } catch (err) {
    console.error("❌ Initialize inventory error:", err);
    return c.json({ error: "Failed to initialize inventory" }, 500);
  }
});

// Populate sample medicine data for all branches
app.post("/make-server-c88a69d7/populate-sample-medicines", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    const supabase = getSupabaseClient();
    
    // Fetch all branches
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name');
    
    if (branchError) {
      console.error('❌ Error fetching branches:', branchError);
      return c.json({ error: 'Failed to fetch branches' }, 500);
    }

    if (!branches || branches.length === 0) {
      return c.json({ error: 'No branches found in the system' }, 404);
    }

    // Comprehensive sample medicine data
    const sampleMedicines = [
      // Pain Relief & Fever
      { drug_name: 'Paracetamol', generic_name: 'Acetaminophen', dosage: '500mg', quantity: 1000, expiry_date: '2027-12-31', batch_number: 'PAR-2024-001', supplier: 'PharmaCorp Ltd', unit_price: 1.50 },
      { drug_name: 'Ibuprofen', generic_name: 'Ibuprofen', dosage: '400mg', quantity: 850, expiry_date: '2027-08-15', batch_number: 'IBU-2024-002', supplier: 'MediSupply Inc', unit_price: 2.25 },
      { drug_name: 'Aspirin', generic_name: 'Acetylsalicylic Acid', dosage: '100mg', quantity: 600, expiry_date: '2027-03-20', batch_number: 'ASP-2024-003', supplier: 'HealthGen', unit_price: 1.80 },
      
      // Antibiotics
      { drug_name: 'Amoxicillin', generic_name: 'Amoxicillin', dosage: '250mg', quantity: 750, expiry_date: '2027-06-30', batch_number: 'AMX-2024-004', supplier: 'PharmaCorp Ltd', unit_price: 3.25 },
      { drug_name: 'Azithromycin', generic_name: 'Azithromycin', dosage: '500mg', quantity: 400, expiry_date: '2027-09-15', batch_number: 'AZI-2024-005', supplier: 'BioMed Solutions', unit_price: 5.50 },
      { drug_name: 'Ciprofloxacin', generic_name: 'Ciprofloxacin', dosage: '500mg', quantity: 300, expiry_date: '2027-11-10', batch_number: 'CIP-2024-006', supplier: 'MediSupply Inc', unit_price: 4.75 },
      { drug_name: 'Cephalexin', generic_name: 'Cephalexin', dosage: '500mg', quantity: 450, expiry_date: '2027-07-25', batch_number: 'CEP-2024-007', supplier: 'HealthGen', unit_price: 4.00 },
      
      // Cardiovascular
      { drug_name: 'Amlodipine', generic_name: 'Amlodipine', dosage: '5mg', quantity: 900, expiry_date: '2028-01-30', batch_number: 'AML-2024-008', supplier: 'CardioPharm', unit_price: 3.50 },
      { drug_name: 'Atorvastatin', generic_name: 'Atorvastatin', dosage: '20mg', quantity: 650, expiry_date: '2027-10-18', batch_number: 'ATO-2024-009', supplier: 'CardioPharm', unit_price: 6.25 },
      { drug_name: 'Metoprolol', generic_name: 'Metoprolol', dosage: '50mg', quantity: 520, expiry_date: '2027-12-05', batch_number: 'MET-2024-010', supplier: 'PharmaCorp Ltd', unit_price: 4.50 },
      { drug_name: 'Losartan', generic_name: 'Losartan Potassium', dosage: '50mg', quantity: 680, expiry_date: '2027-08-28', batch_number: 'LOS-2024-011', supplier: 'BioMed Solutions', unit_price: 5.00 },
      
      // Diabetes Management
      { drug_name: 'Metformin', generic_name: 'Metformin HCl', dosage: '500mg', quantity: 1200, expiry_date: '2028-02-14', batch_number: 'MET-2024-012', supplier: 'DiabetaCare', unit_price: 2.80 },
      { drug_name: 'Glimepiride', generic_name: 'Glimepiride', dosage: '2mg', quantity: 550, expiry_date: '2027-11-22', batch_number: 'GLI-2024-013', supplier: 'DiabetaCare', unit_price: 4.20 },
      { drug_name: 'Insulin Glargine', generic_name: 'Insulin Glargine', dosage: '100 IU/mL', quantity: 200, expiry_date: '2026-12-31', batch_number: 'INS-2024-014', supplier: 'EndoPharm', unit_price: 45.00 },
      
      // Respiratory
      { drug_name: 'Salbutamol', generic_name: 'Albuterol', dosage: '100mcg', quantity: 380, expiry_date: '2027-09-08', batch_number: 'SAL-2024-015', supplier: 'RespiraTech', unit_price: 8.50 },
      { drug_name: 'Cetirizine', generic_name: 'Cetirizine', dosage: '10mg', quantity: 720, expiry_date: '2027-10-12', batch_number: 'CET-2024-016', supplier: 'MediSupply Inc', unit_price: 2.00 },
      { drug_name: 'Montelukast', generic_name: 'Montelukast', dosage: '10mg', quantity: 440, expiry_date: '2027-07-19', batch_number: 'MON-2024-017', supplier: 'RespiraTech', unit_price: 5.75 },
      
      // Gastrointestinal
      { drug_name: 'Omeprazole', generic_name: 'Omeprazole', dosage: '20mg', quantity: 800, expiry_date: '2027-12-20', batch_number: 'OME-2024-018', supplier: 'GastroMed', unit_price: 3.00 },
      { drug_name: 'Ranitidine', generic_name: 'Ranitidine', dosage: '150mg', quantity: 560, expiry_date: '2027-06-17', batch_number: 'RAN-2024-019', supplier: 'GastroMed', unit_price: 2.50 },
      { drug_name: 'Loperamide', generic_name: 'Loperamide', dosage: '2mg', quantity: 350, expiry_date: '2027-09-25', batch_number: 'LOP-2024-020', supplier: 'PharmaCorp Ltd', unit_price: 1.75 },
      
      // Mental Health
      { drug_name: 'Sertraline', generic_name: 'Sertraline', dosage: '50mg', quantity: 480, expiry_date: '2027-11-08', batch_number: 'SER-2024-021', supplier: 'MindCare Pharma', unit_price: 6.50 },
      { drug_name: 'Fluoxetine', generic_name: 'Fluoxetine', dosage: '20mg', quantity: 420, expiry_date: '2027-10-03', batch_number: 'FLU-2024-022', supplier: 'MindCare Pharma', unit_price: 5.80 },
      { drug_name: 'Lorazepam', generic_name: 'Lorazepam', dosage: '1mg', quantity: 280, expiry_date: '2027-08-11', batch_number: 'LOR-2024-023', supplier: 'NeuroPharma', unit_price: 4.25 },
      
      // Vitamins & Supplements
      { drug_name: 'Vitamin B Complex', generic_name: 'B-Complex', dosage: 'Standard', quantity: 950, expiry_date: '2028-03-15', batch_number: 'VIT-2024-024', supplier: 'NutriHealth', unit_price: 3.50 },
      { drug_name: 'Vitamin C', generic_name: 'Ascorbic Acid', dosage: '500mg', quantity: 1100, expiry_date: '2028-01-22', batch_number: 'VIT-2024-025', supplier: 'NutriHealth', unit_price: 2.20 },
      { drug_name: 'Calcium Carbonate', generic_name: 'Calcium Carbonate', dosage: '500mg', quantity: 870, expiry_date: '2027-12-28', batch_number: 'CAL-2024-026', supplier: 'BoneCare', unit_price: 2.75 },
      { drug_name: 'Vitamin D3', generic_name: 'Cholecalciferol', dosage: '1000 IU', quantity: 780, expiry_date: '2028-02-10', batch_number: 'VIT-2024-027', supplier: 'NutriHealth', unit_price: 3.20 },
      
      // Topical & Others
      { drug_name: 'Hydrocortisone Cream', generic_name: 'Hydrocortisone', dosage: '1%', quantity: 320, expiry_date: '2027-07-30', batch_number: 'HYD-2024-028', supplier: 'DermaCare', unit_price: 5.25 },
      { drug_name: 'Clotrimazole Cream', generic_name: 'Clotrimazole', dosage: '1%', quantity: 290, expiry_date: '2027-09-12', batch_number: 'CLO-2024-029', supplier: 'DermaCare', unit_price: 4.80 },
      { drug_name: 'Eye Drops (Artificial Tears)', generic_name: 'Hypromellose', dosage: '0.3%', quantity: 410, expiry_date: '2027-06-05', batch_number: 'EYE-2024-030', supplier: 'OptiCare', unit_price: 6.00 }
    ];

    let totalItemsAdded = 0;
    const results: Array<{ branchName: string; itemsAdded: number; status: string }> = [];

    // For each branch, add the sample medicines
    for (const branch of branches) {
      try {
        // Prepare inventory records with branch_id
        const inventoryRecords = sampleMedicines.map(med => ({
          ...med,
          branch_id: branch.id
        }));

        // Insert inventory items for this branch
        const { error: insertError } = await supabase
          .from('inventory')
          .insert(inventoryRecords);
        
        if (insertError) {
          console.error(`❌ Error inserting inventory for branch ${branch.name}:`, insertError);
          results.push({
            branchName: branch.name,
            itemsAdded: 0,
            status: `Error: ${insertError.message}`
          });
        } else {
          totalItemsAdded += sampleMedicines.length;
          results.push({
            branchName: branch.name,
            itemsAdded: sampleMedicines.length,
            status: 'Success'
          });
          console.log(`✅ Added ${sampleMedicines.length} medicines to branch: ${branch.name}`);
        }
      } catch (branchErr) {
        console.error(`❌ Error processing branch ${branch.name}:`, branchErr);
        results.push({
          branchName: branch.name,
          itemsAdded: 0,
          status: `Error: ${branchErr instanceof Error ? branchErr.message : 'Unknown error'}`
        });
      }
    }

    console.log(`✅ Sample medicine population complete. Total items added: ${totalItemsAdded} across ${branches.length} branches`);
    
    return c.json({ 
      success: true, 
      message: `Successfully populated ${totalItemsAdded} medicine items across ${branches.length} branches`,
      totalItemsAdded,
      branchesProcessed: branches.length,
      results
    });
  } catch (err) {
    console.error("❌ Populate sample medicines error:", err);
    return c.json({ error: "Failed to populate sample medicines" }, 500);
  }
});

// Update user's branch assignment when they login
app.post("/make-server-c88a69d7/assign-user-branch", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const { branchId } = await c.req.json();
    
    if (!branchId) {
      return c.json({ error: 'Branch ID is required' }, 400);
    }

    const supabase = getSupabaseClient();
    const userId = authResult.user.id;
    
    // Verify branch exists
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();
    
    if (branchError || !branch) {
      return c.json({ error: 'Branch not found' }, 404);
    }

    // Upsert user with branch assignment
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        branch_id: branchId,
        name: authResult.user.user_metadata?.name || authResult.user.email,
        role: authResult.user.user_metadata?.role || 'User',
        approved: authResult.user.user_metadata?.approved !== false
      }, { onConflict: 'id' });
    
    if (upsertError) {
      console.error('❌ Error assigning branch to user:', upsertError);
      return c.json({ error: 'Failed to assign branch' }, 500);
    }
    
    console.log(`✅ Assigned user ${userId} to branch: ${branch.name} (${branchId})`);
    return c.json({ 
      success: true, 
      message: `Assigned to ${branch.name}`,
      branchId: branchId,
      branchName: branch.name
    });
  } catch (err) {
    console.error("❌ Assign branch error:", err);
    return c.json({ error: "Failed to assign branch" }, 500);
  }
});

// Sync/repair all user branch assignments based on auth metadata
app.post("/make-server-c88a69d7/sync-user-branches", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    console.log('🔄 Starting user-branch sync...');

    const supabase = getSupabaseClient();
    
    // Get all branches for lookup
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name');
    
    if (branchError) {
      console.error('❌ Error fetching branches:', branchError);
      return c.json({ error: 'Failed to fetch branches' }, 500);
    }

    // Create a map for quick branch lookup by name (case-insensitive)
    const branchMap = new Map();
    branches?.forEach(branch => {
      branchMap.set(branch.name.toLowerCase(), branch.id);
    });

    // Get all auth users
    const { data: authData } = await supabase.auth.admin.listUsers();
    
    if (!authData?.users) {
      return c.json({ error: 'No users found' }, 404);
    }

    const results = {
      total: authData.users.length,
      assigned: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // For each auth user, try to assign them to a branch based on their metadata
    for (const authUser of authData.users) {
      try {
        const branchName = authUser.user_metadata?.branch;
        const role = authUser.user_metadata?.role;
        
        // Skip users without a branch in metadata (like Administrators)
        if (!branchName || role === 'Administrator' || role === 'Health Officer') {
          results.skipped++;
          continue;
        }

        // Find matching branch by name (case-insensitive)
        const branchId = branchMap.get(branchName.toLowerCase());
        
        if (!branchId) {
          console.warn(`⚠️ Branch not found for user ${authUser.email}: ${branchName}`);
          results.errors.push(`Branch not found: ${branchName} (user: ${authUser.email})`);
          continue;
        }

        // Upsert user with branch assignment
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: authUser.id,
            branch_id: branchId,
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown',
            role: role || 'User',
            approved: authUser.user_metadata?.approved !== false
          }, { onConflict: 'id' });
        
        if (upsertError) {
          console.error(`❌ Error assigning branch for ${authUser.email}:`, upsertError);
          results.errors.push(`Failed to assign ${authUser.email}: ${upsertError.message}`);
        } else {
          console.log(`✅ Assigned ${authUser.email} to branch ${branchName} (${branchId})`);
          results.assigned++;
        }
      } catch (err) {
        console.error(`❌ Error processing user ${authUser.email}:`, err);
        results.errors.push(`Error processing ${authUser.email}: ${err}`);
      }
    }

    console.log('✅ User-branch sync complete:', results);
    return c.json(results);
  } catch (err) {
    console.error("❌ Sync user branches error:", err);
    return c.json({ error: "Failed to sync user branches" }, 500);
  }
});

// Diagnostic endpoint to check branch and user-branch assignment status
app.get("/make-server-c88a69d7/diagnostic/branch-status", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    console.log('🔍 Running branch diagnostic...');

    const supabase = getSupabaseClient();
    
    // Get all branches
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name, created_at')
      .order('name', { ascending: true });
    
    if (branchError) {
      console.error('❌ Error fetching branches:', branchError);
      return c.json({ error: 'Failed to fetch branches' }, 500);
    }

    // Get all users from users table
    const { data: usersTable, error: usersError } = await supabase
      .from('users')
      .select('id, branch_id, name, role')
      .order('name', { ascending: true });
    
    if (usersError) {
      console.error('❌ Error fetching users table:', usersError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    // Get all auth users
    const { data: authData } = await supabase.auth.admin.listUsers();
    
    if (!authData?.users) {
      return c.json({ error: 'No auth users found' }, 404);
    }

    // Analyze users
    const usersWithBranches = usersTable?.filter(u => u.branch_id !== null) || [];
    const usersWithoutBranches = usersTable?.filter(u => u.branch_id === null) || [];
    
    // Map auth users to their metadata
    const authUserMap = new Map();
    authData.users.forEach(user => {
      authUserMap.set(user.id, {
        email: user.email,
        name: user.user_metadata?.name || 'Unknown',
        role: user.user_metadata?.role || 'Unknown',
        branchMetadata: user.user_metadata?.branch || null,
        approved: user.user_metadata?.approved !== false
      });
    });

    // Find users in auth but not in users table
    const usersTableIds = new Set(usersTable?.map(u => u.id) || []);
    const usersNotInTable = authData.users
      .filter(u => !usersTableIds.has(u.id))
      .map(u => ({
        id: u.id,
        email: u.email,
        role: u.user_metadata?.role,
        branchMetadata: u.user_metadata?.branch
      }));

    // Find mismatches (users with branch in metadata but not in table)
    const mismatches = [];
    for (const tableUser of usersTable || []) {
      const authUser = authUserMap.get(tableUser.id);
      if (authUser && authUser.branchMetadata && !tableUser.branch_id) {
        mismatches.push({
          id: tableUser.id,
          email: authUser.email,
          name: authUser.name,
          role: authUser.role,
          branchInMetadata: authUser.branchMetadata,
          branchIdInTable: null
        });
      }
    }

    // Check which branches from metadata actually exist in branches table
    const branchNames = new Set((branches || []).map(b => b.name.toLowerCase()));
    const missingBranches = new Set<string>();
    authData.users.forEach(user => {
      const branchMetadata = user.user_metadata?.branch;
      if (branchMetadata && !branchNames.has(branchMetadata.toLowerCase())) {
        missingBranches.add(branchMetadata);
      }
    });

    const diagnostic = {
      branches: {
        total: branches?.length || 0,
        list: branches || []
      },
      users: {
        total: authData.users.length,
        inUsersTable: usersTable?.length || 0,
        withBranchAssignment: usersWithBranches.length,
        withoutBranchAssignment: usersWithoutBranches.length,
        notInUsersTable: usersNotInTable.length
      },
      issues: {
        usersNotInTable,
        mismatches,
        missingBranches: Array.from(missingBranches)
      },
      details: {
        usersWithBranches: usersWithBranches.map(u => ({
          ...u,
          authInfo: authUserMap.get(u.id)
        })),
        usersWithoutBranches: usersWithoutBranches.map(u => ({
          ...u,
          authInfo: authUserMap.get(u.id)
        }))
      }
    };

    console.log('✅ Diagnostic complete');
    return c.json(diagnostic);
  } catch (err) {
    console.error("❌ Branch diagnostic error:", err);
    return c.json({ error: "Failed to run diagnostic" }, 500);
  }
});

// Create branches from user metadata
app.post("/make-server-c88a69d7/create-missing-branches", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    console.log('🏗️ Creating missing branches...');

    const supabase = getSupabaseClient();
    
    // Get all existing branches
    const { data: existingBranches, error: branchError } = await supabase
      .from('branches')
      .select('name');
    
    if (branchError) {
      console.error('❌ Error fetching branches:', branchError);
      return c.json({ error: 'Failed to fetch branches' }, 500);
    }

    const existingBranchNames = new Set(
      (existingBranches || []).map(b => b.name.toLowerCase())
    );

    // Get all auth users and collect unique branch names
    const { data: authData } = await supabase.auth.admin.listUsers();
    
    if (!authData?.users) {
      return c.json({ error: 'No users found' }, 404);
    }

    const branchNamesToCreate = new Set<string>();
    authData.users.forEach(user => {
      const branchName = user.user_metadata?.branch;
      const role = user.user_metadata?.role;
      
      // Only consider branches from Pharmacy Staff
      if (branchName && role === 'Pharmacy Staff' && 
          !existingBranchNames.has(branchName.toLowerCase())) {
        branchNamesToCreate.add(branchName);
      }
    });

    const results = {
      created: 0,
      skipped: existingBranchNames.size,
      errors: [] as string[]
    };

    // Create missing branches
    for (const branchName of branchNamesToCreate) {
      try {
        const { error } = await supabase
          .from('branches')
          .insert({
            name: branchName
          });
        
        if (error) {
          console.error(`❌ Error creating branch ${branchName}:`, error);
          results.errors.push(`Failed to create ${branchName}: ${error.message}`);
        } else {
          console.log(`✅ Created branch: ${branchName}`);
          results.created++;
        }
      } catch (err) {
        console.error(`❌ Error creating branch ${branchName}:`, err);
        results.errors.push(`Failed to create ${branchName}: ${err}`);
      }
    }

    console.log('✅ Branch creation complete:', results);
    return c.json(results);
  } catch (err) {
    console.error("❌ Create branches error:", err);
    return c.json({ error: "Failed to create branches" }, 500);
  }
});

// =============================================
// MIGRATION ENDPOINT (STUB - Migration already complete)
// =============================================
app.post("/make-server-c88a69d7/migrate-to-sql", async (c) => {
  return c.json({
    success: true,
    message: 'Migration already complete. All data is now stored in SQL tables.',
    summary: { totalMigrated: 0, totalErrors: 0 },
    results: {
      branches: { migrated: 0, errors: [] },
      users: { migrated: 0, errors: [] },
      inventory: { migrated: 0, errors: [] },
      auditLogs: { migrated: 0, errors: [] }
    }
  });
});

/*  ORIGINAL MIGRATION CODE (kept for reference)
app.post("/make-server-c88a69d7/migrate-to-sql-original", async (c) => {
  try {
    const authResult = await checkAuth(c);
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, 401);
    }

    const userRole = authResult.user.user_metadata?.role;
    if (userRole !== 'Administrator') {
      return c.json({ error: 'Unauthorized: Administrator access required' }, 403);
    }

    console.log('🚀 Starting migration from KV store to SQL tables...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const migrationResults = {
      branches: { migrated: 0, errors: [] as string[] },
      users: { migrated: 0, errors: [] as string[] },
      inventory: { migrated: 0, errors: [] as string[] },
      auditLogs: { migrated: 0, errors: [] as string[] }
    };

    // ========== STEP 1: Migrate Branches ==========
    console.log('📦 Step 1: Migrating branches...');
    const kvBranches = await kv.get('mediflow_branches') || [];
    
    for (const branch of kvBranches) {
      try {
        const { error } = await supabase
          .from('branches')
          .upsert({
            id: branch.id,
            name: branch.name,
            created_at: branch.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        
        if (error) {
          console.error(`❌ Error migrating branch ${branch.name}:`, error);
          migrationResults.branches.errors.push(`Branch ${branch.name}: ${error.message}`);
        } else {
          migrationResults.branches.migrated++;
          console.log(`✅ Migrated branch: ${branch.name}`);
        }
      } catch (err) {
        console.error(`❌ Exception migrating branch:`, err);
        migrationResults.branches.errors.push(`Branch ${branch.name}: ${err.message}`);
      }
    }

    // ========== STEP 2: Migrate Users ==========
    console.log('👥 Step 2: Migrating users...');
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    
    for (const authUser of authUsers?.users || []) {
      try {
        // Find matching branch by name
        let branchId = null;
        const userBranchName = authUser.user_metadata?.branch;
        
        if (userBranchName) {
          const matchingBranch = kvBranches.find(
            (b: any) => b.name.toLowerCase() === userBranchName.toLowerCase()
          );
          branchId = matchingBranch?.id || null;
        }

        const { error } = await supabase
          .from('users')
          .upsert({
            id: authUser.id,
            branch_id: branchId,
            name: authUser.user_metadata?.name || authUser.email,
            role: authUser.user_metadata?.role || 'User',
            profile_picture: authUser.user_metadata?.profilePicture || null,
            approved: authUser.user_metadata?.approved !== false,
            created_at: authUser.created_at,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        
        if (error) {
          console.error(`❌ Error migrating user ${authUser.email}:`, error);
          migrationResults.users.errors.push(`User ${authUser.email}: ${error.message}`);
        } else {
          migrationResults.users.migrated++;
          console.log(`✅ Migrated user: ${authUser.email}`);
        }
      } catch (err) {
        console.error(`❌ Exception migrating user:`, err);
        migrationResults.users.errors.push(`User ${authUser.email}: ${err.message}`);
      }
    }

    // ========== STEP 3: Migrate Inventory ==========
    console.log('💊 Step 3: Migrating inventory...');
    
    // Get all inventory from KV store (both old format and new format)
    const allKvInventories = await kv.getByPrefix('branch:');
    const oldFormatInventories = await kv.getByPrefix('mediflow_inventory_');
    
    // Migrate new format (branch:branchId:inventory)
    for (const kvRecord of allKvInventories) {
      if (!kvRecord.key.endsWith(':inventory')) continue;
      
      try {
        const branchId = kvRecord.key.split(':')[1];
        const inventoryItems = kvRecord.value || [];
        
        for (const item of inventoryItems) {
          const { error } = await supabase
            .from('inventory')
            .insert({
              branch_id: branchId,
              drug_name: item.drugName || item.drug_name || 'Unknown',
              generic_name: item.genericName || item.generic_name || null,
              dosage: item.dosage || null,
              quantity: item.quantity || 0,
              expiry_date: item.expiryDate || item.expiry_date || null,
              batch_number: item.batchNumber || item.batch_number || null,
              supplier: item.supplier || null,
              unit_price: item.unitPrice || item.unit_price || null,
              created_at: item.createdAt || item.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (error && !error.message.includes('duplicate')) {
            console.error(`❌ Error migrating inventory item:`, error);
            migrationResults.inventory.errors.push(`Item ${item.drugName}: ${error.message}`);
          } else if (!error) {
            migrationResults.inventory.migrated++;
          }
        }
        
        console.log(`✅ Migrated ${inventoryItems.length} items for branch ${branchId}`);
      } catch (err) {
        console.error(`❌ Exception migrating inventory:`, err);
        migrationResults.inventory.errors.push(`Key ${kvRecord.key}: ${err.message}`);
      }
    }

    // Migrate old format (mediflow_inventory_userId) - link to user's branch
    for (const kvRecord of oldFormatInventories) {
      if (!kvRecord.key.startsWith('mediflow_inventory_')) continue;
      
      try {
        const userId = kvRecord.key.replace('mediflow_inventory_', '');
        const inventoryItems = kvRecord.value || [];
        
        // Find user's branch
        const { data: userData } = await supabase
          .from('users')
          .select('branch_id')
          .eq('id', userId)
          .single();
        
        if (!userData?.branch_id) {
          console.warn(`⚠️ User ${userId} has no branch, skipping inventory`);
          continue;
        }
        
        for (const item of inventoryItems) {
          const { error } = await supabase
            .from('inventory')
            .insert({
              branch_id: userData.branch_id,
              drug_name: item.drugName || item.drug_name || 'Unknown',
              generic_name: item.genericName || item.generic_name || null,
              dosage: item.dosage || null,
              quantity: item.quantity || 0,
              expiry_date: item.expiryDate || item.expiry_date || null,
              batch_number: item.batchNumber || item.batch_number || null,
              supplier: item.supplier || null,
              unit_price: item.unitPrice || item.unit_price || null,
              created_at: item.createdAt || item.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (error && !error.message.includes('duplicate')) {
            console.error(`❌ Error migrating old format inventory:`, error);
            migrationResults.inventory.errors.push(`User ${userId} item: ${error.message}`);
          } else if (!error) {
            migrationResults.inventory.migrated++;
          }
        }
        
        console.log(`✅ Migrated old format inventory for user ${userId}`);
      } catch (err) {
        console.error(`❌ Exception migrating old format inventory:`, err);
        migrationResults.inventory.errors.push(`Key ${kvRecord.key}: ${err.message}`);
      }
    }

    // ========== STEP 4: Migrate Audit Logs ==========
    console.log('📋 Step 4: Migrating audit logs...');
    const kvAuditLogs = await kv.get('mediflow_audit_logs') || [];
    
    for (const log of kvAuditLogs) {
      try {
        // Find branch ID by branch name
        let branchId = null;
        if (log.branchName) {
          const matchingBranch = kvBranches.find(
            (b: any) => b.name.toLowerCase() === log.branchName.toLowerCase()
          );
          branchId = matchingBranch?.id || null;
        }

        const { error } = await supabase
          .from('audit_logs')
          .insert({
            user_id: log.userId || null,
            branch_id: branchId || log.branchId || null,
            action: log.action || 'login',
            details: {
              userName: log.userName,
              branchName: log.branchName,
              loginTime: log.loginTime,
              timestamp: log.timestamp,
              ...log
            },
            created_at: log.loginTime || log.timestamp || new Date().toISOString()
          });
        
        if (error && !error.message.includes('duplicate')) {
          console.error(`❌ Error migrating audit log:`, error);
          migrationResults.auditLogs.errors.push(`Log ${log.id}: ${error.message}`);
        } else if (!error) {
          migrationResults.auditLogs.migrated++;
        }
      } catch (err) {
        console.error(`❌ Exception migrating audit log:`, err);
        migrationResults.auditLogs.errors.push(`Log ${log.id}: ${err.message}`);
      }
    }

    console.log('✅ Migration completed!');
    console.log('📊 Migration Results:', migrationResults);

    return c.json({
      success: true,
      message: 'Migration completed',
      results: migrationResults,
      summary: {
        totalMigrated: 
          migrationResults.branches.migrated +
          migrationResults.users.migrated +
          migrationResults.inventory.migrated +
          migrationResults.auditLogs.migrated,
        totalErrors: 
          migrationResults.branches.errors.length +
          migrationResults.users.errors.length +
          migrationResults.inventory.errors.length +
          migrationResults.auditLogs.errors.length
      }
    });

  } catch (err) {
    console.error("❌ Migration error:", err);
    return c.json({ 
      error: "Failed to complete migration", 
      details: err.message 
    }, 500);
  }
});
*/

Deno.serve(app.fetch);