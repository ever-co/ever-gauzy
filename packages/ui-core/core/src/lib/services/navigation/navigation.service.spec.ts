import { Subject } from 'rxjs';
import { NavigationEnd, NavigationSkipped, Params, Router } from '@angular/router';
import { NavigationService } from './navigation.service';

/**
 * Constructed directly — no `TestBed` (the ui-core barrel pulls the whole app
 * graph). The router double records `navigate()` calls and lets each test
 * control the two inputs the service's scheduling depends on: the in-flight
 * navigation (`getCurrentNavigation`) and the settle events stream.
 */
interface RecordedNavigate {
	commands: unknown[];
	extras: { queryParams?: Params; queryParamsHandling?: string; replaceUrl?: boolean };
}

function createService(overrides: { currentNavigation?: () => unknown } = {}) {
	const events$ = new Subject<unknown>();
	const navigations: RecordedNavigate[] = [];
	const router = {
		events: events$.asObservable(),
		getCurrentNavigation: overrides.currentNavigation ?? (() => null),
		navigate: jest.fn(async (commands: unknown[], extras: RecordedNavigate['extras']) => {
			navigations.push({ commands, extras });
			return true;
		})
	} as unknown as Router;
	const activatedRoute = {} as never;
	const destroyRef = { onDestroy: () => () => {} } as never;

	const service = new NavigationService(router, activatedRoute, destroyRef);
	return { service, router, events$, navigations };
}

/** The flush is a macrotask — one real timer tick lets it run. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('NavigationService — router-owned query-param writes', () => {
	it('writes through router.navigate with merge + replaceUrl (no history entry, tree stays in sync)', async () => {
		const { service, navigations } = createService();

		await service.updateQueryParams({ date: '2026-08-01', unit_of_time: 'month' });

		expect(navigations).toHaveLength(1);
		expect(navigations[0].commands).toEqual([]);
		expect(navigations[0].extras.queryParamsHandling).toBe('merge');
		expect(navigations[0].extras.replaceUrl).toBe(true);
		expect(navigations[0].extras.queryParams).toEqual({ date: '2026-08-01', unit_of_time: 'month' });
	});

	it("maps '' and empty arrays to null — the router's removal — so 'All Teams' still removes ?teamId", async () => {
		const { service, navigations } = createService();

		await service.updateQueryParams({ teamId: '', tags: [], archived: false });

		expect(navigations[0].extras.queryParams).toEqual({ teamId: null, tags: null, archived: false });
	});

	it('deduplicates array values (the old buildQueryString contract)', async () => {
		const { service, navigations } = createService();

		await service.updateQueryParams({ tags: ['a', 'b', 'a'] });

		expect(navigations[0].extras.queryParams).toEqual({ tags: ['a', 'b'] });
	});

	it('coalesces a same-tick burst into ONE navigation, last value per key wins', async () => {
		const { service, navigations } = createService();

		const first = service.updateQueryParams({ teamId: '', projectId: 'p1' });
		const second = service.updateQueryParams({ teamId: 't2' });
		await Promise.all([first, second]);

		expect(navigations).toHaveLength(1);
		expect(navigations[0].extras.queryParams).toEqual({ teamId: 't2', projectId: 'p1' });
	});

	it('parks the patch while a navigation is in flight and retries once it settles — never mid-flight', async () => {
		let inFlight: unknown = { id: 1 };
		const { service, events$, navigations } = createService({ currentNavigation: () => inFlight });

		const write = service.updateQueryParams({ date: '2026-08-01' });
		await tick();
		// Still in flight at flush time: nothing written, nothing lost.
		expect(navigations).toHaveLength(0);

		inFlight = null;
		events$.next(new NavigationEnd(1, '/pages/x', '/pages/x'));
		await write;

		expect(navigations).toHaveLength(1);
		expect(navigations[0].extras.queryParams).toEqual({ date: '2026-08-01' });
	});

	it('a NavigationSkipped settle also releases parked patches (idempotent re-write loop terminator)', async () => {
		let inFlight: unknown = { id: 1 };
		const { service, events$, navigations } = createService({ currentNavigation: () => inFlight });

		const write = service.updateQueryParams({ organizationId: 'org-1' });
		await tick();
		expect(navigations).toHaveLength(0);

		inFlight = null;
		events$.next(new NavigationSkipped(1, '/pages/x', 'ignored'));
		await write;

		expect(navigations).toHaveLength(1);
	});

	it('a non-merge patch replaces the pending accumulation wholesale', async () => {
		const { service, navigations } = createService();

		const first = service.updateQueryParams({ keepMe: 'no' });
		const second = service.updateQueryParams({ onlyMe: 'yes' }, '');
		await Promise.all([first, second]);

		expect(navigations).toHaveLength(1);
		expect(navigations[0].extras.queryParams).toEqual({ onlyMe: 'yes' });
	});
});
