import { Test, TestingModule } from '@nestjs/testing';
import { ZapierService } from './zapier.service';

describe('ZapierService', () => {
  let service: ZapierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZapierService],
    }).compile();

    service = module.get<ZapierService>(ZapierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
