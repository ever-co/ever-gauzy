import { Test, TestingModule } from '@nestjs/testing';
import { TimeLogService } from './time-log.service';

describe('TimeLogService', () => {
	let service: TimeLogService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TimeLogService]
		}).compile();

		service = module.get<TimeLogService>(TimeLogService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
