import { Test, TestingModule } from '@nestjs/testing';
import { ManyCalService } from './many_cal.service';
import { CalculateService } from '../calculate/calculate.service';
import { getModelToken } from '@nestjs/mongoose';
import { Package } from '../packages/schemas/package.schema';

describe('ManyCalService', () => {
  let service: ManyCalService;
  let calculateService: CalculateService;
  let packageModel: any;

  beforeEach(async () => {
    const mockPackageModel = {
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManyCalService,
        CalculateService,
        {
          provide: getModelToken(Package.name),
          useValue: mockPackageModel
        }
      ],
    }).compile();

    service = module.get<ManyCalService>(ManyCalService);
    calculateService = module.get<CalculateService>(CalculateService);
    packageModel = module.get(getModelToken(Package.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should split large quantity package across multiple baskets (many_cal logic)', async () => {
    // Mock calculate service to simulate packing results for different basket attempts
    jest.spyOn(calculateService, 'calculatePacking')
      .mockResolvedValueOnce({
        success: true,
        strategy_used: 'Primary Strategy',
        fitted_items: 5, // First basket can fit 5 items
        total_items: 10,
        fitted_packages: Array(5).fill(0).map((_, i) => ({
          package_id: `pkg1_${i}`,
          position: [i * 10, 0, 0],
          rotation_type: 0,
          dimensions: [10, 5, 8]
        })),
        unfitted_packages: Array(5).fill(0).map((_, i) => `pkg1_${i + 5}`),
        total_weight: 5.0,
        total_volume: 2000,
        basket_utilization: 13.33
      })
      .mockResolvedValueOnce({
        success: true,
        strategy_used: 'Primary Strategy',
        fitted_items: 5, // Second basket can fit remaining 5 items
        total_items: 5,
        fitted_packages: Array(5).fill(0).map((_, i) => ({
          package_id: `pkg1_${i + 5}`,
          position: [i * 10, 0, 0],
          rotation_type: 0,
          dimensions: [10, 5, 8]
        })),
        unfitted_packages: [],
        total_weight: 5.0,
        total_volume: 2000,
        basket_utilization: 13.33
      });

    const packageData = {
      _id: 'pkg1',
      product_id: 'product1',
      weight: 1.0,
      dimensions: { width: 10, height: 5, depth: 8 },
      quantity: 10, // Large quantity to be split
      package_type: 'Box',
      package_status: 'Ready',
      cost: 15.0
    };

    const basketOptions = [
      {
        basket_size_id: 'medium',
        dimensions: { width: 60, height: 20, depth: 15 },
        max_weight: 15.0,
        cost: 40.0
      }
    ];

    const result = await service.packManyCal(packageData, basketOptions);

    // Verify results
    expect(result.success).toBe(true);
    expect(result.total_quantity).toBe(10);
    expect(result.packed_quantity).toBe(10); // All 10 items packed
    expect(result.unpacked_quantity).toBe(0);
    expect(result.baskets_used).toBe(2); // Should use 2 baskets
    expect(result.basket_details.length).toBe(2);
    expect(result.message).toContain('Successfully packed 10/10 quantity in 2 baskets');

    // Verify each basket contains 5 items
    expect(result.basket_details[0].quantity_packed).toBe(5);
    expect(result.basket_details[1].quantity_packed).toBe(5);

    // Verify database update was called
    expect(packageModel.updateOne).toHaveBeenCalledWith(
      { _id: 'pkg1' },
      { 
        package_status: 'Packed',
        packed_quantity: 10,
        unpacked_quantity: 0
      }
    );
  });

  it('should handle partial packing with remaining quantity marked as unpack', async () => {
    // Mock calculate service to simulate partial packing
    jest.spyOn(calculateService, 'calculatePacking')
      .mockResolvedValueOnce({
        success: true,
        strategy_used: 'Primary Strategy',
        fitted_items: 3, // First basket can only fit 3 items
        total_items: 8,
        fitted_packages: Array(3).fill(0).map((_, i) => ({
          package_id: `pkg1_${i}`,
          position: [i * 10, 0, 0],
          rotation_type: 0,
          dimensions: [15, 10, 12]
        })),
        unfitted_packages: Array(5).fill(0).map((_, i) => `pkg1_${i + 3}`),
        total_weight: 6.0,
        total_volume: 5400,
        basket_utilization: 30.0
      })
      .mockResolvedValueOnce({
        success: true,
        strategy_used: 'Primary Strategy',
        fitted_items: 2, // Second basket can fit 2 more items
        total_items: 5,
        fitted_packages: Array(2).fill(0).map((_, i) => ({
          package_id: `pkg1_${i + 3}`,
          position: [i * 15, 0, 0],
          rotation_type: 0,
          dimensions: [15, 10, 12]
        })),
        unfitted_packages: Array(3).fill(0).map((_, i) => `pkg1_${i + 5}`),
        total_weight: 4.0,
        total_volume: 3600,
        basket_utilization: 20.0
      })
      .mockResolvedValueOnce({
        success: false, // Third basket can't fit any more
        fitted_items: 0,
        total_items: 3,
        fitted_packages: [],
        unfitted_packages: Array(3).fill(0).map((_, i) => `pkg1_${i + 5}`),
        total_weight: 0,
        total_volume: 0,
        basket_utilization: 0
      });

    const packageData = {
      _id: 'pkg1',
      product_id: 'product1',
      weight: 2.0,
      dimensions: { width: 15, height: 10, depth: 12 }, // Larger items
      quantity: 8,
      package_type: 'Large Box',
      package_status: 'Ready',
      cost: 30.0
    };

    const basketOptions = [
      {
        basket_size_id: 'medium',
        dimensions: { width: 50, height: 25, depth: 20 },
        max_weight: 10.0,
        cost: 40.0
      }
    ];

    const result = await service.packManyCal(packageData, basketOptions);

    // Verify results
    expect(result.success).toBe(true); // Success because some items were packed
    expect(result.total_quantity).toBe(8);
    expect(result.packed_quantity).toBe(5); // Only 5 items could be packed
    expect(result.unpacked_quantity).toBe(3); // 3 items remain unpacked
    expect(result.baskets_used).toBe(2); // Used 2 baskets
    expect(result.message).toContain('Successfully packed 5/8 quantity in 2 baskets');

    // Verify database update for partial packing
    expect(packageModel.updateOne).toHaveBeenCalledWith(
      { _id: 'pkg1' },
      { 
        package_status: 'Partially Packed',
        packed_quantity: 5,
        unpacked_quantity: 3
      }
    );
  });

  it('should handle case where no items can be packed', async () => {
    // Mock calculate service to simulate no packing possible
    jest.spyOn(calculateService, 'calculatePacking')
      .mockResolvedValue({
        success: false,
        fitted_items: 0,
        total_items: 5,
        fitted_packages: [],
        unfitted_packages: Array(5).fill(0).map((_, i) => `pkg1_${i}`),
        total_weight: 0,
        total_volume: 0,
        basket_utilization: 0
      });

    const packageData = {
      _id: 'pkg1',
      product_id: 'product1',
      weight: 20.0, // Too heavy
      dimensions: { width: 60, height: 40, depth: 30 }, // Too big
      quantity: 5,
      package_type: 'Huge Box',
      package_status: 'Ready',
      cost: 100.0
    };

    const basketOptions = [
      {
        basket_size_id: 'small',
        dimensions: { width: 30, height: 20, depth: 15 },
        max_weight: 5.0,
        cost: 20.0
      }
    ];

    const result = await service.packManyCal(packageData, basketOptions);

    // Verify results
    expect(result.success).toBe(false);
    expect(result.total_quantity).toBe(5);
    expect(result.packed_quantity).toBe(0);
    expect(result.unpacked_quantity).toBe(5);
    expect(result.baskets_used).toBe(0);
    expect(result.message).toContain('No suitable basket size found');

    // Verify all quantity marked as unpack
    expect(packageModel.updateOne).toHaveBeenCalledWith(
      { _id: 'pkg1' },
      { 
        package_status: 'Unpack',
        packed_quantity: 0,
        unpacked_quantity: 5
      }
    );
  });

  it('should find optimal basket size for a package', async () => {
    // Mock different basket options with different results
    jest.spyOn(calculateService, 'calculatePacking')
      .mockImplementation(async (packages, basket) => {
        if (basket.basket_size_id === 'small') {
          return {
            success: true,
            fitted_items: 2,
            total_items: 6,
            fitted_packages: Array(2).fill(0).map((_, i) => ({
              package_id: `pkg1_${i}`,
              position: [i * 10, 0, 0],
              rotation_type: 0,
              dimensions: [10, 5, 8]
            })),
            unfitted_packages: Array(4).fill(0).map((_, i) => `pkg1_${i + 2}`),
            total_weight: 2.0,
            total_volume: 800,
            basket_utilization: 26.67
          };
        } else if (basket.basket_size_id === 'medium') {
          return {
            success: true,
            fitted_items: 4,
            total_items: 6,
            fitted_packages: Array(4).fill(0).map((_, i) => ({
              package_id: `pkg1_${i}`,
              position: [i * 10, 0, 0],
              rotation_type: 0,
              dimensions: [10, 5, 8]
            })),
            unfitted_packages: Array(2).fill(0).map((_, i) => `pkg1_${i + 4}`),
            total_weight: 4.0,
            total_volume: 1600,
            basket_utilization: 17.78
          };
        }
        return { success: false, fitted_items: 0, total_items: 0, fitted_packages: [], unfitted_packages: [], total_weight: 0, total_volume: 0, basket_utilization: 0 };
      });

    const packageData = {
      _id: 'pkg1',
      product_id: 'product1',
      weight: 1.0,
      dimensions: { width: 10, height: 5, depth: 8 },
      quantity: 6,
      package_type: 'Box',
      package_status: 'Ready',
      cost: 15.0
    };

    const basketOptions = [
      {
        basket_size_id: 'small',
        dimensions: { width: 25, height: 15, depth: 12 },
        max_weight: 5.0,
        cost: 25.0
      },
      {
        basket_size_id: 'medium',
        dimensions: { width: 45, height: 20, depth: 18 },
        max_weight: 10.0,
        cost: 45.0
      }
    ];

    const result = await service.findOptimalBasketForPackage(packageData, basketOptions);

    // Verify results - should prefer medium basket because it packs more items
    expect(result.optimal_basket).toBeDefined();
    expect(result.optimal_basket?.basket_size_id).toBe('medium');
    expect(result.packing_result).toBeDefined();
    expect(result.packing_result?.packed_quantity).toBe(4); // Medium basket packs more
    expect(result.alternatives.length).toBe(2);
  });
});
