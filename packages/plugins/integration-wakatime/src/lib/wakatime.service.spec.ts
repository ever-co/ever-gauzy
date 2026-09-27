import { Test } from '@nestjs/testing';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';
import { WakatimeService } from './wakatime.service';
describe('WakatimeService', () => {
	let service: WakatimeService;
	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [
				WakatimeService,
				// The repositories the constructor injects; being constructible is all this spec checks.
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
