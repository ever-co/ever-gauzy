import { Test, TestingModule } from '@nestjs/testing';
import { GoalController } from './goal.controller';

describe('Goal Controller', () => {
	let controller: GoalController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [GoalController]
		}).compile();

		controller = module.get<GoalController>(GoalController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
