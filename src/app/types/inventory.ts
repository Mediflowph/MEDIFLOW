export interface InventoryBatch {
  id: string;
  drugName: string;
  program: string;
  dosage: string;
  unit: string;
  batchNumber: string;
  beginningInventory: number;
  quantityReceived: number;
  dateReceived: string;
  unitCost: number;
  quantityDispensed: number;
  expirationDate: string;
  remarks: string;
  branchId?: string; // Branch identifier for multi-branch tracking
}

export interface DrugSummary {
  drugName: string;
  totalStock: number;
  totalBatches: number;
  earliestExpiry: string;
  utilization: number;
  batches: InventoryBatch[];
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  drugName: string;
  batchNumber: string;
  message: string;
  daysUntilExpiry?: number;
  time: string;
  branchId?: string;
  branchName?: string;
}

export interface DispenseRecord {
  id: string;
  drugName: string;
  batchNumber: string;
  quantity: number;
  user: string;
  date: string;
  branchId?: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  contactPerson: string;
  contactNumber: string;
}

export interface BranchInventorySummary {
  branchId: string;
  branchName: string;
  totalItems: number;
  lowStockCount: number;
  expiredCount: number;
  nearExpiryCount: number;
  lastUpdated: string;
}