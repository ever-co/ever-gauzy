import { Test } from '@nestjs/testing';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';
import { WakatimeController } from './wakatime.controller';
import { WakatimeService } from './wakatime.service';
describe('WakatimeController', () => {
	let controller: WakatimeController;
	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [
				WakatimeService,
				// `WakatimeService` is instantiated for real here, so the repositories it injects must resolve.
				{ provide: TypeOrmWakatimeRepository, useValue: {} },
				{ provide: MikroOrmWakatimeRepository, useValue: {} }
			],
			controllers: [WakatimeController]
		}).compile();
		controller = module.get(WakatimeController);
	});
	it('should be defined', () => {
		expect(controller).toBeTruthy();
	});
});
