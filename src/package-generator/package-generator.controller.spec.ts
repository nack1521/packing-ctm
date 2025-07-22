import { Test, TestingModule } from '@nestjs/testing';
import { PackageGeneratorController } from './package-generator.controller';
import { PackageGeneratorService } from './package-generator.service';

describe('PackageGeneratorController', () => {
  let controller: PackageGeneratorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackageGeneratorController],
      providers: [PackageGeneratorService],
    }).compile();

    controller = module.get<PackageGeneratorController>(PackageGeneratorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should generate random packages', async () => {
    const result = await controller.generateRandomPackages({
      oneToOneCount: 5,
      oneToManyCount: 5
    });
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('generated_packages');
    expect(result).toHaveProperty('breakdown');
    expect(result.breakdown).toHaveProperty('one_to_one');
    expect(result.breakdown).toHaveProperty('one_to_many');
  });

  it('should get package stats', async () => {
    const stats = await controller.getPackageStats();
    
    expect(stats).toHaveProperty('total_packages');
    expect(stats).toHaveProperty('unpack_packages');
    expect(stats).toHaveProperty('one_to_one_packages');
    expect(stats).toHaveProperty('one_to_many_packages');
    expect(stats).toHaveProperty('available_products');
  });

  it('should get all products', async () => {
    const products = await controller.getAllProducts();
    expect(Array.isArray(products)).toBe(true);
  });
});
