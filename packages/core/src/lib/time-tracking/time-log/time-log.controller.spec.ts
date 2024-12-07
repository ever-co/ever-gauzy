import { Test, TestingModule } from '@nestjs/testing';
import { TimeLogController } from './time-log.controller';

describe('TimeLog Controller', () => {
	let controller: TimeLogController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [TimeLogController]
		}).compile();

		controller = module.get<TimeLogController>(TimeLogController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
