import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { Store, ToastrNotificationService } from '../../services';
import { TimeTrackerService } from '../../time-tracker/time-tracker.service';
import { ClientSelectorQuery } from '../features/client-selector/+state/client-selector.query';
import { ClientSelectorService } from '../features/client-selector/+state/client-selector.service';
import { ClientSelectorStore } from '../features/client-selector/+state/client-selector.store';
import { ProjectSelectorQuery } from '../features/project-selector/+state/project-selector.query';
import { ProjectSelectorService } from '../features/project-selector/+state/project-selector.service';
import { ProjectSelectorStore } from '../features/project-selector/+state/project-selector.store';
import { TaskSelectorQuery } from '../features/task-selector/+state/task-selector.query';
import { TaskSelectorService } from '../features/task-selector/+state/task-selector.service';
import { TaskSelectorStore } from '../features/task-selector/+state/task-selector.store';
import { TeamSelectorQuery } from '../features/team-selector/+state/team-selector.query';
import { TeamSelectorService } from '../features/team-selector/+state/team-selector.service';
import { TeamSelectorStore } from '../features/team-selector/+state/team-selector.store';
import { SelectorQuery } from './selector.query';
import { SelectorService } from './selector.service';

type Entry = { id: string };

/** The requests a selector sent, answered from the test in any order. */
function pendingRequests() {
	const requests: { resolve: (items: Entry[]) => void; reject: (error: Error) => void }[] = [];
	const send = () =>
		new Promise<{ items: Entry[]; total: number }>((resolve, reject) =>
			requests.push({ resolve: (items) => resolve({ items, total: items.length }), reject })
		);
	return { requests, send };
}

interface Harness {
	service: SelectorService<Entry>;
	query: SelectorQuery<Entry>;
}

type Deps = {
	timeTracker: TimeTrackerService;
	store: Store;
	toastr: ToastrNotificationService;
	translate: TranslateService;
};

/** The four selectors of the time tracker, built over their real stores. */
const selectors: [string, keyof TimeTrackerService, (deps: Deps) => Harness][] = [
	[
		'clients',
		'getPaginatedClients',
		({ timeTracker, store, toastr, translate }) => {
			const query = new ClientSelectorQuery(new ClientSelectorStore());
			const service = new ClientSelectorService(
				query['store'] as ClientSelectorStore,
				query,
				timeTracker,
				null,
				null,
				store,
				toastr,
				translate
			);
			return { service, query } as unknown as Harness;
		}
	],
	[
		'projects',
		'getPaginatedProjects',
		({ timeTracker, store, toastr, translate }) => {
			const query = new ProjectSelectorQuery(new ProjectSelectorStore());
			const service = new ProjectSelectorService(
				query['store'] as ProjectSelectorStore,
				query,
				new ClientSelectorQuery(new ClientSelectorStore()),
				new TeamSelectorQuery(new TeamSelectorStore()),
				timeTracker,
				store,
				toastr,
				translate
			);
			return { service, query } as unknown as Harness;
		}
	],
	[
		'teams',
		'getPaginatedTeams',
		({ timeTracker, store, toastr }) => {
			const query = new TeamSelectorQuery(new TeamSelectorStore());
			const service = new TeamSelectorService(
				query['store'] as TeamSelectorStore,
				query,
				new ProjectSelectorQuery(new ProjectSelectorStore()),
				timeTracker,
				toastr,
				store
			);
			return { service, query } as unknown as Harness;
		}
	],
	[
		'tasks',
		'getPaginatedTasks',
		({ timeTracker, store, toastr, translate }) => {
			const query = new TaskSelectorQuery(new TaskSelectorStore());
			const service = new TaskSelectorService(
				query['store'] as TaskSelectorStore,
				query,
				new ProjectSelectorQuery(new ProjectSelectorStore()),
				new TeamSelectorQuery(new TeamSelectorStore()),
				timeTracker,
				toastr,
				translate,
				store
			);
			return { service, query } as unknown as Harness;
		}
	]
];

/**
 * A selector empties its list when what it lists changes (an organization switch, a new search, another project for
 * the teams and tasks), and an answer to a request made before, coming in late, must not put the old entries back in
 * the list, where the user could pick them and the timer would track them.
 */
describe.each(selectors)('the %s selector', (_name, method, build) => {
	let store: { organizationId: string; tenantId: string; isOffline: boolean; user: { employee: { id: string } } };
	let toastr: { error: jest.Mock; success: jest.Mock };
	let requests: ReturnType<typeof pendingRequests>['requests'];
	let selector: Harness;

	beforeEach(() => {
		const pending = pendingRequests();
		requests = pending.requests;
		store = {
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			isOffline: false,
			user: { employee: { id: 'emp-1' } }
		};
		toastr = { error: jest.fn(), success: jest.fn() };
		const timeTracker = { [method]: jest.fn(pending.send), getTasksStatistics: jest.fn(async () => []) };
		selector = build({
			timeTracker: timeTracker as unknown as TimeTrackerService,
			store: store as unknown as Store,
			toastr: toastr as unknown as ToastrNotificationService,
			translate: { instant: (key: string) => key } as unknown as TranslateService
		});
	});

	const ids = () => selector.service.getAll().map((entry) => entry.id);

	it('puts the answer for the list shown in the list', async () => {
		const load = selector.service.load();
		requests[0].resolve([{ id: 'a' }]);
		await load;

		expect(ids()).toEqual(['a']);
	});

	it('drops a late answer for the organization left: its entries cannot be picked in the new one', async () => {
		const oldLoad = selector.service.load();
		// The organization switch: the new organization, the list emptied (resetWorkSelection), and its load.
		store.organizationId = 'org-2';
		selector.service.resetPage();
		const newLoad = selector.service.load();

		requests[1].resolve([{ id: 'new' }]);
		await newLoad;
		requests[0].resolve([{ id: 'old' }]);
		await oldLoad;

		expect(ids()).toEqual(['new']);
	});

	it('drops a late answer for a list emptied since (a new search, or another project)', async () => {
		const load = selector.service.load();
		selector.service.resetPage();
		requests[0].resolve([{ id: 'stale' }]);
		await load;

		expect(ids()).toEqual([]);
	});

	it('does not report a late failure on the list shown', async () => {
		const load = selector.service.load();
		selector.service.resetPage();
		requests[0].reject(new Error('Request failed'));
		await load;

		await expect(firstValueFrom(selector.query.selectError())).resolves.toBeFalsy();
		expect(toastr.error).not.toHaveBeenCalled();
	});
});
