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
import { HttpStatus, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
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

/**
 * Issue #11923 — `POST /timesheet/timer/discard` removes the caller's running timer and answers 204, under the
 * timer's own TIME_TRACKER permission; its refusals are in the OpenAPI document.
 */
describe('Timer Controller discard', () => {
	const API_RESPONSE = 'swagger/apiResponse';
	const discardRoute = TimerController.prototype.discardTimer;

	it('is POST /discard and answers 204 with its 400, 403 and 409 refusals declared', () => {
		const responses: Record<string, { description?: string }> =
			Reflect.getMetadata(API_RESPONSE, discardRoute) ?? {};

		expect(Reflect.getMetadata(PATH_METADATA, discardRoute)).toBe('/discard');
		expect(Reflect.getMetadata(METHOD_METADATA, discardRoute)).toBe(RequestMethod.POST);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, discardRoute)).toBe(HttpStatus.NO_CONTENT);
		expect(responses[HttpStatus.BAD_REQUEST]?.description).toMatch(/No timer is running/);
		expect(responses[HttpStatus.FORBIDDEN]?.description).toMatch(/TIMER_DISCARD_DISABLED.*TIMER_DISCARD_TOO_LATE/s);
		expect(responses[HttpStatus.CONFLICT]?.description).toMatch(/timeLogId/);
	});

	it("needs the timer's permission and no permission to delete time", () => {
		const permissionsOf = (target: object): PermissionsEnum[] =>
			Reflect.getMetadata(PERMISSIONS_METADATA, target) ?? [];

		expect(permissionsOf(discardRoute)).toEqual([]);
		expect(permissionsOf(TimerController)).toEqual([PermissionsEnum.TIME_TRACKER]);
	});

	it('hands the body to the service and answers nothing', async () => {
		const discardTimer = jest.fn(async () => undefined);
		const controller = new TimerController({ discardTimer } as never, undefined as never, undefined as never);
		const body = { organizationId: 'organization-1', timeLogId: 'log-1' };

		await expect(controller.discardTimer(body as never)).resolves.toBeUndefined();
		expect(discardTimer).toHaveBeenCalledWith(body);
	});
});
