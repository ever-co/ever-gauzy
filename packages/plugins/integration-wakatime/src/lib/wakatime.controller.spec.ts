import { Test } from '@nestjs/testing';
import { WakatimeController } from './wakatime.controller';
import { WakatimeService } from './wakatime.service';

describe('WakatimeController', () => {
	let controller: WakatimeController;

	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [WakatimeService],
			controllers: [WakatimeController]
		}).compile();

		controller = module.get(WakatimeController);
	});

	it('should be defined', () => {
		expect(controller).toBeTruthy();
	});
});
