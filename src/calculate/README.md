# 3D Bin Packing API

This service provides advanced 3D bin packing calculations for optimizing package placement in baskets/containers.

## Overview

The Calculate Service uses a sophisticated 3D bin packing algorithm with multiple packing strategies:

1. **Primary Strategy** - Standard packing with full stability checks
2. **Relaxed Stability** - Reduced stability requirements for better fit
3. **Minimal Stability** - Basic stability with maximum fitting
4. **Basic Packing** - No stability checks, pure geometric fitting

## API Endpoints

### POST /calculate/packing
Calculate optimal packing for packages in a specific basket.

**Request Body:**
```json
{
  "packages": [
    {
      "_id": "pkg1",
      "product_id": "product1",
      "weight": 1.5,
      "dimensions": {
        "width": 10,
        "height": 5,
        "depth": 8
      },
      "quantity": 2,
      "package_type": "Box",
      "package_status": "Ready",
      "cost": 15.0
    }
  ],
  "basket": {
    "basket_size_id": "medium",
    "dimensions": {
      "width": 30,
      "height": 20,
      "depth": 25
    },
    "max_weight": 10.0,
    "cost": 40.0
  }
}
```

**Response:**
```json
{
  "success": true,
  "strategy_used": "Primary Strategy",
  "fitted_items": 2,
  "total_items": 2,
  "fitted_packages": [
    {
      "package_id": "pkg1_0",
      "position": [0, 0, 0],
      "rotation_type": 0,
      "dimensions": [10, 5, 8]
    },
    {
      "package_id": "pkg1_1", 
      "position": [10, 0, 0],
      "rotation_type": 0,
      "dimensions": [10, 5, 8]
    }
  ],
  "unfitted_packages": [],
  "total_weight": 3.0,
  "total_volume": 800,
  "basket_utilization": 5.33
}
```

### POST /calculate/optimal-basket
Find the best basket size from multiple options.

**Request Body:**
```json
{
  "packages": [...], // Array of packages
  "baskets": [...] // Array of basket options
}
```

**Response:**
```json
{
  "optimal_basket": {
    "basket_size_id": "medium",
    "dimensions": { "width": 30, "height": 20, "depth": 25 },
    "max_weight": 10.0,
    "cost": 40.0
  },
  "packing_result": {
    "success": true,
    "strategy_used": "Primary Strategy",
    "fitted_items": 2,
    "total_items": 2,
    // ... full packing result
  },
  "alternatives": [
    {
      "basket": { /* basket info */ },
      "result": { /* packing result */ }
    }
  ]
}
```

### POST /calculate/stats
Get statistical analysis of packages.

**Request Body:**
```json
{
  "packages": [...] // Array of packages
}
```

**Response:**
```json
{
  "total_packages": 5,
  "total_weight": 7.8,
  "total_volume": 1200,
  "heaviest_package": 2.5,
  "largest_package": 400,
  "average_density": 0.0065
}
```

### GET /calculate/health
Service health check.

**Response:**
```json
{
  "status": "ok",
  "service": "Calculate Service", 
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Algorithm Features

### Rotation Support
- Items can be rotated in 3D space for optimal fitting
- Configurable rotation restrictions (updown, no updown)
- Multiple rotation types (0-5) for different orientations

### Stability Checking  
- Advanced gravity center calculations
- Support surface ratio validation
- Load bearing capacity checks
- Configurable stability thresholds

### Multi-Strategy Approach
The algorithm tries multiple strategies in order:
1. Primary strategy with full checks
2. Relaxed stability requirements  
3. Minimal stability for maximum fit
4. Basic geometric packing as fallback

### 3D Positioning
- Precise 3D coordinate tracking
- Intersection detection to prevent overlaps
- Optimal placement along width/height/depth axes
- Volume utilization optimization

## Usage Examples

### Basic Packing Calculation
```typescript
const packages = [
  {
    _id: 'pkg1',
    product_id: 'product1', 
    weight: 1.0,
    dimensions: { width: 10, height: 5, depth: 8 },
    quantity: 1,
    package_type: 'Box',
    package_status: 'Ready',
    cost: 15.0
  }
];

const basket = {
  basket_size_id: 'medium',
  dimensions: { width: 30, height: 20, depth: 15 },
  max_weight: 10.0,
  cost: 50.0
};

const result = await calculateService.calculatePacking(packages, basket);
```

### Finding Optimal Basket
```typescript
const baskets = [
  {
    basket_size_id: 'small',
    dimensions: { width: 20, height: 15, depth: 12 },
    max_weight: 5.0,
    cost: 25.0
  },
  {
    basket_size_id: 'large', 
    dimensions: { width: 40, height: 30, depth: 25 },
    max_weight: 15.0,
    cost: 60.0
  }
];

const optimal = await calculateService.findOptimalBasket(packages, baskets);
```

## Integration Notes

- Fully integrated with existing NestJS schemas (packages, baskets)
- Compatible with MongoDB/Mongoose data structures
- Supports bulk package processing with quantities
- Handles weight and volume constraints
- Provides detailed positioning data for visualization
- Includes comprehensive error handling and validation

## Performance Considerations

- Algorithm complexity scales with number of packages and rotation options
- Multiple strategies provide fallback options for difficult packing scenarios
- Results include strategy used for performance analysis
- Utilization metrics help evaluate packing efficiency
