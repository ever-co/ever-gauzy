import { Test, TestingModule } from '@nestjs/testing';
import { WakatimeService } from './wakatime.service';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';

/**
 * The scaffold asked Nest to build the service with no providers at all, which cannot work for a
 * dual-ORM service: it takes a TypeORM repository and a MikroORM one, and Nest answers "can't resolve
 * dependencies" instead of a defined service — the suite failed to load rather than failing an
 * assertion. The pair is doubled here, because nothing in this suite reads or writes: what it asserts
 * is that the class is constructible from the collaborators it declares.
 */
describe('WakatimeService', () => {
	let service: WakatimeService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WakatimeService,
				{ provide: TypeOrmWakatimeRepository, useValue: {} },
				{ provide: MikroOrmWakatimeRepository, useValue: {} }
			]
		}).compile();
		service = module.get(WakatimeService);
	});
	it('should be defined', () => {
		expect(service).toBeTruthy();
	});
});
