# Package Generator Examples

## Example Generated Packages

### 1:1 (ONE_TO_ONE) Package Example
```json
{
  "_id": "673abc123def456789012345",
  "product_list": [
    {
      "_id": "673def456789012345678901",
      "product_name": "Laptop Dell XPS 13"
    }
  ],
  "package_type": "ONE_TO_ONE",
  "package_status": "UNPACK",
  "createdAt": "2025-06-15T08:30:45.123Z",
  "updatedAt": "2025-07-21T10:15:30.456Z"
}
```

### 1:m (ONE_TO_MANY) Package Example
```json
{
  "_id": "673abc123def456789012346",
  "product_list": [
    {
      "_id": "673def456789012345678901",
      "product_name": "Laptop Dell XPS 13"
    },
    {
      "_id": "673def456789012345678902", 
      "product_name": "Wireless Mouse Logitech"
    },
    {
      "_id": "673def456789012345678903",
      "product_name": "USB-C Hub"
    },
    {
      "_id": "673def456789012345678904",
      "product_name": "Laptop Stand Aluminum"
    }
  ],
  "package_type": "ONE_TO_MANY",
  "package_status": "UNPACK",
  "createdAt": "2025-07-03T14:22:18.789Z",
  "updatedAt": "2025-07-21T10:15:30.456Z"
}
```

## Quick Test Commands

### 1. Generate default test data (80+80)
```bash
curl -X POST http://localhost:3000/package-generator/generate
```

### 2. Generate smaller test set
```bash
curl -X POST http://localhost:3000/package-generator/generate \
  -H "Content-Type: application/json" \
  -d '{"oneToOneCount": 10, "oneToManyCount": 10}'
```

### 3. Check what was generated
```bash
curl http://localhost:3000/package-generator/stats
```

### 4. View packages in MongoDB
```bash
# Connect to MongoDB and check packages
mongo ctm-packing
db.packages.find().limit(5).pretty()
```

### 5. Clear test data when done
```bash
curl -X DELETE http://localhost:3000/package-generator/clear-unpack
```

## Expected Output Statistics

After generating 80+80 packages:

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

## Integration with Main Packing Workflow

Once packages are generated, you can run the main packing workflow:

```bash
# Process all unpack packages
curl -X POST http://localhost:3000/main-packing/process-packages
```

This will:
1. Sort packages by `createdAt` date (June-July 2025)
2. Group packages into jobs  
3. Create carts with 4 baskets each
4. Run 3D bin packing algorithm
5. Update package status to `IN_PROCESS` then `PACKED`

## Date Distribution

Packages will be randomly distributed across the date range:
- **Start**: June 1, 2025 00:00:00
- **End**: July 31, 2025 23:59:59
- **Distribution**: Uniform random across ~61 days
- **Use Case**: Tests date-based sorting in main packing workflow
