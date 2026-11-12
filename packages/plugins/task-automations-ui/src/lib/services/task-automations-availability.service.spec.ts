// `@gauzy/ui-core/core` is replaced at the module boundary: its barrel boots the app's whole service graph, and this
// suite needs only the classes as injection tokens.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {},
	NavMenuBuilderService: class NavMenuBuilderService {},
	PermissionsGuard: class PermissionsGuard {}
}));

import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import {
	isFinalRefusal,
	TASK_AUTOMATIONS_AVAILABILITY_RECHECK_MS,
	TASK_AUTOMATIONS_AVAILABILITY_RETRIES,
	TASK_AUTOMATIONS_AVAILABILITY_RETRY_MS,
	TaskAutomationsAvailabilityService
} from './task-automations-availability.service';
import { TaskAutomationsApiService } from './task-automations-api.service';

/** Whether the API serves task automations: asked once per user, temporary failures retried. */
describe('TaskAutomationsAvailabilityService', () => {
	const api = { templates: jest.fn() };
	let user$: BehaviorSubject<{ id: string } | null>;

	function service(): TaskAutomationsAvailabilityService {
		user$ = new BehaviorSubject<{ id: string } | null>({ id: 'user-1' });
		TestBed.configureTestingModule({
			providers: [
				{ provide: TaskAutomationsApiService, useValue: api },
				{ provide: Store, useValue: { user$ } }
			]
		});
		return TestBed.inject(TaskAutomationsAvailabilityService);
	}

	beforeEach(() => jest.resetAllMocks());

	it('knows the refusals that do not change', () => {
		expect(isFinalRefusal({ status: 404 } as never)).toBe(true);
		expect(isFinalRefusal({ status: 401 } as never)).toBe(true);
		expect(isFinalRefusal({ status: 403 } as never)).toBe(true);
		expect(isFinalRefusal({ status: 502 } as never)).toBe(false);
		expect(isFinalRefusal(null)).toBe(false);
	});

	it('true once the templates answer', fakeAsync(() => {
		api.templates.mockReturnValue(of([]));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([true]);
	}));

	it('404 (the plugin is off) and 403 (no permission): false at once, asked once', fakeAsync(() => {
		for (const status of [404, 403]) {
			TestBed.resetTestingModule();
			jest.resetAllMocks();
			api.templates.mockReturnValue(throwError(() => ({ status })));
			const values: boolean[] = [];
			service().available$.subscribe((value) => values.push(value));
			tick(TASK_AUTOMATIONS_AVAILABILITY_RETRY_MS * 100);
			expect(values).toEqual([false]);
			expect(api.templates).toHaveBeenCalledTimes(1);
		}
	}));

	it('a temporary failure is retried, so a recovered API shows the entry', fakeAsync(() => {
		api.templates.mockReturnValueOnce(throwError(() => ({ status: 502 }))).mockReturnValue(of([]));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([]);
		tick(TASK_AUTOMATIONS_AVAILABILITY_RETRY_MS);
		expect(values).toEqual([true]);
		expect(api.templates).toHaveBeenCalledTimes(2);
	}));

	it('is false after the last retry, and asks again later, so an API that recovers shows the entry', fakeAsync(() => {
		api.templates.mockReturnValue(throwError(() => ({ status: 503 })));
		const values: boolean[] = [];
		const subscription = service().available$.subscribe((value) => values.push(value));
		// 5 + 10 + 20 + 40 + 80 seconds of retries.
		tick(TASK_AUTOMATIONS_AVAILABILITY_RETRY_MS * (2 ** TASK_AUTOMATIONS_AVAILABILITY_RETRIES - 1));
		expect(values).toEqual([false]);
		expect(api.templates).toHaveBeenCalledTimes(TASK_AUTOMATIONS_AVAILABILITY_RETRIES + 1);
		api.templates.mockReturnValue(of([]));
		tick(TASK_AUTOMATIONS_AVAILABILITY_RECHECK_MS);
		expect(values).toEqual([false, true]);
		subscription.unsubscribe();
	}));

	it('signing out is false at once and cancels a request in flight; another user is asked again', fakeAsync(() => {
		api.templates.mockReturnValueOnce(throwError(() => ({ status: 502 }))).mockReturnValue(of([]));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		user$.next(null);
		expect(values).toEqual([false]);
		tick(TASK_AUTOMATIONS_AVAILABILITY_RETRY_MS * 100);
		expect(api.templates).toHaveBeenCalledTimes(1);
		user$.next({ id: 'user-2' });
		expect(values).toEqual([false, true]);
	}));
});
