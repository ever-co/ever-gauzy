import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { INBOX_AVAILABILITY_RETRY_MS, InboxAvailabilityService } from './inbox-availability.service';
import { InboxEmailAvailabilityService } from './inbox-email-availability.service';
import { InboxEmailSettingsService } from './inbox-email-settings.service';

/** Whether the API serves the Inbox email features: asked only where the Inbox is served, once per answer of it. */
describe('InboxEmailAvailabilityService', () => {
	const api = { myMailboxes: jest.fn() };
	let inbox$: BehaviorSubject<boolean>;

	function service(): InboxEmailAvailabilityService {
		inbox$ = new BehaviorSubject<boolean>(true);
		TestBed.configureTestingModule({
			providers: [
				{ provide: InboxEmailSettingsService, useValue: api },
				{ provide: InboxAvailabilityService, useValue: { available$: inbox$ } }
			]
		});
		return TestBed.inject(InboxEmailAvailabilityService);
	}

	beforeEach(() => jest.resetAllMocks());

	it('the Inbox is not served: false, and the email route is never asked', () => {
		const email = service();
		inbox$.next(false);
		const values: boolean[] = [];
		email.available$.subscribe((value) => values.push(value));
		expect(values).toEqual([false]);
		expect(api.myMailboxes).not.toHaveBeenCalled();
	});

	it('the email route answers: true', () => {
		api.myMailboxes.mockReturnValue(of([]));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([true]);
	});

	it('404 (the email features are off): false at once, asked once', fakeAsync(() => {
		api.myMailboxes.mockReturnValue(throwError(() => ({ status: 404 })));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		tick(INBOX_AVAILABILITY_RETRY_MS * 100);
		expect(values).toEqual([false]);
		expect(api.myMailboxes).toHaveBeenCalledTimes(1);
	}));

	it('a temporary failure is retried', fakeAsync(() => {
		api.myMailboxes.mockReturnValueOnce(throwError(() => ({ status: 503 }))).mockReturnValue(of([]));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([]);
		tick(INBOX_AVAILABILITY_RETRY_MS);
		expect(values).toEqual([true]);
	}));

	it('another answer of the Inbox check (another user) asks again; losing the Inbox is false at once', () => {
		api.myMailboxes.mockReturnValue(of([]));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		inbox$.next(true);
		expect(api.myMailboxes).toHaveBeenCalledTimes(2);
		inbox$.next(false);
		expect(values).toEqual([true, true, false]);
	});
});
