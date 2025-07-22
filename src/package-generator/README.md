# Package Generator Service

This service allows you to generate random test packages using existing products from your database.

## Features

✅ Generate random packages from existing products  
✅ Support for both 1:1 (ONE_TO_ONE) and 1:m (ONE_TO_MANY) package types  
✅ **1:1 packages**: Single product per package  
✅ **1:m packages**: Multiple products (2-5) per package  
✅ **Random creation dates**: Between June 2025 - July 2025  
✅ Customizable package counts  
✅ Product-specific distribution generation  
✅ Package statistics and monitoring  
✅ Cleanup utilities for testing  

## API Endpoints

### 1. Generate Random Packages (Default: 80 + 80)

**POST** `/package-generator/generate`

```json
{
  "oneToOneCount": 80,
  "oneToManyCount": 80
}
```

**Response:**
```json
{
  "success": true,
  "generated_packages": 160,
  "breakdown": {
    "one_to_one": 80,
    "one_to_many": 80
  },
  "package_ids": ["673abc...", "673def..."],
  "message": "Successfully generated 80 1:1 packages and 80 1:m packages"
}
```

### 2. Quick Generate (Query Parameters)

**GET** `/package-generator/quick-generate?oneToOne=50&oneToMany=50`

### 3. Generate with Product Distribution

**POST** `/package-generator/generate-with-distribution`

```json
{
  "productDistribution": [
    {
      "product_id": "60d5ecb74b24a9001f647a01",
      "one_to_one_count": 20,
      "one_to_many_count": 30
    },
    {
      "product_id": "60d5ecb74b24a9001f647a02", 
      "one_to_one_count": 60,
      "one_to_many_count": 50
    }
  ]
}
```

### 4. Get All Products

**GET** `/package-generator/products`

Returns all available products for reference:

```json
[
  {
    "_id": "673abc123def456789012345",
    "product_name": "Product A",
    "product_weight": 1.5,
    "dimensions": {
      "width": 10,
      "length": 15,
      "height": 8
    }
  }
]
```

### 5. Get Package Statistics

**GET** `/package-generator/stats`

```json
{
  "total_packages": 160,
  "unpack_packages": 160,
  "one_to_one_packages": 80,
  "one_to_many_packages": 80,
  "processing_packages": 0,
  "packed_packages": 0,
  "available_products": 25
}
```

### 6. Clear Unpack Packages (Testing)

**DELETE** `/package-generator/clear-unpack`

```json
{
  "success": true,
  "deleted_count": 160,
  "message": "Successfully deleted 160 unpack packages"
}
```

## Usage Examples

### Generate Default Test Data (80+80)

```bash
# Using curl
curl -X POST http://localhost:3000/package-generator/generate \
  -H "Content-Type: application/json"

# Using httpie
http POST localhost:3000/package-generator/generate
```

### Generate Custom Amount

```bash
curl -X POST http://localhost:3000/package-generator/generate \
  -H "Content-Type: application/json" \
  -d '{"oneToOneCount": 100, "oneToManyCount": 50}'
```

### Quick Generate with Query Parameters

```bash
curl "http://localhost:3000/package-generator/quick-generate?oneToOne=25&oneToMany=25"
```

### Check Statistics

```bash
curl http://localhost:3000/package-generator/stats
```

### Clear Test Data

```bash
curl -X DELETE http://localhost:3000/package-generator/clear-unpack
```

## How it Works

1. **Product Selection**: The service fetches all available products from the database
2. **Package Type Logic**:
   - **1:1 (ONE_TO_ONE)**: Each package contains exactly 1 random product
   - **1:m (ONE_TO_MANY)**: Each package contains 2-5 random products
3. **Random Date Assignment**: Each package gets a random `createdAt` date between June 1, 2025 and July 31, 2025
4. **Package Creation**: Creates packages with the selected products in the `product_list`
5. **Status Setting**: All generated packages start with `UNPACK` status
6. **Batch Insert**: Inserts all packages in a single batch operation for efficiency

## Prerequisites

- Products must exist in the database before generating packages
- MongoDB connection must be active
- NestJS application must be running

## Testing Workflow

1. **Clear existing test data**: `DELETE /package-generator/clear-unpack`
2. **Generate new test packages**: `POST /package-generator/generate`
3. **Verify generation**: `GET /package-generator/stats`
4. **Run packing workflow**: Use the main packing service to process packages
5. **Check results**: Monitor package status changes through the stats endpoint

## Integration with Main Packing Workflow

The generated packages integrate seamlessly with your main packing workflow:

- Generated packages have `UNPACK` status
- Main packing service processes packages by date (createdAt)
- Packages are assigned to jobs and processed through single_cal/many_cal services
- Status transitions: `UNPACK` → `IN_PROCESS` → `PACKED`

This allows you to generate test data and immediately run the complete packing workflow to validate your 3D bin packing implementation.
