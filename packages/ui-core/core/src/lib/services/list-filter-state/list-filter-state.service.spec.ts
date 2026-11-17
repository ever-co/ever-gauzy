/**
 * The service injects `Store` by token only. Its module is replaced with an empty class so the spec never loads the
 * Akita store (which reaches into the `@gauzy/ui-core/common` barrel); the token is satisfied by a double below.
 */
jest.mock('../store/store.service', () => ({ Store: class Store {} }));

import { Injector, runInInjectionContext } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { NavigationCancel, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { IOrganization, IUser } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { ListFilterStateService } from './list-filter-state.service';

type Trigger = 'imperative' | 'popstate';

/**
 * Created in a bare injector, like the chat sidebar service's spec. The router double holds the current URL and
 * replays the navigation events the way the router does: the URL changes only once a navigation has started, and
 * a refused one leaves it as it was. The store double holds the signed-in user and the selected organization.
 */
function createHarness(initialUrl = '/pages/tasks/dashboard') {
	const events$ = new Subject<unknown>();
	const router = { events: events$.asObservable(), url: initialUrl };
	const user$ = new BehaviorSubject<IUser | null>({ id: 'user-1', tenantId: 'tenant-1' } as IUser);
	const organization$ = new BehaviorSubject<IOrganization | null>({ id: 'org-1' } as IOrganization);
	const store = {
		user$,
		selectedOrganization$: organization$,
		get user() {
			return user$.getValue();
		},
		get selectedOrganization() {
			return organization$.getValue();
		}
	};
	const injector = Injector.create({
		providers: [
			{ provide: Router, useValue: router },
			{ provide: Store, useValue: store }
		]
	});
	const service = runInInjectionContext(injector, () => new ListFilterStateService());
	let id = 0;

	return {
		service,
		user$,
		organization$,
		/** Starts a navigation to `url` and lands on it, or on `landsOn` when the route redirects. */
		go(url: string, trigger: Trigger = 'imperative', landsOn = url) {
			events$.next(new NavigationStart(++id, url, trigger));
			router.url = landsOn;
			events$.next(new NavigationEnd(id, url, landsOn));
		},
		/** Starts a navigation to `url` that a guard refuses: the user stays where they are. */
		refuse(url: string, trigger: Trigger = 'imperative') {
			events$.next(new NavigationStart(++id, url, trigger));
			events$.next(new NavigationCancel(id, url, 'refused by a guard'));
		}
	};
}

describe('ListFilterStateService', () => {
	const LIST = '/pages/tasks/dashboard';
	const DETAIL = '/pages/tasks/view/1';

	it('gives a filter back when the list is opened by Back', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');

		go(DETAIL);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBe('login bug');
	});

	it('gives a filter back for the whole visit, however often the page asks', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);
		go(LIST, 'popstate');

		// A page that rebuilds its table settings gets new filters from the table, and each asks again: the second
		// must show what the first filtered the list by, not an empty box.
		expect(service.restore('title')).toBe('login bug');
		expect(service.restore('title')).toBe('login bug');
	});

	it('gives back what the user chose since on the restored list', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);
		go(LIST, 'popstate');
		expect(service.restore('title')).toBe('login bug');

		service.record('title', 'crash');

		expect(service.restore('title')).toBe('crash');
	});

	it('does not give back a filter the user cleared on the restored list', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		service.record('status', 'open');
		go(DETAIL);
		go(LIST, 'popstate');
		expect(service.restore('title')).toBe('login bug');

		service.record('title', '');

		// A filter the table re-creates now stays empty, like the list.
		expect(service.restore('title')).toBeUndefined();
		expect(service.restore('status')).toBe('open');
	});

	it('gives the filters back again when the user leaves the restored list and comes Back', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);
		go(LIST, 'popstate');
		expect(service.restore('title')).toBe('login bug');
		service.record('status', 'open');

		go('/pages/tasks/view/2');
		expect(service.restore('title')).toBeUndefined();
		go(LIST, 'popstate');

		expect(service.restore('title')).toBe('login bug');
		expect(service.restore('status')).toBe('open');
	});

	it('restores several columns of the same list', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login');
		service.record('taskNumber', 'GAU-7');
		go(DETAIL);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBe('login');
		expect(service.restore('taskNumber')).toBe('GAU-7');
	});

	it('starts clean when the list is opened any other way', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');

		go(DETAIL);
		go(LIST); // a menu click or a link

		// However often the page asks (a page that rebuilds its table settings asks again).
		expect(service.restore('title')).toBeUndefined();
		expect(service.restore('title')).toBeUndefined();

		// ...and the next Back finds nothing from the visit before.
		go(DETAIL);
		go(LIST, 'popstate');
		expect(service.restore('title')).toBeUndefined();
	});

	it('does not give a cleared filter back', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		service.record('title', '');

		go(DETAIL);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBeUndefined();
	});

	it('keeps each list to its own filters', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go('/pages/employees');
		service.record('title', 'ann');

		go(DETAIL);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBe('login bug');
	});

	it('ignores a change of the query alone', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);
		go(LIST, 'popstate');

		// The app writes the organization and date range into the URL after the page opens.
		go(`${LIST}?organizationId=1`);

		expect(service.restore('title')).toBe('login bug');
	});

	it('does not restore on a page the history step did not open', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);
		go(LIST, 'popstate');
		go('/pages/employees');

		expect(service.restore('title')).toBeUndefined();
	});

	it('starts clean when a link reaches the list through a redirect', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);

		go('/pages/tasks', 'imperative', LIST); // a menu entry whose route redirects to the list
		expect(service.restore('title')).toBeUndefined();

		go(DETAIL);
		go(LIST, 'popstate');
		expect(service.restore('title')).toBeUndefined();
	});

	it('keeps the filters when a guard refuses a visit to the list', () => {
		const { service, go, refuse } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);

		refuse(LIST);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBe('login bug');
	});

	it('keeps what a restored list can still take back when a guard refuses leaving it', () => {
		const { service, go, refuse } = createHarness(LIST);
		service.record('title', 'login bug');
		service.record('status', 'open');
		go(DETAIL);
		go(LIST, 'popstate');
		expect(service.restore('title')).toBe('login bug');

		refuse(DETAIL);

		expect(service.restore('status')).toBe('open');
		expect(service.restore('title')).toBe('login bug');
	});

	it('forgets every filter when the user signs out', () => {
		const { service, go, user$ } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);

		user$.next(null);
		user$.next({ id: 'user-2', tenantId: 'tenant-2' } as IUser);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBeUndefined();
	});

	it('forgets every filter when the organization changes', () => {
		const { service, go, organization$ } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);

		organization$.next({ id: 'org-2' } as IOrganization);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBeUndefined();
	});

	it('keeps the filters when the same user and organization are set again', () => {
		const { service, go, user$, organization$ } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);

		user$.next({ id: 'user-1', tenantId: 'tenant-1' } as IUser);
		organization$.next({ id: 'org-1' } as IOrganization);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBe('login bug');
	});
});
