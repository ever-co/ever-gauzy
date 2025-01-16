import { Test, TestingModule } from '@nestjs/testing';
import { EmailCheckController } from './email-check.controller';
import { EmailCheckService } from './email-check.service';

describe('EmailCheckController', () => {
	let controller: EmailCheckController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [EmailCheckController],
			providers: [EmailCheckService]
		}).compile();

		controller = module.get<EmailCheckController>(EmailCheckController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
