import { Test, TestingModule } from '@nestjs/testing';
import { TimeSheetService } from './timesheet.service';

describe('TimeSheetService', () => {
	let service: TimeSheetService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TimeSheetService]
		}).compile();

		service = module.get<TimeSheetService>(TimeSheetService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
