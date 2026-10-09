/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the service first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel first
 * lets that module finish before anything applies it. The API does not hit this because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { TimerService } from './timer.service';

describe('TimerService', () => {
	let service: TimerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TimerService]
		})
			/**
			 * `TimerService` has a wide constructor (repositories, command bus, employee service).
			 * The original scaffold provided none of it, so this suite could never have passed even
			 * once it loaded — it would have died on `Nest can't resolve dependencies`. Automocking
			 * every token keeps the suite honest about what it actually checks: that the class is
			 * constructible and its provider wiring is intact.
			 */
			.useMocker(() => ({}))
			.compile();

		service = module.get<TimerService>(TimerService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
