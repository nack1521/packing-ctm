import { Test, TestingModule } from '@nestjs/testing';
import { CalculateService } from './calculate.service';

describe('CalculateService', () => {
  let service: CalculateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalculateService],
    }).compile();

    service = module.get<CalculateService>(CalculateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate packing for simple packages', async () => {
    // Define test packages
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
      },
      {
        _id: 'pkg2',
        product_id: 'product2',
        weight: 0.5,
        dimensions: { width: 6, height: 4, depth: 3 },
        quantity: 2,
        package_type: 'Small Box',
        package_status: 'Ready',
        cost: 8.0
      }
    ];

    // Define test basket
    const basket = {
      basket_size_id: 'basket1',
      dimensions: { width: 30, height: 20, depth: 15 },
      max_weight: 10.0,
      cost: 50.0
    };

    // Calculate packing
    const result = await service.calculatePacking(packages, basket);

    // Verify results
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.total_items).toBe(3); // 1 + 2 packages
    expect(result.fitted_items).toBe(3);
    expect(result.fitted_packages.length).toBe(3);
    expect(result.unfitted_packages.length).toBe(0);
    expect(result.total_weight).toBe(2.0); // 1.0 + 0.5*2
    expect(result.basket_utilization).toBeGreaterThan(0);
    expect(result.strategy_used).toBeDefined();
  });

  it('should handle packages that do not fit', async () => {
    // Define packages that are too large
    const packages = [
      {
        _id: 'pkg1',
        product_id: 'product1',
        weight: 2.0,
        dimensions: { width: 50, height: 50, depth: 50 }, // Too big
        quantity: 1,
        package_type: 'Large Box',
        package_status: 'Ready',
        cost: 25.0
      }
    ];

    // Define small basket
    const basket = {
      basket_size_id: 'basket1',
      dimensions: { width: 20, height: 20, depth: 20 },
      max_weight: 10.0,
      cost: 30.0
    };

    // Calculate packing
    const result = await service.calculatePacking(packages, basket);

    // Verify results
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.total_items).toBe(1);
    expect(result.fitted_items).toBe(0);
    expect(result.fitted_packages.length).toBe(0);
    expect(result.unfitted_packages.length).toBe(1);
  });

  it('should find optimal basket from multiple options', async () => {
    // Define test packages
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

    // Define multiple baskets
    const baskets = [
      {
        basket_size_id: 'small',
        dimensions: { width: 15, height: 10, depth: 12 },
        max_weight: 5.0,
        cost: 20.0
      },
      {
        basket_size_id: 'large',
        dimensions: { width: 30, height: 20, depth: 25 },
        max_weight: 10.0,
        cost: 40.0
      }
    ];

    // Find optimal basket
    const result = await service.findOptimalBasket(packages, baskets);

    // Verify results
    expect(result).toBeDefined();
    expect(result.optimal_basket).toBeDefined();
    expect(result.packing_result).toBeDefined();
    expect(result.alternatives.length).toBe(2);
    
    // Should pick the smaller, cheaper basket since package fits in both
    expect(result.optimal_basket?.basket_size_id).toBe('small');
    expect(result.packing_result?.success).toBe(true);
  });

  it('should calculate packing statistics', async () => {
    // Define test packages
    const packages = [
      {
        _id: 'pkg1',
        product_id: 'product1',
        weight: 1.5,
        dimensions: { width: 10, height: 5, depth: 8 },
        quantity: 2,
        package_type: 'Box',
        package_status: 'Ready',
        cost: 15.0
      },
      {
        _id: 'pkg2',
        product_id: 'product2',
        weight: 0.8,
        dimensions: { width: 6, height: 4, depth: 3 },
        quantity: 1,
        package_type: 'Small Box',
        package_status: 'Ready',
        cost: 8.0
      }
    ];

    // Calculate stats
    const stats = await service.getPackingStats(packages);

    // Verify results
    expect(stats).toBeDefined();
    expect(stats.total_packages).toBe(3); // 2 + 1
    expect(stats.total_weight).toBe(3.8); // 1.5*2 + 0.8*1
    expect(stats.total_volume).toBe(472); // (10*5*8)*2 + (6*4*3)*1
    expect(stats.heaviest_package).toBe(1.5);
    expect(stats.largest_package).toBe(400); // 10*5*8
    expect(stats.average_density).toBeGreaterThan(0);
  });
});
