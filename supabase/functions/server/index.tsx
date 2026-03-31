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
        // Also upsert into users table so server endpoints can find admin/HO accounts
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            branch_id: null,
            name: account.name,
            role: account.role,
            approved: true,
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error(`⚠️ Could not upsert user row for ${account.email}:`, upsertError);
        } else {
          console.log(`✅ User row upserted for ${account.email}`);
        }

        results.push({ email: account.email, status: 'created', userId: data.user.id });
      }
    }

    // Idempotent repair: ensure ALL existing admin/HO auth users have a users-table row
    try {
      const { data: allAuthUsers } = await supabase.auth.admin.listUsers();
      for (const u of allAuthUsers?.users ?? []) {
        const role = u.user_metadata?.role;
        if (role !== 'Administrator' && role !== 'Health Officer') continue;
        await supabase.from('users').upsert({
          id: u.id,
          branch_id: null,
          name: u.user_metadata?.name || u.email?.split('@')[0] || 'Admin',
          role,
          approved: true,
        }, { onConflict: 'id' });
      }
      console.log('✅ Admin/HO users-table repair complete');
    } catch (repairErr) {
      console.error('⚠️ Admin user-row repair error:', repairErr);
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

// Called once on every admin/HO login to ensure their row exists in users table
app.post("/make-server-c88a69d7/ensure-user-row", async (c) => {
  try {
    const userToken = c.req.header('X-User-Token');
    if (!userToken) return c.json({ error: 'No token' }, 401);

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(userToken);
    if (authError || !user) return c.json({ error: 'Invalid token' }, 401);

    const role = user.user_metadata?.role;
    // Only repair Admin and Health Officer rows (staff rows are created at signup)
    if (role !== 'Administrator' && role !== 'Health Officer') {
      return c.json({ success: true, action: 'skipped' });
    }

    const supabase = getSupabaseClient();
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        branch_id: null,
        name: user.user_metadata?.name || user.email?.split('@')[0] || role,
        role,
        approved: true,
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('❌ ensure-user-row upsert failed:', upsertError);
      return c.json({ error: upsertError.message }, 500);
    }

    console.log(`✅ ensure-user-row: row confirmed for ${user.email} (${role})`);
    return c.json({ success: true, action: 'upserted' });
  } catch (err) {
    console.error('❌ ensure-user-row error:', err);
    return c.json({ error: 'Internal error' }, 500);
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
    
    // Admin / Health Officer accounts have no branch — return empty immediately
    const userRole = authResult.user.user_metadata?.role;
    if (userRole === 'Administrator' || userRole === 'Health Officer') {
      console.log('ℹ️ Admin/HO account — no branch-specific inventory to return');
      return c.json([]);
    }

    // Get user's branch assignment from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', authResult.user.id)
      .single();
    
    if (userError) {
      // Row might not exist yet (e.g. newly created staff); treat as no branch assigned
      console.warn('⚠️ users-table lookup failed (treating as no branch):', userError.message);
      return c.json([]);
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
        branchId: branch.id,  // always the real branch UUID
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

    // Admin / Health Officer accounts manage inventory per branch via the
    // PUT /inventory/update-branch/:userId endpoint — skip direct sync for them
    const callerRole = authResult.user.user_metadata?.role;
    if (callerRole === 'Administrator' || callerRole === 'Health Officer') {
      console.log('ℹ️ Admin/HO account — skipping direct inventory sync (no personal branch)');
      return c.json({ success: true, itemCount: 0, skipped: true });
    }

    const supabase = getSupabaseClient();
    
    // Get user's branch
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', authResult.user.id)
      .single();
    
    if (userError) {
      // Row missing — treat as no branch rather than crashing
      console.warn('⚠️ users-table lookup failed for sync (treating as no branch):', userError.message);
      return c.json({ success: true, itemCount: 0, skipped: true });
    }
    
    if (!userData?.branch_id) {
      console.log('⚠️ User has no branch assigned — skipping sync');
      return c.json({ success: true, itemCount: 0, skipped: true });
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

    const targetId = c.req.param('userId');
    const { inventory } = await c.req.json();
    
    if (!Array.isArray(inventory)) {
      return c.json({ error: 'Invalid inventory format' }, 400);
    }

    console.log(`💾 Admin/HO updating inventory for id: ${targetId}`);
    console.log(`📦 Inventory items: ${inventory.length}`);
    
    const supabase = getSupabaseClient();

    // Resolve branch_id: first try as a user id in the users table
    let branchId: string | null = null;

    const { data: userData } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', targetId)
      .single();

    if (userData?.branch_id) {
      branchId = userData.branch_id;
      console.log(`✅ Resolved branch_id via users table: ${branchId}`);
    } else {
      // Fallback: targetId might already BE the branch_id (returned when no user is linked)
      const { data: branchData } = await supabase
        .from('branches')
        .select('id')
        .eq('id', targetId)
        .single();

      if (branchData) {
        branchId = targetId;
        console.log(`✅ Using targetId directly as branch_id: ${branchId}`);
      }
    }

    if (!branchId) {
      console.error(`❌ Could not resolve branch for id: ${targetId}`);
      return c.json({ error: 'Branch not found' }, 404);
    }
    
    // Delete existing inventory for this branch
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('branch_id', branchId);
    
    if (deleteError) {
      console.error('❌ Error deleting old inventory:', deleteError);
      return c.json({ error: 'Failed to update inventory' }, 500);
    }
    
    // Insert new inventory items
    if (inventory.length > 0) {
      const inventoryRecords = inventory.map((item: any) => ({
        branch_id: branchId,
        drug_name: item.drugName || item.drug_name || 'Unknown',
        generic_name: item.genericName || item.generic_name || null,
        dosage: item.dosage || null,
        quantity: item.quantity !== undefined ? item.quantity 
          : (item.beginningInventory !== undefined ? (item.beginningInventory + (item.quantityReceived || 0) - (item.quantityDispensed || 0)) : 0),
        expiry_date: item.expirationDate || item.expiry_date || item.expiryDate || null,
        batch_number: item.batchNumber || item.batch_number || null,
        supplier: item.supplier || null,
        unit_price: item.unitCost || item.unit_price || item.unitPrice || null,
        beginning_inventory: item.beginningInventory || item.beginning_inventory || 0,
        quantity_received: item.quantityReceived || item.quantity_received || 0,
        date_received: item.dateReceived || item.date_received || null,
        quantity_dispensed: item.quantityDispensed || item.quantity_dispensed || 0,
        expiration_date: item.expirationDate || item.expiration_date || item.expiry_date || null,
        unit_cost: item.unitCost || item.unit_cost || item.unit_price || null,
      }));
      
      const { error: insertError } = await supabase
        .from('inventory')
        .insert(inventoryRecords);
      
      if (insertError) {
        console.error('❌ Error inserting inventory:', insertError);
        return c.json({ error: 'Failed to save inventory' }, 500);
      }
    }
    
    console.log(`✅ Successfully updated inventory for branch ${branchId}`);
    
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

    const { name, profilePicture, userId, branch, branchContact, branchLocation } = await c.req.json();
    
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

    // Try to get the auth user — userId might be a branch UUID when no user is linked to the branch
    const { data: targetUser, error: getUserError } = await supabase.auth.admin.getUserById(targetUserId);

    if (getUserError || !targetUser?.user) {
      // targetUserId is a branch UUID, not an auth user. Update the branches table directly.
      console.log(`⚠️ No auth user for id ${targetUserId} — treating as branch UUID, updating branches table`);
      const branchUpdates: any = {};
      if (name !== undefined) branchUpdates.contact_person = name;
      if (branchContact !== undefined) branchUpdates.contact_phone = branchContact;
      if (branchLocation !== undefined) branchUpdates.location = branchLocation;

      if (Object.keys(branchUpdates).length > 0) {
        const { error: branchUpdateError } = await supabase
          .from('branches')
          .update(branchUpdates)
          .eq('id', targetUserId);

        if (branchUpdateError) {
          console.error('❌ Error updating branch table:', branchUpdateError);
          return c.json({ error: branchUpdateError.message }, 400);
        }
      }

      console.log(`✅ Updated branch record for: ${targetUserId}`);
      return c.json({ success: true });
    }

    const currentMetadata = targetUser.user.user_metadata || {};
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      targetUserId,
      {
        user_metadata: {
          ...currentMetadata,
          name: name !== undefined ? name : currentMetadata.name,
          profilePicture: profilePicture !== undefined ? profilePicture : currentMetadata.profilePicture,
          branch: branch !== undefined ? branch : currentMetadata.branch,
          branchContact: branchContact !== undefined ? branchContact : currentMetadata.branchContact,
          branchLocation: branchLocation !== undefined ? branchLocation : currentMetadata.branchLocation,
        }
      }
    );

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Also sync contact info to the branches table so all-branches returns updated data
    const { data: userRow } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', targetUserId)
      .single();

    if (userRow?.branch_id) {
      const branchUpdates: any = {};
      if (name !== undefined) branchUpdates.contact_person = name;
      if (branchContact !== undefined) branchUpdates.contact_phone = branchContact;
      if (branchLocation !== undefined) branchUpdates.location = branchLocation;
      if (Object.keys(branchUpdates).length > 0) {
        await supabase.from('branches').update(branchUpdates).eq('id', userRow.branch_id);
      }
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

app.put("/make-server-c88a69d7/branches/:branchId/contact", async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const { contactPhone, contactPerson, contactEmail } = await c.req.json();
    const supabase = getSupabaseClient();

    const updateFields: Record<string, string> = {};
    if (contactPhone !== undefined) updateFields.contact_phone = contactPhone;
    if (contactPerson !== undefined) updateFields.contact_person = contactPerson;
    if (contactEmail !== undefined) updateFields.contact_email = contactEmail;

    const { data, error } = await supabase
      .from('branches')
      .update(updateFields)
      .eq('id', branchId)
      .select('id, name, contact_phone, contact_person, contact_email')
      .single();

    if (error) {
      console.error('❌ Error updating branch contact:', error);
      return c.json({ error: 'Failed to update branch contact info' }, 500);
    }

    console.log(`✅ Updated contact for branch: ${data.name}`);
    return c.json({
      success: true,
      branch: {
        id: data.id,
        name: data.name,
        contactPhone: data.contact_phone || '',
        contactPerson: data.contact_person || '',
        contactEmail: data.contact_email || '',
      }
    });
  } catch (err) {
    console.error("❌ Update branch contact error:", err);
    return c.json({ error: "Failed to update branch contact info" }, 500);
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

    // DOH Philippine Health Program sample medicine data
    const sampleMedicines = [
      // EREID Program — Antimicrobials
      { drug_name: 'Doxycycline', generic_name: 'Doxycycline Hyclate', dosage: '100mg capsule', quantity: 7000, expiry_date: '2027-11-30', batch_number: 'DOX-2025-001', supplier: 'DOH Central Warehouse', unit_price: 1.37, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Cetirizine Dihydrochloride', generic_name: 'Cetirizine Dihydrochloride', dosage: '1mg/ml, 60ml syrup', quantity: 200, expiry_date: '2028-05-31', batch_number: 'CET-2025-045', supplier: 'DOH Central Warehouse', unit_price: 48.00, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Azithromycin', generic_name: 'Azithromycin', dosage: '500mg tablet', quantity: 1000, expiry_date: '2027-09-15', batch_number: 'AZI-2025-010', supplier: 'DOH Central Warehouse', unit_price: 18.50, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Amoxicillin', generic_name: 'Amoxicillin Trihydrate', dosage: '500mg capsule', quantity: 3000, expiry_date: '2027-06-30', batch_number: 'AMX-2025-020', supplier: 'DOH Central Warehouse', unit_price: 4.25, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Co-trimoxazole', generic_name: 'Sulfamethoxazole + Trimethoprim', dosage: '400mg/80mg tablet', quantity: 2000, expiry_date: '2027-08-31', batch_number: 'COT-2025-031', supplier: 'DOH Central Warehouse', unit_price: 2.75, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Ciprofloxacin', generic_name: 'Ciprofloxacin HCl', dosage: '500mg tablet', quantity: 1500, expiry_date: '2027-12-31', batch_number: 'CIP-2025-044', supplier: 'DOH Central Warehouse', unit_price: 6.50, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Metronidazole', generic_name: 'Metronidazole', dosage: '500mg tablet', quantity: 2500, expiry_date: '2027-10-31', batch_number: 'MET-2025-057', supplier: 'DOH Central Warehouse', unit_price: 3.20, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Clindamycin', generic_name: 'Clindamycin HCl', dosage: '300mg capsule', quantity: 800, expiry_date: '2027-07-31', batch_number: 'CLI-2025-062', supplier: 'DOH Central Warehouse', unit_price: 9.80, program: 'EREID Program', category: 'Antimicrobial' },
      { drug_name: 'Rifampicin', generic_name: 'Rifampicin', dosage: '600mg capsule', quantity: 500, expiry_date: '2027-03-31', batch_number: 'RIF-2025-075', supplier: 'DOH Central Warehouse', unit_price: 22.00, program: 'TB Program', category: 'Antimicrobial' },
      { drug_name: 'Isoniazid', generic_name: 'Isoniazid', dosage: '300mg tablet', quantity: 600, expiry_date: '2027-04-30', batch_number: 'INH-2025-081', supplier: 'DOH Central Warehouse', unit_price: 4.50, program: 'TB Program', category: 'Antimicrobial' },

      // NIP — National Immunization Program
      { drug_name: 'Bacillus Calmette-Guérin (BCG)', generic_name: 'BCG Vaccine', dosage: '1 vial (10 doses)', quantity: 375, expiry_date: '2026-01-30', batch_number: 'BCG-2025-089', supplier: 'DOH NIP Warehouse', unit_price: 212.93, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Hepatitis B Vaccine', generic_name: 'Hepatitis B Vaccine (rDNA)', dosage: '1 vial (1 dose, pediatric)', quantity: 97, expiry_date: '2027-09-30', batch_number: 'HEP-2025-234', supplier: 'DOH NIP Warehouse', unit_price: 141.15, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Human Papilloma Vaccine (HPV)', generic_name: 'HPV Recombinant Vaccine', dosage: '1 vial (1 dose)', quantity: 331, expiry_date: '2026-11-19', batch_number: 'HPV-2024-112', supplier: 'DOH NIP Warehouse', unit_price: 716.37, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Inactivated Polio Vaccine (IPV)', generic_name: 'Inactivated Poliovirus Vaccine', dosage: '1 vial (10 doses)', quantity: 984, expiry_date: '2026-10-31', batch_number: 'IPV-2025-067', supplier: 'DOH NIP Warehouse', unit_price: 1190.00, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Pentavalent Vaccine', generic_name: 'DPT-HepB-Hib Vaccine', dosage: '1 vial (1 dose)', quantity: 10, expiry_date: '2027-07-31', batch_number: 'PEN-2025-189', supplier: 'DOH NIP Warehouse', unit_price: 67.55, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Pneumococcal Conjugate Vaccine (PCV10)', generic_name: 'Pneumococcal Conjugate Vaccine', dosage: '1 vial (4 doses)', quantity: 686, expiry_date: '2026-12-31', batch_number: 'PCV-2025-223', supplier: 'DOH NIP Warehouse', unit_price: 1225.60, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Tetanus-Diphtheria Vaccine', generic_name: 'Td Vaccine', dosage: '1 vial (10 doses)', quantity: 440, expiry_date: '2026-12-31', batch_number: 'TET-2025-334', supplier: 'DOH NIP Warehouse', unit_price: 1200.00, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Measles and Rubella (MR) Vaccine', generic_name: 'MR Vaccine (live attenuated)', dosage: '1 vial (10 doses)', quantity: 0, expiry_date: '2026-08-31', batch_number: 'MRV-2024-012', supplier: 'DOH NIP Warehouse', unit_price: 472.44, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },
      { drug_name: 'Oral Polio Vaccine (OPV)', generic_name: 'Oral Poliovirus Vaccine (trivalent)', dosage: '1 vial (20 doses)', quantity: 250, expiry_date: '2026-09-30', batch_number: 'OPV-2025-098', supplier: 'DOH NIP Warehouse', unit_price: 185.00, program: 'NIP-National Immunization Program', category: 'Non-antimicrobial' },

      // Maternal & Child Health / Others
      { drug_name: 'Ferrous Sulfate', generic_name: 'Ferrous Sulfate', dosage: '325mg tablet', quantity: 5000, expiry_date: '2028-06-30', batch_number: 'FER-2025-110', supplier: 'DOH Central Warehouse', unit_price: 1.10, program: 'Maternal & Child Health', category: 'Non-antimicrobial' },
      { drug_name: 'Folic Acid', generic_name: 'Folic Acid', dosage: '1mg tablet', quantity: 4000, expiry_date: '2028-03-31', batch_number: 'FOL-2025-122', supplier: 'DOH Central Warehouse', unit_price: 0.95, program: 'Maternal & Child Health', category: 'Non-antimicrobial' },
      { drug_name: 'Vitamin A', generic_name: 'Retinol (Vitamin A)', dosage: '200,000 IU capsule', quantity: 800, expiry_date: '2027-12-31', batch_number: 'VIT-2025-135', supplier: 'DOH Central Warehouse', unit_price: 5.60, program: 'Micronutrient Supplementation', category: 'Non-antimicrobial' },
      { drug_name: 'Zinc Sulfate', generic_name: 'Zinc Sulfate', dosage: '20mg dispersible tablet', quantity: 3000, expiry_date: '2027-09-30', batch_number: 'ZNS-2025-148', supplier: 'DOH Central Warehouse', unit_price: 2.30, program: 'Micronutrient Supplementation', category: 'Non-antimicrobial' },
      { drug_name: 'Oral Rehydration Salts (ORS)', generic_name: 'Oral Rehydration Salts', dosage: '1 sachet (1L)', quantity: 2000, expiry_date: '2028-01-31', batch_number: 'ORS-2025-157', supplier: 'DOH Central Warehouse', unit_price: 8.50, program: 'Diarrhea Management', category: 'Non-antimicrobial' },
      { drug_name: 'Paracetamol', generic_name: 'Acetaminophen', dosage: '500mg tablet', quantity: 5000, expiry_date: '2027-12-31', batch_number: 'PAR-2025-001', supplier: 'DOH Central Warehouse', unit_price: 1.50, program: 'General', category: 'Others' },
      { drug_name: 'Oxytocin', generic_name: 'Oxytocin', dosage: '10 IU/mL, 1mL ampoule', quantity: 300, expiry_date: '2026-06-30', batch_number: 'OXY-2025-168', supplier: 'DOH Central Warehouse', unit_price: 35.00, program: 'Safe Motherhood', category: 'Others' },
      { drug_name: 'Magnesium Sulfate', generic_name: 'Magnesium Sulfate', dosage: '50% solution, 10mL vial', quantity: 200, expiry_date: '2027-06-30', batch_number: 'MGS-2025-179', supplier: 'DOH Central Warehouse', unit_price: 55.00, program: 'Safe Motherhood', category: 'Others' },
      { drug_name: 'Artemether + Lumefantrine', generic_name: 'Artemether + Lumefantrine', dosage: '20mg/120mg tablet', quantity: 600, expiry_date: '2027-05-31', batch_number: 'ART-2025-190', supplier: 'DOH Central Warehouse', unit_price: 12.75, program: 'Malaria Program', category: 'Antimicrobial' },
      { drug_name: 'Salbutamol Sulfate', generic_name: 'Salbutamol Sulfate', dosage: '2mg/5ml syrup, 60ml', quantity: 500, expiry_date: '2027-08-31', batch_number: 'SAL-2025-202', supplier: 'DOH Central Warehouse', unit_price: 28.00, program: 'EREID Program', category: 'Non-antimicrobial' },
      { drug_name: 'Betamethasone', generic_name: 'Betamethasone Valerate', dosage: '4mg/mL, 1mL ampoule', quantity: 150, expiry_date: '2027-01-31', batch_number: 'BET-2025-215', supplier: 'DOH Central Warehouse', unit_price: 65.00, program: 'Safe Motherhood', category: 'Others' },
    ];

    let totalItemsAdded = 0;
    const results: Array<{ branchName: string; itemsAdded: number; status: string }> = [];

    // For each branch, add the sample medicines
    for (const branch of branches) {
      try {
        // Prepare inventory records with branch_id
        // Strip fields not present in the inventory table schema (category, program)
        const inventoryRecords = sampleMedicines.map(({ category, program, ...med }) => ({
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

// ─── Forgot Password via Resend (custom token — no Supabase OTP) ──────────────
app.post("/make-server-c88a69d7/forgot-password", async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY is not set");
      return c.json({ error: "Email service is not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify user exists (silently succeed if not — prevents email enumeration)
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const user = listData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      console.log("⚠️ Forgot-password: user not found, silently succeeding:", email);
      return c.json({ success: true });
    }

    // Generate a cryptographically secure 32-byte (64 hex char) token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Store token in KV table with 1-hour expiry
    const kvKey = `reset_token:${token}`;
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now
    const { error: kvError } = await supabase.from("kv_store_c88a69d7").upsert({
      key: kvKey,
      value: { email: email.toLowerCase(), expires_at: expiresAt },
    });
    if (kvError) {
      console.error("❌ Failed to store reset token:", kvError);
      return c.json({ error: "Failed to generate reset token", details: kvError.message }, 500);
    }

    // Build reset link — goes directly to our app, no Supabase OTP/verify endpoint
    const resetLink = "https://mediflowph.com/?reset_token=" + token;
    console.log("🔗 Custom reset link generated for:", email);

    // Build HTML email
    const htmlParts: string[] = [];
    htmlParts.push("<!DOCTYPE html><html><head>");
    htmlParts.push('<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />');
    htmlParts.push("</head><body style=\"margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;\">");
    htmlParts.push('<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;"><tr><td align="center">');
    htmlParts.push('<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">');
    htmlParts.push('<tr><td style="background:#9867C5;padding:32px 40px;text-align:center;">');
    htmlParts.push('<div style="font-size:28px;font-weight:800;color:#ffffff;">MediFlow</div>');
    htmlParts.push('<div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Drug Inventory Management System</div>');
    htmlParts.push("</td></tr>");
    htmlParts.push('<tr><td style="padding:40px;">');
    htmlParts.push('<h2 style="margin:0 0 8px;font-size:22px;color:#1f2937;">Reset your password</h2>');
    htmlParts.push('<p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">');
    htmlParts.push("We received a request to reset the password for your MediFlow account associated with ");
    htmlParts.push('<strong style="color:#374151;">');
    htmlParts.push(email);
    htmlParts.push("</strong>.<br /><br />Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>");
    htmlParts.push('<div style="text-align:center;margin-bottom:28px;">');
    htmlParts.push('<a href="');
    htmlParts.push(resetLink);
    htmlParts.push('" style="display:inline-block;background:#9867C5;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;">Reset Password</a>');
    htmlParts.push("</div>");
    htmlParts.push('<p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-align:center;">Or copy and paste this link:</p>');
    htmlParts.push('<p style="margin:0;font-size:11px;color:#9867C5;text-align:center;word-break:break-all;">');
    htmlParts.push(resetLink);
    htmlParts.push("</p></td></tr>");
    htmlParts.push('<tr><td style="background:#fef9c3;padding:16px 40px;border-top:1px solid #fde68a;">');
    htmlParts.push('<p style="margin:0;font-size:11px;color:#92400e;text-align:center;"><strong>OFFICIAL DOH INVENTORY PORTAL</strong> &middot; If you did not request this, ignore this email.</p>');
    htmlParts.push("</td></tr></table></td></tr></table></body></html>");
    const htmlBody = htmlParts.join("");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "MediFlow <noreply@mediflowph.com>",
        to: [email],
        subject: "MediFlow - Reset Your Password",
        html: htmlBody,
      }),
    });

    const resendBody = await emailResponse.text();

    if (!emailResponse.ok) {
      console.error("❌ Resend API error (HTTP " + emailResponse.status + "):", resendBody);
      return c.json({
        error: "Failed to send reset email via Resend",
        details: resendBody,
        httpStatus: emailResponse.status,
      }, 500);
    }

    console.log("✅ Password reset email sent via Resend to:", email);
    return c.json({ success: true });
  } catch (err: any) {
    console.error("❌ Forgot password unexpected error:", err);
    return c.json({ error: "Unexpected error in forgot-password", details: err.message }, 500);
  }
});

// ─── Reset Password (validate custom KV token, update via admin API) ───────────
app.post("/make-server-c88a69d7/reset-password", async (c) => {
  try {
    const { token, password } = await c.req.json();

    if (!token || !password) {
      return c.json({ error: "Token and password are required" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Look up token in KV
    const kvKey = `reset_token:${token}`;
    const { data: kvRow, error: kvError } = await supabase
      .from("kv_store_c88a69d7")
      .select("value")
      .eq("key", kvKey)
      .maybeSingle();

    if (kvError) {
      console.error("❌ KV lookup error:", kvError);
      return c.json({ error: "Failed to verify token", details: kvError.message }, 500);
    }

    if (!kvRow?.value) {
      console.warn("⚠️ Reset token not found or already used");
      return c.json({ error: "Invalid or already used reset link. Please request a new one." }, 400);
    }

    const { email, expires_at } = kvRow.value as { email: string; expires_at: number };

    // Check expiry
    if (Date.now() > expires_at) {
      await supabase.from("kv_store_c88a69d7").delete().eq("key", kvKey);
      console.warn("⚠️ Reset token expired for:", email);
      return c.json({ error: "This reset link has expired. Please request a new one." }, 400);
    }

    // Find the user by email
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      console.error("❌ Error listing users:", listError);
      return c.json({ error: "Failed to locate user account", details: listError.message }, 500);
    }

    const user = listData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      console.error("❌ User not found for email:", email);
      return c.json({ error: "User account not found" }, 404);
    }

    // Update password via admin API — no Supabase session required
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (updateError) {
      console.error("❌ Password update error:", updateError);
      return c.json({ error: "Failed to update password", details: updateError.message }, 500);
    }

    // Delete token so it cannot be reused
    await supabase.from("kv_store_c88a69d7").delete().eq("key", kvKey);

    console.log("✅ Password successfully reset for:", email);
    return c.json({ success: true });
  } catch (err: any) {
    console.error("❌ Reset password unexpected error:", err);
    return c.json({ error: "Unexpected error in reset-password", details: err.message }, 500);
  }
});

Deno.serve(app.fetch);