import { Test, TestingModule } from '@nestjs/testing';
import { TimerService } from './timer.service';

describe('TimerService', () => {
	let service: TimerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TimerService]
		}).compile();

		service = module.get<TimerService>(TimerService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
