import { Test, TestingModule } from '@nestjs/testing';
import { SingleCalService } from './single_cal.service';
import { CalculateService } from '../calculate/calculate.service';
import { getModelToken } from '@nestjs/mongoose';
import { Package } from '../packages/schemas/package.schema';

describe('SingleCalService', () => {
  let service: SingleCalService;
  let calculateService: CalculateService;
  let packageModel: any;

  beforeEach(async () => {
    const mockPackageModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SingleCalService,
        CalculateService,
        {
          provide: getModelToken(Package.name),
          useValue: mockPackageModel
        }
      ],
    }).compile();

    service = module.get<SingleCalService>(SingleCalService);
    calculateService = module.get<CalculateService>(CalculateService);
    packageModel = module.get(getModelToken(Package.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should pack multiple packages into baskets until full (single_cal logic)', async () => {
    // Mock calculate service to simulate packing results
    jest.spyOn(calculateService, 'calculatePacking')
      .mockResolvedValueOnce({
        success: true,
        strategy_used: 'Primary Strategy',
        fitted_items: 2,
        total_items: 3,
        fitted_packages: [
          { package_id: 'pkg1_0', position: [0, 0, 0], rotation_type: 0, dimensions: [10, 5, 8] },
          { package_id: 'pkg2_0', position: [10, 0, 0], rotation_type: 0, dimensions: [6, 4, 3] }
        ],
        unfitted_packages: ['pkg3_0'],
        total_weight: 1.8,
        total_volume: 472,
        basket_utilization: 15.73
      })
      .mockResolvedValueOnce({
        success: true,
        strategy_used: 'Primary Strategy', 
        fitted_items: 1,
        total_items: 1,
        fitted_packages: [
          { package_id: 'pkg3_0', position: [0, 0, 0], rotation_type: 0, dimensions: [8, 6, 4] }
        ],
        unfitted_packages: [],
        total_weight: 0.7,
        total_volume: 192,
        basket_utilization: 6.4
      });

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
        weight: 0.8,
        dimensions: { width: 6, height: 4, depth: 3 },
        quantity: 1,
        package_type: 'Small Box',
        package_status: 'Ready',
        cost: 8.0
      },
      {
        _id: 'pkg3',
        product_id: 'product3',
        weight: 0.7,
        dimensions: { width: 8, height: 6, depth: 4 },
        quantity: 1,
        package_type: 'Medium Box',
        package_status: 'Ready',
        cost: 12.0
      }
    ];

    const basketOptions = [
      {
        basket_size_id: 'medium',
        dimensions: { width: 30, height: 20, depth: 15 },
        max_weight: 10.0,
        cost: 40.0
      }
    ];

    const result = await service.packSingleCal(packages, basketOptions);

    // Verify results
    expect(result.success).toBe(true);
    expect(result.cart_packed).toBe(true);
    expect(result.total_packages).toBe(3);
    expect(result.packed_packages).toBe(3); // All packages should be packed
    expect(result.unpacked_packages).toEqual([]);
    expect(result.cart_details.baskets.length).toBe(2); // Should use 2 baskets
    expect(result.message).toContain('Successfully packed 3/3 packages');

    // Verify database updates were called
    expect(packageModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['pkg1', 'pkg2', 'pkg3'] } },
      { package_status: 'Packed' }
    );
  });

  it('should stop after first successful cart and mark unfitted packages as unpack', async () => {
    // Mock calculate service to simulate partial packing
    jest.spyOn(calculateService, 'calculatePacking')
      .mockResolvedValueOnce({
        success: true,
        strategy_used: 'Primary Strategy',
        fitted_items: 2,
        total_items: 4,
        fitted_packages: [
          { package_id: 'pkg1_0', position: [0, 0, 0], rotation_type: 0, dimensions: [10, 5, 8] },
          { package_id: 'pkg2_0', position: [10, 0, 0], rotation_type: 0, dimensions: [6, 4, 3] }
        ],
        unfitted_packages: ['pkg3_0', 'pkg4_0'],
        total_weight: 1.8,
        total_volume: 472,
        basket_utilization: 15.73
      })
      .mockResolvedValueOnce({
        success: false,
        fitted_items: 0,
        total_items: 2,
        fitted_packages: [],
        unfitted_packages: ['pkg3_0', 'pkg4_0'],
        total_weight: 0,
        total_volume: 0,
        basket_utilization: 0
      });

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
        weight: 0.8,
        dimensions: { width: 6, height: 4, depth: 3 },
        quantity: 1,
        package_type: 'Small Box',
        package_status: 'Ready',
        cost: 8.0
      },
      {
        _id: 'pkg3',
        product_id: 'product3',
        weight: 5.0,
        dimensions: { width: 25, height: 25, depth: 25 }, // Too big
        quantity: 1,
        package_type: 'Large Box',
        package_status: 'Ready',
        cost: 50.0
      },
      {
        _id: 'pkg4',
        product_id: 'product4',
        weight: 4.0,
        dimensions: { width: 20, height: 20, depth: 20 }, // Too big
        quantity: 1,
        package_type: 'Large Box',
        package_status: 'Ready',
        cost: 40.0
      }
    ];

    const basketOptions = [
      {
        basket_size_id: 'medium',
        dimensions: { width: 30, height: 20, depth: 15 },
        max_weight: 10.0,
        cost: 40.0
      }
    ];

    const result = await service.packSingleCal(packages, basketOptions);

    // Verify results - cart is packed even if not all packages fit
    expect(result.success).toBe(true);
    expect(result.cart_packed).toBe(true);
    expect(result.total_packages).toBe(4);
    expect(result.packed_packages).toBe(2); // Only 2 packages fit
    expect(result.unpacked_packages).toEqual(['pkg3', 'pkg4']); // 2 packages couldn't fit
    expect(result.cart_details.baskets.length).toBe(1); // Only 1 basket used

    // Verify database updates were called correctly
    expect(packageModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['pkg1', 'pkg2'] } },
      { package_status: 'Packed' }
    );
    expect(packageModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['pkg3', 'pkg4'] } },
      { package_status: 'Unpack' }
    );
  });

  it('should handle case where no packages can be packed', async () => {
    // Mock calculate service to simulate no packing possible
    jest.spyOn(calculateService, 'calculatePacking')
      .mockResolvedValue({
        success: false,
        fitted_items: 0,
        total_items: 2,
        fitted_packages: [],
        unfitted_packages: ['pkg1_0', 'pkg2_0'],
        total_weight: 0,
        total_volume: 0,
        basket_utilization: 0
      });

    const packages = [
      {
        _id: 'pkg1',
        product_id: 'product1',
        weight: 20.0, // Too heavy
        dimensions: { width: 50, height: 50, depth: 50 }, // Too big
        quantity: 1,
        package_type: 'Huge Box',
        package_status: 'Ready',
        cost: 100.0
      },
      {
        _id: 'pkg2',
        product_id: 'product2',
        weight: 15.0, // Too heavy
        dimensions: { width: 40, height: 40, depth: 40 }, // Too big
        quantity: 1,
        package_type: 'Large Box',
        package_status: 'Ready',
        cost: 80.0
      }
    ];

    const basketOptions = [
      {
        basket_size_id: 'small',
        dimensions: { width: 20, height: 15, depth: 10 },
        max_weight: 5.0,
        cost: 20.0
      }
    ];

    const result = await service.packSingleCal(packages, basketOptions);

    // Verify results
    expect(result.success).toBe(false);
    expect(result.cart_packed).toBe(false);
    expect(result.total_packages).toBe(2);
    expect(result.packed_packages).toBe(0);
    expect(result.unpacked_packages).toEqual(['pkg1', 'pkg2']);
    expect(result.message).toContain('No suitable basket size found');

    // Verify all packages marked as unpack
    expect(packageModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['pkg1', 'pkg2'] } },
      { package_status: 'Unpack' }
    );
  });
});
