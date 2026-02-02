import { InventoryBatch } from '@/app/types/inventory';

/**
 * Pharmacy Standard Reorder Point Calculation
 * 
 * Formula: Reorder Point = (Average Daily Usage × Lead Time) + Safety Stock
 * 
 * Parameters:
 * - Lead Time: 14 days (standard for government pharmaceutical procurement)
 * - Safety Stock: 30% of calculated reorder point (buffer for demand variations)
 * - Minimum Threshold: 20 units (for low-volume medications)
 */

export interface ReorderPointConfig {
  leadTimeDays: number;
  safetyStockPercentage: number;
  minimumThreshold: number;
}

// Default configuration based on DOH/pharmacy standards
export const DEFAULT_REORDER_CONFIG: ReorderPointConfig = {
  leadTimeDays: 14, // 2 weeks lead time for procurement
  safetyStockPercentage: 0.3, // 30% safety buffer
  minimumThreshold: 20, // Minimum 20 units for all medications
};

/**
 * Calculate average daily usage from dispensing history
 * @param batch - Inventory batch with dispensing data
 * @param daysSinceReceived - Number of days since batch was received
 * @returns Average daily usage
 */
export function calculateAverageDailyUsage(
  batch: InventoryBatch,
  daysSinceReceived?: number
): number {
  const totalDispensed = batch.quantityDispensed || 0;
  
  if (totalDispensed === 0) {
    return 0; // No usage history
  }

  // Calculate days since receipt
  const receivedDate = new Date(batch.dateReceived);
  const today = new Date();
  const days = daysSinceReceived || Math.floor((today.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (days <= 0) {
    return 0;
  }

  return totalDispensed / days;
}

/**
 * Calculate reorder point for a medication batch
 * @param batch - Inventory batch
 * @param config - Optional custom configuration
 * @returns Reorder point quantity
 */
export function calculateReorderPoint(
  batch: InventoryBatch,
  config: ReorderPointConfig = DEFAULT_REORDER_CONFIG
): number {
  // Calculate average daily usage
  const avgDailyUsage = calculateAverageDailyUsage(batch);

  if (avgDailyUsage === 0) {
    // No usage history - use minimum threshold
    return config.minimumThreshold;
  }

  // Reorder Point = (Avg Daily Usage × Lead Time) + Safety Stock
  const baseReorderPoint = avgDailyUsage * config.leadTimeDays;
  const safetyStock = baseReorderPoint * config.safetyStockPercentage;
  const calculatedReorderPoint = Math.ceil(baseReorderPoint + safetyStock);

  // Ensure it meets minimum threshold
  return Math.max(calculatedReorderPoint, config.minimumThreshold);
}

/**
 * Check if a batch is below reorder point (low stock)
 * @param batch - Inventory batch
 * @param config - Optional custom configuration
 * @returns True if stock is below reorder point
 */
export function isLowStock(
  batch: InventoryBatch,
  config: ReorderPointConfig = DEFAULT_REORDER_CONFIG
): boolean {
  const currentStock = batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
  
  if (currentStock <= 0) {
    return false; // Out of stock, not "low stock"
  }

  const reorderPoint = calculateReorderPoint(batch, config);
  return currentStock <= reorderPoint;
}

/**
 * Get stock status with reorder point information
 * @param batch - Inventory batch
 * @param config - Optional custom configuration
 * @returns Stock status object
 */
export function getStockStatus(
  batch: InventoryBatch,
  config: ReorderPointConfig = DEFAULT_REORDER_CONFIG
): {
  currentStock: number;
  reorderPoint: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  avgDailyUsage: number;
  daysOfStockRemaining: number;
} {
  const currentStock = batch.beginningInventory + batch.quantityReceived - batch.quantityDispensed;
  const reorderPoint = calculateReorderPoint(batch, config);
  const avgDailyUsage = calculateAverageDailyUsage(batch);
  
  const daysOfStockRemaining = avgDailyUsage > 0 
    ? Math.floor(currentStock / avgDailyUsage)
    : currentStock > 0 ? 999 : 0; // If no usage history, assume long-lasting

  return {
    currentStock,
    reorderPoint,
    isLowStock: currentStock > 0 && currentStock <= reorderPoint,
    isOutOfStock: currentStock === 0,
    avgDailyUsage,
    daysOfStockRemaining,
  };
}

/**
 * Calculate reorder quantity based on stock levels
 * @param batch - Inventory batch
 * @param config - Optional custom configuration
 * @returns Suggested reorder quantity
 */
export function calculateReorderQuantity(
  batch: InventoryBatch,
  config: ReorderPointConfig = DEFAULT_REORDER_CONFIG
): number {
  const status = getStockStatus(batch, config);
  
  if (!status.isLowStock && !status.isOutOfStock) {
    return 0; // No reorder needed
  }

  // Order enough to cover: (Lead Time × 2) + Safety Stock
  // This ensures stock lasts through next delivery cycle
  const avgDailyUsage = status.avgDailyUsage > 0 ? status.avgDailyUsage : 1; // Assume at least 1/day if no history
  const orderQuantity = Math.ceil(
    avgDailyUsage * config.leadTimeDays * 2 + (avgDailyUsage * config.leadTimeDays * config.safetyStockPercentage)
  );

  return Math.max(orderQuantity, config.minimumThreshold);
}
