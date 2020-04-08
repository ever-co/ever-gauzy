import { Test, TestingModule } from '@nestjs/testing';
import { TimesheetService } from './timesheet.service';

describe('TimesheetService', () => {
	let service: TimesheetService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TimesheetService]
		}).compile();

		service = module.get<TimesheetService>(TimesheetService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
