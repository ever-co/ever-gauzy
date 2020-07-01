import { Test, TestingModule } from '@nestjs/testing';
import { MicrosoftAuthGuard } from './microsoft-auth-guard';

describe('MicrosoftAuthGuard', () => {
  let provider: MicrosoftAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MicrosoftAuthGuard],
    }).compile();

    provider = module.get<MicrosoftAuthGuard>(MicrosoftAuthGuard);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
