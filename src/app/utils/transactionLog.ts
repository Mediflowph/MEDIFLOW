import { projectId, publicAnonKey } from '@/../utils/supabase/info';

export interface Transaction {
  id: string;
  type: 'receive' | 'dispense';
  drugName: string;
  dosage: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  timestamp: string;
  branchId: string;
  branchName: string;
  userName: string;
  userId: string;
}

// Local storage key for transactions
const STORAGE_KEY_PREFIX = 'mediflow_transactions_';

/**
 * Save transaction to localStorage
 */
function saveToLocalStorage(transaction: Transaction) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${transaction.branchId}`;
    const existing = localStorage.getItem(key);
    const transactions: Transaction[] = existing ? JSON.parse(existing) : [];

    // Add new transaction
    transactions.unshift(transaction);

    // Keep only last 100 transactions to avoid storage limits
    const trimmed = transactions.slice(0, 100);

    localStorage.setItem(key, JSON.stringify(trimmed));
    console.log(`💾 Transaction saved to localStorage: ${transaction.type} - ${transaction.drugName}`);
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

/**
 * Load transactions from localStorage
 */
function loadFromLocalStorage(branchId: string, days: number): Transaction[] {
  try {
    const key = `${STORAGE_KEY_PREFIX}${branchId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return [];

    const transactions: Transaction[] = JSON.parse(stored);

    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return transactions.filter(t => new Date(t.timestamp) >= cutoffDate);
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return [];
  }
}

/**
 * Log a transaction (receive or dispense)
 * Saves to localStorage as primary storage (backend endpoints not yet implemented)
 */
export async function logTransaction(
  type: 'receive' | 'dispense',
  drugInfo: {
    drugName: string;
    dosage: string;
    batchNumber: string;
    quantity: number;
    unit: string;
  },
  branchInfo: {
    branchId: string;
    branchName: string;
    userName: string;
    userId: string;
  },
  userToken: string
): Promise<boolean> {
  try {
    const transaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      drugName: drugInfo.drugName,
      dosage: drugInfo.dosage,
      batchNumber: drugInfo.batchNumber,
      quantity: drugInfo.quantity,
      unit: drugInfo.unit,
      timestamp: new Date().toISOString(),
      branchId: branchInfo.branchId,
      branchName: branchInfo.branchName,
      userName: branchInfo.userName,
      userId: branchInfo.userId,
    };

    // Save to localStorage (primary storage for now)
    saveToLocalStorage(transaction);

    // Try to save to backend (optional - will fail silently if endpoint doesn't exist)
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/transactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': userToken,
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            type,
            drug_name: drugInfo.drugName,
            dosage: drugInfo.dosage,
            batch_number: drugInfo.batchNumber,
            quantity: drugInfo.quantity,
            unit: drugInfo.unit,
            branch_id: branchInfo.branchId,
            branch_name: branchInfo.branchName,
            user_name: branchInfo.userName,
            user_id: branchInfo.userId,
            timestamp: transaction.timestamp,
          }),
        }
      );

      if (response.ok) {
        console.log(`✅ Transaction logged to backend: ${type} - ${drugInfo.drugName} (${drugInfo.quantity})`);
      }
    } catch (backendError) {
      // Silently fail - localStorage is the primary storage
      console.log('ℹ️ Backend transaction logging not available (using localStorage)');
    }

    return true;
  } catch (error) {
    console.error('Error logging transaction:', error);
    return false;
  }
}

/**
 * Fetch transaction history for a branch
 * Uses localStorage as primary source (backend endpoints not yet implemented)
 */
export async function fetchTransactionHistory(
  branchId: string,
  userToken: string,
  days: number = 30
): Promise<Transaction[]> {
  try {
    // Try backend first
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c88a69d7/transactions/${branchId}?days=${days}`,
        {
          headers: {
            'X-User-Token': userToken,
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`📡 Loaded ${data.length} transactions from backend`);
        return data.map((t: any) => ({
          id: t.id,
          type: t.type,
          drugName: t.drug_name,
          dosage: t.dosage || '',
          batchNumber: t.batch_number || '',
          quantity: t.quantity,
          unit: t.unit || 'units',
          timestamp: t.timestamp || t.created_at,
          branchId: t.branch_id,
          branchName: t.branch_name || '',
          userName: t.user_name || '',
          userId: t.user_id || '',
        }));
      }
    } catch (backendError) {
      // Backend not available, use localStorage
      console.log('ℹ️ Backend transaction history not available (using localStorage)');
    }

    // Load from localStorage
    const localTransactions = loadFromLocalStorage(branchId, days);
    console.log(`💾 Loaded ${localTransactions.length} transactions from localStorage`);
    return localTransactions;

  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }
}
