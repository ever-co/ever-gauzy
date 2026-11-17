import { Subject } from 'rxjs';
import { NavigationStart, Router } from '@angular/router';
import { ListFilterStateService } from './list-filter-state.service';

/**
 * Constructed directly, like the navigation service's spec. The router double holds the current URL and replays
 * `NavigationStart` the way the router does: the URL changes only once the navigation has started.
 */
function createHarness(initialUrl = '/pages/tasks/dashboard') {
	const events$ = new Subject<unknown>();
	const router = { events: events$.asObservable(), url: initialUrl } as unknown as Router & { url: string };
	const service = new ListFilterStateService(router);
	let id = 0;

	return {
		service,
		/** Starts a navigation to `url` and lands on it. */
		go(url: string, trigger: 'imperative' | 'popstate' = 'imperative') {
			events$.next(new NavigationStart(++id, url, trigger));
			(router as { url: string }).url = url;
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

	it('gives each filter back once', () => {
		const { service, go } = createHarness(LIST);
		service.record('title', 'login bug');
		go(DETAIL);
		go(LIST, 'popstate');

		expect(service.restore('title')).toBe('login bug');
		expect(service.restore('title')).toBeUndefined();
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
});
