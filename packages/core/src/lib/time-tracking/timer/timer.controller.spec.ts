/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the subject first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel first
 * lets that module finish before anything applies it. The API does not hit this because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../../core/entities/internal';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TimerController } from './timer.controller';
describe('Timer Controller', () => {
	let controller: TimerController;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [TimerController]
		})
			/**
			 * The original scaffold listed the subject with NO dependencies provided, so this suite
			 * could never have passed even once it loaded — it would have died on
			 * `Nest can't resolve dependencies`. Automocking every token keeps the suite honest
			 * about what it actually checks: that the class is constructible and its wiring holds.
			 */
			.useMocker(() => ({}))
			.compile();
		controller = module.get<TimerController>(TimerController);
	});
	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});

/**
 * A stop or a toggle is refused when it is not for the running timer: 406 when it asks for a time before that timer
 * started (or names a log while none runs), 409 when it names another time log. The OpenAPI document says so.
 */
describe('Timer Controller OpenAPI responses', () => {
	/** `@nestjs/swagger`'s key for the responses a route declares (`DECORATORS.API_RESPONSE`, in its ESM constants). */
	const API_RESPONSE = 'swagger/apiResponse';

	const declaredResponses = (route: 'stopTimer' | 'toggleTimer'): Record<string, { description?: string }> =>
		Reflect.getMetadata(API_RESPONSE, TimerController.prototype[route]) ?? {};

	it.each(['stopTimer', 'toggleTimer'] as const)('%s declares its 406 and 409 answers', (route) => {
		const responses = declaredResponses(route);

		expect(responses[HttpStatus.NOT_ACCEPTABLE]?.description).toMatch(/stoppedAt/);
		expect(responses[HttpStatus.CONFLICT]?.description).toMatch(/timeLogId/);
	});
});
