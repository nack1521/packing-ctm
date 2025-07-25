/**
 * Constants for Main Packing Service
 */

// Packing Configuration
export const PACKING_CONFIG = {
  BASKETS_PER_CART: 4,
  TARGET_UTILIZATION_PERCENTAGE: 85, // Target 85% volume utilization per basket
  MAX_UTILIZATION_PERCENTAGE: 95,   // Maximum 95% before basket is considered full
  ESTIMATED_MINUTES_PER_PACKAGE: 10 // Estimate 10 minutes per package for job duration
} as const;

// Default Dimensions (in cm)
export const DEFAULT_DIMENSIONS = {
  PACKAGE: { width: 10, height: 10, depth: 10 },
  BASKET: { width: 50, height: 50, depth: 50 },
  PRODUCT_WEIGHT: 100, // Default weight in grams
  BASKET_WEIGHT: 1000  // Default basket weight capacity in grams
} as const;

// Dimension Limits (in cm)
export const DIMENSION_LIMITS = {
  MIN: 5,
  MAX_WIDTH: 50,
  MAX_HEIGHT: 30, // Reasonable for most baskets
  MAX_DEPTH: 50
} as const;

// Job Scheduling (in milliseconds)
export const JOB_ARCHIVAL_DELAYS = {
  COMPLETED_JOBS: 60 * 60 * 1000,    // 1 hour
  FAILED_JOBS: 24 * 60 * 60 * 1000   // 24 hours
} as const;

// Volume Calculation
export const VOLUME_CONFIG = {
  MAX_SINGLE_PACKAGE_UTILIZATION: 0.8, // Max 80% of basket for a single package
  DIMENSION_MULTIPLIER: 1 // For reasonable height calculation
} as const;
