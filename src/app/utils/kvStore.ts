import { supabase } from './supabase';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';

export interface Branch {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  branchName: string;
  loginTime: string;
  user_id?: string;
  branch_id?: string;
  action?: string;
  details?: any;
  created_at?: string;
}

export const kvStore = {
  /**
   * Fetch all branches from the SQL branches table
   */
  async getBranches(): Promise<Branch[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching branches:', error);
      return [];
    }
    
    return data || [];
  },

  /**
   * Save/create a new branch in the SQL branches table
   */
  async saveBranches(branches: Branch[]): Promise<void> {
    // This is a legacy method - for new branches, use the individual insert
    // For now, we'll just insert any branches that don't have IDs
    for (const branch of branches) {
      if (!branch.id || branch.id.startsWith('temp-')) {
        // New branch - insert it
        const { error } = await supabase
          .from('branches')
          .insert({
            name: branch.name
          });
        
        if (error) {
          console.error('❌ Error saving branch:', error);
          throw error;
        }
      }
    }
  },

  /**
   * Get inventory for a specific branch from SQL inventory table
   */
  async getInventory(branchId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching inventory:', error);
      return [];
    }
    
    return data || [];
  },

  /**
   * Save inventory for a specific branch to SQL inventory table
   */
  async saveInventory(branchId: string, inventory: any[]): Promise<void> {
    // Delete existing inventory for this branch
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('branch_id', branchId);
    
    if (deleteError) {
      console.error('❌ Error deleting old inventory:', deleteError);
      throw deleteError;
    }
    
    // Insert new inventory items if any
    if (inventory.length > 0) {
      const inventoryRecords = inventory.map(item => ({
        branch_id: branchId,
        drug_name: item.drugName || item.drug_name,
        generic_name: item.genericName || item.generic_name || null,
        dosage: item.dosage || null,
        quantity: item.quantity || item.beginningInventory || 0,
        expiry_date: item.expiryDate || item.expiry_date || item.expirationDate || null,
        batch_number: item.batchNumber || item.batch_number || null,
        supplier: item.supplier || null,
        unit_price: item.unitPrice || item.unit_price || item.unitCost || null
      }));
      
      const { error: insertError } = await supabase
        .from('inventory')
        .insert(inventoryRecords);
      
      if (insertError) {
        console.error('❌ Error inserting inventory:', insertError);
        throw insertError;
      }
    }
  },

  /**
   * Fetch all audit logs from SQL audit_logs table
   */
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('❌ Error fetching audit logs:', error);
      return [];
    }
    
    // Transform SQL audit logs to match the AuditLog interface
    return (data || []).map(log => ({
      id: log.id,
      userId: log.user_id,
      userName: log.details?.userName || 'Unknown',
      branchId: log.branch_id || '',
      branchName: log.details?.branchName || 'Unknown',
      loginTime: log.created_at,
      user_id: log.user_id,
      branch_id: log.branch_id,
      action: log.action,
      details: log.details,
      created_at: log.created_at
    }));
  },

  /**
   * Add a new audit log via the server (uses service role key to bypass RLS)
   */
  async addAuditLog(log: Omit<AuditLog, 'id' | 'loginTime'>): Promise<void> {
    try {
      // Call the server endpoint which uses service role key to bypass RLS
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/audit-logs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': (await supabase.auth.getSession()).data.session?.access_token || ''
          },
          body: JSON.stringify(log)
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error adding audit log via server:', errorData);
        throw new Error(errorData.error || 'Failed to add audit log');
      }
      
      console.log('✅ Audit log added successfully via server');
    } catch (error) {
      console.error('❌ Error adding audit log:', error);
      // Don't throw - audit logs shouldn't block the login process
    }
  }
};