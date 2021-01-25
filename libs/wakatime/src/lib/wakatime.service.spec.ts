import { Test } from '@nestjs/testing';
import { WakatimeService } from './wakatime.service';

describe('WakatimeService', () => {
	let service: WakatimeService;

	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [WakatimeService]
		}).compile();

		service = module.get(WakatimeService);
	});

	it('should be defined', () => {
		expect(service).toBeTruthy();
	});
});
