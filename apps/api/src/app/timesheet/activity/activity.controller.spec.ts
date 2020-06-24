import { Test, TestingModule } from '@nestjs/testing';
import { ActivityController } from './activity.controller';

describe('Activity Controller', () => {
	let controller: ActivityController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ActivityController]
		}).compile();

		controller = module.get<ActivityController>(ActivityController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
