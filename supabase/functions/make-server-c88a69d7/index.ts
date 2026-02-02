import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { logger } from "npm:hono@4/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// KV Store helper functions
const kvClient = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const kv = {
  get: async (key: string) => {
    const supabase = kvClient();
    const { data, error } = await supabase.from("kv_store_c88a69d7").select("value").eq("key", key).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.value;
  },
  
  set: async (key: string, value: any) => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_c88a69d7").upsert({ key, value });
    if (error) throw new Error(error.message);
  },
  
  del: async (key: string) => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_c88a69d7").delete().eq("key", key);
    if (error) throw new Error(error.message);
  },
  
  mdel: async (keys: string[]) => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_c88a69d7").delete().in("key", keys);
    if (error) throw new Error(error.message);
  }
};

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

    const key = `mediflow_inventory_${authResult.user.id}`;
    console.log(`📥 Fetching inventory for user: ${authResult.user.id}`);
    const inventory = await kv.get(key);
    console.log(`✅ Retrieved inventory: ${inventory ? (Array.isArray(inventory) ? inventory.length : 'non-array') : 'null'} items`);
    
    return c.json(inventory);
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
    const key = `mediflow_inventory_${authResult.user.id}`;
    
    console.log(`💾 Saving inventory for user: ${authResult.user.id}`);
    console.log(`📦 Inventory items: ${Array.isArray(inventory) ? inventory.length : 'invalid format'}`);
    
    await kv.set(key, inventory);
    console.log(`✅ Successfully saved inventory to: ${key}`);
    
    return c.json({ success: true, itemCount: Array.isArray(inventory) ? inventory.length : 0 });
  } catch (err) {
    console.error("❌ Save inventory error:", err);
    return c.json({ error: "Failed to save inventory" }, 500);
  }
});

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    const { data, error } = await supabase
      .from('kv_store_c88a69d7')
      .select('key, value')
      .like('key', 'mediflow_inventory_%');
    
    if (error) {
      console.error('❌ Database error:', error);
      return c.json({ error: 'Failed to fetch inventories' }, 500);
    }
    
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const userMap = new Map();
    usersData?.users.forEach(user => {
      userMap.set(user.id, {
        name: user.user_metadata?.name || user.email,
        branch: user.user_metadata?.branch || 'Unknown Branch',
        role: user.user_metadata?.role || 'User',
        email: user.email,
        phone: user.user_metadata?.branchContact || ''
      });
    });
    
    const enrichedData = (data || []).map(item => {
      const userId = item.key.replace('mediflow_inventory_', '');
      const userInfo = userMap.get(userId);
      return {
        ...item,
        userId,
        userName: userInfo?.name || 'Unknown User',
        branchName: userInfo?.branch || 'Unknown Branch',
        userRole: userInfo?.role || 'User',
        userEmail: userInfo?.email || '',
        userPhone: userInfo?.phone || ''
      };
    });
    
    // Filter out Administrator and Health Officer accounts - they don't have branches
    const pharmacyStaffOnly = enrichedData.filter(item => 
      item.userRole === 'Pharmacy Staff'
    );
    
    console.log(`✅ Retrieved ${enrichedData.length} total inventories, ${pharmacyStaffOnly.length} pharmacy staff branches`);
    
    return c.json(pharmacyStaffOnly);
  } catch (err) {
    console.error("❌ Fetch all inventories error:", err);
    return c.json({ error: "Failed to fetch branch inventories" }, 500);
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

    const key = `mediflow_inventory_${targetUserId}`;
    
    console.log(`💾 Admin/HO updating inventory for user: ${targetUserId}`);
    console.log(`📦 Inventory items: ${inventory.length}`);
    
    await kv.set(key, inventory);
    console.log(`✅ Successfully updated inventory at: ${key}`);
    
    return c.json({ success: true, itemCount: inventory.length });
  } catch (err) {
    console.error("❌ Update branch inventory error:", err);
    return c.json({ error: "Failed to update branch inventory" }, 500);
  }
});

app.get("/make-server-c88a69d7/system-drugs", async (c) => {
  try {
    const systemDrugs = await kv.get('mediflow_system_drugs');
    return c.json(systemDrugs || []);
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

    const { drug } = await c.req.json();
    const systemDrugs = await kv.get('mediflow_system_drugs') || [];
    systemDrugs.push(drug);
    await kv.set('mediflow_system_drugs', systemDrugs);
    
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

    const inventoryKey = `mediflow_inventory_${userIdToDelete}`;
    await kv.del(inventoryKey);
    console.log(`🗑️ Deleted inventory: ${inventoryKey}`);

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
    
    const inventoryKey = `mediflow_inventory_${userIdToDelete}`;
    const existingInventory = await kv.get(inventoryKey);
    
    if (existingInventory === null || existingInventory === undefined) {
      console.log(`⚠️ No inventory found for key: ${inventoryKey}`);
      return c.json({ 
        success: true, 
        message: 'No inventory data found for this branch',
        wasDeleted: false 
      });
    }
    
    await kv.del(inventoryKey);
    console.log(`✅ Deleted branch inventory: ${inventoryKey}`);

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

    const { data: inventories, error } = await supabase
      .from('kv_store_c88a69d7')
      .select('key')
      .like('key', 'mediflow_inventory_%');

    if (error) {
      console.error('❌ Database error:', error);
      return c.json({ error: 'Failed to fetch inventories' }, 500);
    }

    const orphanedKeys: string[] = [];
    for (const record of inventories || []) {
      const userId = record.key.replace('mediflow_inventory_', '');
      if (!existingUserIds.has(userId)) {
        orphanedKeys.push(record.key);
      }
    }

    if (orphanedKeys.length > 0) {
      await kv.mdel(orphanedKeys);
      console.log(`🗑️ Cleaned up ${orphanedKeys.length} orphaned inventories:`, orphanedKeys);
    }

    return c.json({ 
      success: true, 
      message: `Cleaned up ${orphanedKeys.length} orphaned inventory records`,
      deletedKeys: orphanedKeys,
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

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(targetUserId);
    
    if (userError || !userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    const inventoryKey = `mediflow_inventory_${targetUserId}`;
    const inventory = await kv.get(inventoryKey);

    if (!inventory) {
      return c.json({ error: 'Inventory not found for this user' }, 404);
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

Deno.serve(app.fetch);