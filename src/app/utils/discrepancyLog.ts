export interface Discrepancy {
  id: string;
  batchId: string;
  drugName: string;
  dosage: string;
  batchNumber: string;
  unit: string;
  systemStock: number;
  physicalCount: number;
  variance: number;
  remarks: string;
  timestamp: string;
  branchId: string;
  branchName: string;
  userName: string;
  userId: string;
}

const STORAGE_KEY_PREFIX = 'mediflow_discrepancies_';

/**
 * Save discrepancy to localStorage
 */
export function saveDiscrepancy(discrepancy: Discrepancy): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${discrepancy.branchId}`;
    const existing = localStorage.getItem(key);
    const discrepancies: Discrepancy[] = existing ? JSON.parse(existing) : [];

    // Check if discrepancy for this batch already exists
    const existingIndex = discrepancies.findIndex(d => d.batchId === discrepancy.batchId);

    if (existingIndex >= 0) {
      // Update existing discrepancy
      discrepancies[existingIndex] = discrepancy;
    } else {
      // Add new discrepancy
      discrepancies.unshift(discrepancy);
    }

    // Keep only last 100 discrepancies
    const trimmed = discrepancies.slice(0, 100);

    localStorage.setItem(key, JSON.stringify(trimmed));
    console.log(`💾 Discrepancy saved: ${discrepancy.drugName} (variance: ${discrepancy.variance})`);
  } catch (error) {
    console.error('Failed to save discrepancy:', error);
  }
}

/**
 * Remove discrepancy from localStorage (when variance is resolved to 0)
 */
export function removeDiscrepancy(branchId: string, batchId: string): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${branchId}`;
    const existing = localStorage.getItem(key);
    if (!existing) return;

    const discrepancies: Discrepancy[] = JSON.parse(existing);
    const filtered = discrepancies.filter(d => d.batchId !== batchId);

    localStorage.setItem(key, JSON.stringify(filtered));
    console.log(`🗑️ Discrepancy removed for batch: ${batchId}`);
  } catch (error) {
    console.error('Failed to remove discrepancy:', error);
  }
}

/**
 * Load discrepancies from localStorage
 */
export function loadDiscrepancies(branchId: string, days: number = 30): Discrepancy[] {
  try {
    const key = `${STORAGE_KEY_PREFIX}${branchId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return [];

    const discrepancies: Discrepancy[] = JSON.parse(stored);

    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return discrepancies.filter(d => new Date(d.timestamp) >= cutoffDate);
  } catch (error) {
    console.error('Failed to load discrepancies:', error);
    return [];
  }
}

/**
 * Get all active discrepancies (non-zero variance)
 */
export function getActiveDiscrepancies(branchId: string): Discrepancy[] {
  const allDiscrepancies = loadDiscrepancies(branchId, 30);
  return allDiscrepancies.filter(d => d.variance !== 0);
}
