// The ui-core barrel boots half the app (and needs packages this spec does not have): what the services name from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {}
}));

import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of, Subject, throwError } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TaskReferenceNavigatorService } from './task-reference-navigator.service';
import { TaskViewsApiService } from './task-views-api.service';
import {
	TASK_VIEWS_AVAILABILITY_REPROBE_MS,
	TASK_VIEWS_AVAILABILITY_REPROBES,
	TASK_VIEWS_AVAILABILITY_RETRIES,
	isTemporaryFailure,
	TaskViewsAvailabilityService
} from './task-views-availability.service';
import { TaskViewsOptionsService } from './task-views-options.service';

describe('task views services', () => {
	afterEach(() => TestBed.resetTestingModule());

	describe('TaskViewsAvailabilityService', () => {
		it('says the views are off for a new organization until it has answered itself', () => {
			const user$ = new BehaviorSubject<unknown>({ id: 'u1', tenantId: 't' });
			const organization$ = new BehaviorSubject<unknown>({ id: 'orgA', tenantId: 't' });
			const answers = new Subject<unknown>();
			const builtIn = jest
				.fn()
				.mockReturnValueOnce(of({ items: [], total: 0 }))
				.mockReturnValueOnce(answers);
			TestBed.configureTestingModule({
				providers: [
					{ provide: Store, useValue: { user$, selectedOrganization$: organization$ } },
					{ provide: TaskViewsApiService, useValue: { builtIn } }
				]
			});
			const seen: boolean[] = [];
			TestBed.inject(TaskViewsAvailabilityService).available$.subscribe((available) => seen.push(available));
			expect(seen).toEqual([false, true]);
			organization$.next({ id: 'orgB', tenantId: 't' });
			expect(seen).toEqual([false, true, false]);
			answers.next({ items: [], total: 0 });
			expect(seen).toEqual([false, true, false, true]);
			expect(builtIn.mock.calls[1][1]).toMatchObject({ organizationId: 'orgB', userId: 'u1' });
		});

		describe('after temporary failures', () => {
			afterEach(() => jest.useRealTimers());

			function probing(answers: () => unknown) {
				const builtIn = jest.fn(answers);
				TestBed.configureTestingModule({
					providers: [
						{
							provide: Store,
							useValue: { user$: of({ id: 'u1' }), selectedOrganization$: of({ id: 'org' }) }
						},
						{ provide: TaskViewsApiService, useValue: { builtIn } }
					]
				});
				const seen: boolean[] = [];
				TestBed.inject(TaskViewsAvailabilityService).available$.subscribe((available) => seen.push(available));
				return { builtIn, seen };
			}
			const unavailable = () => throwError(() => new HttpErrorResponse({ status: 503 }));
			// 5 s, 10 s, 20 s, 40 s and 80 s: one round of attempts.
			const ROUND_MS = 155_000;

			it('asks again later once the attempts ran out, and shows the views when the API is back', () => {
				jest.useFakeTimers();
				let calls = 0;
				const { builtIn, seen } = probing(() =>
					++calls <= TASK_VIEWS_AVAILABILITY_RETRIES + 2 ? unavailable() : of({ items: [], total: 0 })
				);
				jest.advanceTimersByTime(ROUND_MS);
				expect(builtIn).toHaveBeenCalledTimes(TASK_VIEWS_AVAILABILITY_RETRIES + 1);
				expect(seen).toEqual([false]);
				jest.advanceTimersByTime(TASK_VIEWS_AVAILABILITY_REPROBE_MS);
				expect(builtIn).toHaveBeenCalledTimes(TASK_VIEWS_AVAILABILITY_RETRIES + 2);
				jest.advanceTimersByTime(5_000);
				expect(seen).toEqual([false, true]);
			});

			it('stops asking after a bounded number of rounds', () => {
				jest.useFakeTimers();
				const { builtIn, seen } = probing(unavailable);
				const rounds = TASK_VIEWS_AVAILABILITY_REPROBES + 1;
				jest.advanceTimersByTime(
					rounds * ROUND_MS + TASK_VIEWS_AVAILABILITY_REPROBES * TASK_VIEWS_AVAILABILITY_REPROBE_MS
				);
				expect(builtIn).toHaveBeenCalledTimes(rounds * (TASK_VIEWS_AVAILABILITY_RETRIES + 1));
				jest.advanceTimersByTime(24 * 60 * 60_000);
				expect(builtIn).toHaveBeenCalledTimes(rounds * (TASK_VIEWS_AVAILABILITY_RETRIES + 1));
				expect(seen).toEqual([false]);
			});
		});

		it('asks again only after a failure that asking again can change', () => {
			for (const status of [0, 408, 429, 500, 502, 503]) {
				expect(isTemporaryFailure(new HttpErrorResponse({ status }))).toBe(true);
			}
			for (const status of [400, 401, 403, 404, 422]) {
				expect(isTemporaryFailure(new HttpErrorResponse({ status }))).toBe(false);
			}
			expect(isTemporaryFailure(new Error('not an HTTP answer'))).toBe(false);
			expect(isTemporaryFailure(null)).toBe(false);
		});

		it('asks once on a request the API refuses as such (400)', () => {
			jest.useFakeTimers();
			try {
				const builtIn = jest.fn(() => throwError(() => new HttpErrorResponse({ status: 400 })));
				TestBed.configureTestingModule({
					providers: [
						{
							provide: Store,
							useValue: { user$: of({ id: 'u1' }), selectedOrganization$: of({ id: 'org' }) }
						},
						{ provide: TaskViewsApiService, useValue: { builtIn } }
					]
				});
				const seen: boolean[] = [];
				TestBed.inject(TaskViewsAvailabilityService).available$.subscribe((available) => seen.push(available));
				jest.advanceTimersByTime(60 * 60_000);
				expect(builtIn).toHaveBeenCalledTimes(1);
				expect(seen).toEqual([false]);
			} finally {
				jest.useRealTimers();
			}
		});

		it('stays off on a final refusal (404: the switch is off)', () => {
			TestBed.configureTestingModule({
				providers: [
					{ provide: Store, useValue: { user$: of({ id: 'u1' }), selectedOrganization$: of({ id: 'org' }) } },
					{
						provide: TaskViewsApiService,
						useValue: { builtIn: () => throwError(() => new HttpErrorResponse({ status: 404 })) }
					}
				]
			});
			const seen: boolean[] = [];
			TestBed.inject(TaskViewsAvailabilityService).available$.subscribe((available) => seen.push(available));
			expect(seen).toEqual([false]);
		});
	});

	describe('TaskViewsOptionsService', () => {
		let http: HttpTestingController;
		let service: TaskViewsOptionsService;

		beforeEach(() => {
			TestBed.configureTestingModule({});
			http = TestBed.inject(HttpTestingController);
			service = TestBed.inject(TaskViewsOptionsService);
		});

		/** Answers every request under way; answers how many there were. */
		const answerAll = (fail: string | null = null) => {
			const requests = http.match(() => true);
			for (const request of requests) {
				if (fail && request.request.url.endsWith(fail))
					request.flush('nope', { status: 500, statusText: 'Server error' });
				else if (request.request.url.endsWith('/employee'))
					request.flush({
						items: [{ id: 'e1', user: { firstName: 'Ada', lastName: 'Lovelace' } }],
						total: 1
					});
				else
					request.flush({
						items: [
							{
								id: `${request.request.url.split('/').pop()}-1`,
								name: 'in-progress',
								value: 'in-progress'
							}
						],
						total: 1
					});
			}
			return requests.length;
		};

		it('reads the lists once per user and organization, and anew for another user', async () => {
			const scope = { organizationId: 'org' as ID, tenantId: 't' as ID, userId: 'u1' };
			const first = firstValueFrom(service.options(scope));
			answerAll();
			const options = await first;
			expect(options.status).toEqual([
				{ id: 'task-statuses-1', label: 'in progress', value: 'in-progress', color: null }
			]);
			expect(options.assignees[0]).toMatchObject({ id: 'e1', label: 'Ada Lovelace' });
			await firstValueFrom(service.options(scope));
			http.expectNone(() => true);
			const other = firstValueFrom(service.options({ ...scope, userId: 'u2' }));
			expect(answerAll()).toBe(8);
			await other;
		});

		it('reads a list that failed again next time, empty meanwhile', async () => {
			const scope = { organizationId: 'org' as ID, userId: 'u1' };
			const first = firstValueFrom(service.options(scope));
			answerAll('/task-statuses');
			expect((await first).status).toEqual([]);
			const second = firstValueFrom(service.options(scope));
			answerAll();
			expect((await second).status).toHaveLength(1);
		});
	});

	describe('TaskReferenceNavigatorService', () => {
		const resolution = {
			reference: 'API-42',
			key: 'API',
			number: 42,
			resolved: true,
			taskId: 't1',
			currentKey: 'API',
			currentNumber: 42
		};
		let toastr: { info: jest.Mock };

		function navigatorWith(
			navigate: jest.Mock,
			options: { resolve?: () => unknown; navigation?: { abort: jest.Mock } | null } = {}
		) {
			toastr = { info: jest.fn() };
			const navigation = options.navigation ?? null;
			TestBed.configureTestingModule({
				providers: [
					{
						provide: TaskViewsApiService,
						useValue: { resolveReferences: options.resolve ?? (() => of([resolution])) }
					},
					{ provide: Router, useValue: { navigate, currentNavigation: () => navigation } },
					{ provide: ToastrService, useValue: toastr }
				]
			});
			return TestBed.inject(TaskReferenceNavigatorService);
		}

		it('opens the task a reference resolves to', async () => {
			const navigate = jest.fn(() => Promise.resolve(true));
			const result = await navigatorWith(navigate).goTo('api-42', { organizationId: 'org' as ID });
			expect(navigate).toHaveBeenCalledWith(['/pages/tasks/view', 't1']);
			expect(result).toMatchObject({ opened: true, outcome: { kind: 'open' } });
			expect(toastr.info).not.toHaveBeenCalled();
		});

		it('says a former reference moved once the task opened (the box asking may be gone with its page)', async () => {
			const moved = { ...resolution, reference: 'OLD-7', formerReference: true };
			const navigate = jest.fn(() => Promise.resolve(true));
			const result = await navigatorWith(navigate, { resolve: () => of([moved]) }).goTo('OLD-7', {
				organizationId: 'org' as ID
			});
			expect(result).toMatchObject({ opened: true, outcome: { kind: 'moved' } });
			expect(toastr.info).toHaveBeenCalledWith('TASK_VIEWS.GOTO.MOVED', 'TASK_VIEWS.GOTO.TITLE', {
				translationParams: { reference: 'OLD-7', current: 'API-42' }
			});
		});

		it('says so when the router refuses or fails, and counts the page already open as opened', async () => {
			expect(
				await navigatorWith(jest.fn(() => Promise.resolve(false))).goTo('API-42', {
					organizationId: 'org' as ID
				})
			).toEqual({
				opened: false,
				messageKey: 'TASK_VIEWS.GOTO.FAILED'
			});
			TestBed.resetTestingModule();
			expect(
				(
					await navigatorWith(jest.fn(() => Promise.reject(new Error('guard')))).goTo('API-42', {
						organizationId: 'org' as ID
					})
				).opened
			).toBe(false);
			TestBed.resetTestingModule();
			expect(
				(
					await navigatorWith(jest.fn(() => Promise.resolve(null))).goTo('API-42', {
						organizationId: 'org' as ID
					})
				).opened
			).toBe(true);
		});

		it('opens nothing once the box went away', async () => {
			const navigate = jest.fn(() => Promise.resolve(true));
			const gone = new AbortController();
			gone.abort();
			const result = await navigatorWith(navigate).goTo('API-42', { organizationId: 'org' as ID }, gone.signal);
			expect(navigate).not.toHaveBeenCalled();
			expect(result).toEqual({ opened: false, messageKey: 'TASK_VIEWS.GOTO.CANCELLED' });
		});

		it('stops the lookup when the box goes away while it is under way', async () => {
			const navigate = jest.fn(() => Promise.resolve(true));
			const answer = new Subject<unknown>();
			const gone = new AbortController();
			const going = navigatorWith(navigate, { resolve: () => answer }).goTo(
				'API-42',
				{ organizationId: 'org' as ID },
				gone.signal
			);
			gone.abort();
			answer.next([resolution]);
			expect(await going).toEqual({ opened: false, messageKey: 'TASK_VIEWS.GOTO.CANCELLED' });
			expect(navigate).not.toHaveBeenCalled();
		});

		it('stops the navigation still loading the task page when the box goes away', async () => {
			let finish: (navigated: boolean) => void = () => undefined;
			const navigate = jest.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
			const navigation = { abort: jest.fn(() => finish(false)) };
			const gone = new AbortController();
			const going = navigatorWith(navigate, { navigation }).goTo(
				'API-42',
				{ organizationId: 'org' as ID },
				gone.signal
			);
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(navigate).toHaveBeenCalled();
			gone.abort();
			expect(navigation.abort).toHaveBeenCalled();
			expect(await going).toEqual({ opened: false, messageKey: 'TASK_VIEWS.GOTO.CANCELLED' });
		});
	});
});
