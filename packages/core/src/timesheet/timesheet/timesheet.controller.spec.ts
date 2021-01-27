import { Test, TestingModule } from '@nestjs/testing';
import { TimeSheetController } from './timesheet.controller';

describe('TimeSheet Controller', () => {
	let controller: TimeSheetController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [TimeSheetController]
		}).compile();

		controller = module.get<TimeSheetController>(TimeSheetController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
