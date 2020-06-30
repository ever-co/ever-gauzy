import { Test, TestingModule } from '@nestjs/testing';
import { GithubAuthGuard } from './github-auth-guard';

describe('GithubAuthGuard', () => {
  let provider: GithubAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GithubAuthGuard],
    }).compile();

    provider = module.get<GithubAuthGuard>(GithubAuthGuard);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
