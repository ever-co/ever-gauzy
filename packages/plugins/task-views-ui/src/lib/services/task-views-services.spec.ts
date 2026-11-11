// The ui-core barrel boots half the app (and needs packages this spec does not have): what the services name from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {}
}));

import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of, Subject, throwError } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TaskReferenceNavigatorService } from './task-reference-navigator.service';
import { TaskViewsApiService } from './task-views-api.service';
import { TaskViewsAvailabilityService } from './task-views-availability.service';
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

		function navigatorWith(navigate: jest.Mock) {
			TestBed.configureTestingModule({
				providers: [
					{ provide: TaskViewsApiService, useValue: { resolveReferences: () => of([resolution]) } },
					{ provide: Router, useValue: { navigate } }
				]
			});
			return TestBed.inject(TaskReferenceNavigatorService);
		}

		it('opens the task a reference resolves to', async () => {
			const navigate = jest.fn(() => Promise.resolve(true));
			const result = await navigatorWith(navigate).goTo('api-42', { organizationId: 'org' as ID });
			expect(navigate).toHaveBeenCalledWith(['/pages/tasks/view', 't1']);
			expect(result).toMatchObject({ opened: true, outcome: { kind: 'open' } });
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
			const result = await navigatorWith(navigate).goTo('API-42', { organizationId: 'org' as ID }, () => true);
			expect(navigate).not.toHaveBeenCalled();
			expect(result.opened).toBe(false);
		});
	});
});
