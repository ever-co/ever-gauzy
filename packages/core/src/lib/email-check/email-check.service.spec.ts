import { Test, TestingModule } from '@nestjs/testing';
import { EmailCheckService } from './email-check.service';

describe('EmailCheckService', () => {
	let service: EmailCheckService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [EmailCheckService]
		}).compile();

		service = module.get<EmailCheckService>(EmailCheckService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
