import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { INBOX_AVAILABILITY_RETRY_MS, InboxAvailabilityService, isFinalRefusal } from './inbox-availability.service';
import { InboxUiService } from './inbox-ui.service';

/** Whether the API serves the Inbox: asked once per user, temporary failures retried. */
describe('InboxAvailabilityService', () => {
	const api = { counts: jest.fn() };
	const user$ = new BehaviorSubject<{ id: string } | null>({ id: 'user-1' });

	function service(): InboxAvailabilityService {
		TestBed.configureTestingModule({
			providers: [
				{ provide: InboxUiService, useValue: api },
				{ provide: Store, useValue: { user$ } }
			]
		});
		return TestBed.inject(InboxAvailabilityService);
	}

	beforeEach(() => jest.resetAllMocks());

	it('knows the refusals that do not change', () => {
		expect(isFinalRefusal({ status: 404 } as never)).toBe(true);
		expect(isFinalRefusal({ status: 403 } as never)).toBe(true);
		expect(isFinalRefusal({ status: 502 } as never)).toBe(false);
		expect(isFinalRefusal({ status: 0 } as never)).toBe(false);
	});

	it('404: false at once, asked once', fakeAsync(() => {
		api.counts.mockReturnValue(throwError(() => ({ status: 404 })));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		tick(INBOX_AVAILABILITY_RETRY_MS * 100);
		expect(values).toEqual([false]);
		expect(api.counts).toHaveBeenCalledTimes(1);
	}));

	it('a temporary failure is retried, so a recovered API shows the Inbox', fakeAsync(() => {
		api.counts
			.mockReturnValueOnce(throwError(() => ({ status: 502 })))
			.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([]);
		tick(INBOX_AVAILABILITY_RETRY_MS);
		expect(values).toEqual([true]);
		expect(api.counts).toHaveBeenCalledTimes(2);
	}));
});
