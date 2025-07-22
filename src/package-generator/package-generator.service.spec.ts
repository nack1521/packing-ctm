import { Test, TestingModule } from '@nestjs/testing';
import { PackageGeneratorService } from './package-generator.service';

describe('PackageGeneratorService', () => {
  let service: PackageGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackageGeneratorService],
    }).compile();

    service = module.get<PackageGeneratorService>(PackageGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate random packages with default counts', async () => {
    const result = await service.generateRandomPackages();
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('generated_packages');
    expect(result.breakdown.one_to_one).toBe(80);
    expect(result.breakdown.one_to_many).toBe(80);
    expect(result.generated_packages).toBe(160);
  });

  it('should generate packages with custom counts', async () => {
    const result = await service.generateRandomPackages({
      oneToOneCount: 10,
      oneToManyCount: 15
    });
    
    expect(result.breakdown.one_to_one).toBe(10);
    expect(result.breakdown.one_to_many).toBe(15);
    expect(result.generated_packages).toBe(25);
  });

  it('should clear unpack packages', async () => {
    const result = await service.clearUnpackPackages();
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('deleted_count');
    expect(result).toHaveProperty('message');
  });

  it('should get package statistics', async () => {
    const stats = await service.getPackageStats();
    
    expect(stats).toHaveProperty('total_packages');
    expect(stats).toHaveProperty('unpack_packages');
    expect(stats).toHaveProperty('one_to_one_packages');
    expect(stats).toHaveProperty('one_to_many_packages');
    expect(stats).toHaveProperty('processing_packages');
    expect(stats).toHaveProperty('packed_packages');
    expect(stats).toHaveProperty('available_products');
  });
});
