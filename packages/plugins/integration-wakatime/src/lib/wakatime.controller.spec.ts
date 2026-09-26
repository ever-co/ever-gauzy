import { Test, TestingModule } from '@nestjs/testing';
import { WakatimeController } from './wakatime.controller';
import { WakatimeService } from './wakatime.service';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';

/**
 * The service the controller takes is a dual-ORM one, so it cannot be handed to Nest on its own: the
 * repository pair it declares has to be provided too, or the controller is never built and the suite
 * fails to load. The pair is doubled — this suite asserts that the route class is constructible, not
 * what a summary looks like.
 */
describe('WakatimeController', () => {
	let controller: WakatimeController;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WakatimeService,
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
