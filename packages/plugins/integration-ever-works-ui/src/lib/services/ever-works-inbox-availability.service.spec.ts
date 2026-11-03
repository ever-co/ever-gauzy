import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import {
	EVER_WORKS_INBOX_AVAILABILITY_RETRY_MS,
	EverWorksInboxAvailabilityService
} from './ever-works-inbox-availability.service';
import { EverWorksUiService } from './ever-works.service';

/** Whether Settings → Ever Works inbox is offered: my preferences answered, asked once per signed-in user. */
describe('EverWorksInboxAvailabilityService', () => {
	const api = { inboxPreferences: jest.fn() };
	let user$: BehaviorSubject<{ id: string } | null>;

	function service(): EverWorksInboxAvailabilityService {
		user$ = new BehaviorSubject<{ id: string } | null>({ id: 'u1' });
		TestBed.configureTestingModule({
			providers: [
				{ provide: EverWorksUiService, useValue: api },
				{ provide: Store, useValue: { user$ } }
			]
		});
		return TestBed.inject(EverWorksInboxAvailabilityService);
	}

	beforeEach(() => jest.resetAllMocks());

	it('the route answers: true', () => {
		api.inboxPreferences.mockReturnValue(of({ available: [], kinds: {}, updatedAt: null, organizations: [] }));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([true]);
	});

	// 404: the Ever Works plugin is off; 403: no INBOX_VIEW; 401: signed out meanwhile.
	it.each([404, 403, 401])('%i: false at once, asked once', (status) =>
		fakeAsync(() => {
			api.inboxPreferences.mockReturnValue(throwError(() => ({ status })));
			const values: boolean[] = [];
			service().available$.subscribe((value) => values.push(value));
			tick(EVER_WORKS_INBOX_AVAILABILITY_RETRY_MS * 100);
			expect(values).toEqual([false]);
			expect(api.inboxPreferences).toHaveBeenCalledTimes(1);
		})()
	);

	it('a temporary failure is retried', fakeAsync(() => {
		api.inboxPreferences.mockReturnValueOnce(throwError(() => ({ status: 503 }))).mockReturnValue(of({}));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([]);
		tick(EVER_WORKS_INBOX_AVAILABILITY_RETRY_MS);
		expect(values).toEqual([true]);
	}));

	it('signed out: false without asking; another user asks again', () => {
		api.inboxPreferences.mockReturnValue(of({}));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		user$.next(null);
		user$.next({ id: 'u2' });
		expect(values).toEqual([true, false, true]);
		expect(api.inboxPreferences).toHaveBeenCalledTimes(2);
	});
});
