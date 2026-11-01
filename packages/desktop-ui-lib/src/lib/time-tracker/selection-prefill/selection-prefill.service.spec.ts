import { of } from 'rxjs';
import { Store } from '../../services/store.service';
import { ClientSelectorService } from '../../shared/features/client-selector/+state/client-selector.service';
import { ProjectSelectorService } from '../../shared/features/project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../../shared/features/task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../../shared/features/team-selector/+state/team-selector.service';
import {
	ITimeTrackerFormState,
	TimeTrackerFormService
} from '../../shared/features/time-tracker-form/time-tracker-form.service';
import { SelectorElectronService } from '../../shared/services/selector-electron.service';
import { TimeTrackerStatusService } from '../time-tracker-status/time-tracker-status.service';
import { SelectionPrefillService } from './selection-prefill.service';
import { SELECTOR_FIELDS, SelectorField } from './selection-state';

type Entry = { id: string };

/**
 * A selector as the time tracker has it: a list the employee may pick from, loaded two entries a page, and the
 * choice, which (like `SelectorStore.updateSelected`) only finds an entry of the pages loaded. A failed load resolves
 * and records its error, as the selector services do.
 */
function selector(offered: () => string[], limit = 2) {
	const list = {
		page: 1,
		data: [] as Entry[],
		selected: null as Entry | null,
		error: null as Error | null,
		/** Fails the next load. */
		failNext: false,
		/** Runs as a load starts: what the user does while the list loads. */
		onLoad: undefined as (() => void) | undefined,
		resetPage: jest.fn(() => {
			list.page = 1;
			list.data = [];
		}),
		load: jest.fn(async () => {
			list.onLoad?.();
			if (list.failNext) {
				list.failNext = false;
				list.error = new Error('Request failed');
				return;
			}
			list.error = null;
			const ids = offered().slice((list.page - 1) * limit, list.page * limit);
			list.data = [...list.data, ...ids.map((id) => ({ id }))];
		}),
		getAll: () => list.data,
		onScrollToEnd: () => {
			list.page++;
		},
		selectorQuery: {
			get hasNext() {
				return list.page * limit < offered().length;
			},
			selectError: () => of(list.error)
		},
		select: (id: string | null) => {
			list.selected = list.data.find((entry) => entry.id === id) ?? null;
		}
	};
	return list;
}

/** A promise settled from the test. */
function deferred<T>() {
	let resolve: (value: T) => void;
	const promise = new Promise<T>((done) => (resolve = done));
	return { promise, resolve };
}

/**
 * The prefill of an empty selection from the last time log (#7753): once per user and organization, never over a
 * selection of its own, each choice made in its selector's list as reloaded for the choices before it, and stored like
 * a selection the user makes (only what was chosen).
 */
describe('SelectionPrefillService', () => {
	const lastLog = {
		organizationId: 'org-1',
		organizationContactId: 'client-1',
		projectId: 'project-1',
		organizationTeamId: 'team-1',
		taskId: 'task-1',
		description: 'Notes'
	};
	let store: { organizationId: string | null; isOffline: boolean; user: { id: string } };
	let lists: Record<SelectorField, ReturnType<typeof selector>>;
	let note: string;
	let formService: { getState: jest.Mock; setState: jest.Mock };
	let statusService: { status: jest.Mock };
	let selectorElectron: { update: jest.Mock };
	let service: SelectionPrefillService;
	let running: boolean;

	beforeEach(() => {
		running = false;
		note = '';
		store = { organizationId: 'org-1', isOffline: false, user: { id: 'user-1' } };

		const chosen = (field: SelectorField) => lists[field].selected?.id;
		lists = {
			clientId: selector(() => ['client-0', 'client-1']),
			// The lists depend on the choices before them, as the selectors load them.
			projectId: selector(() => (chosen('clientId') === 'client-1' ? ['project-0', 'project-1'] : [])),
			teamId: selector(() => (chosen('projectId') === 'project-1' ? ['team-1'] : [])),
			// The last task is on the third page.
			taskId: selector(() => (chosen('projectId') === 'project-1' ? ['t-a', 't-b', 't-c', 't-d', 'task-1'] : []))
		};

		formService = {
			getState: jest.fn((): ITimeTrackerFormState => ({
				clientId: chosen('clientId') ?? '',
				projectId: chosen('projectId') ?? '',
				teamId: chosen('teamId') ?? '',
				taskId: chosen('taskId') ?? '',
				note
			})),
			// As TimeTrackerFormService does, in its order; choosing a project clears the team and task lists
			// (project-selector.component), so a team set right after its project is not found.
			setState: jest.fn((state: Partial<ITimeTrackerFormState>) => {
				if (state.note !== undefined) note = state.note;
				for (const field of ['taskId', 'projectId', 'teamId', 'clientId'] as const) {
					if (state[field] === undefined) continue;
					lists[field].select(state[field]);
					if (field === 'projectId') {
						lists.teamId.resetPage();
						lists.taskId.resetPage();
					}
				}
			})
		};
		statusService = { status: jest.fn(async () => ({ running: false, lastLog })) };
		selectorElectron = { update: jest.fn() };
		service = new SelectionPrefillService(
			store as unknown as Store,
			statusService as unknown as TimeTrackerStatusService,
			formService as unknown as TimeTrackerFormService,
			selectorElectron as unknown as SelectorElectronService,
			lists.clientId as unknown as ClientSelectorService,
			lists.projectId as unknown as ProjectSelectorService,
			lists.teamId as unknown as TeamSelectorService,
			lists.taskId as unknown as TaskSelectorService
		);
	});

	const prefill = (saved?: Partial<ITimeTrackerFormState>) => service.prefill(() => running, saved);
	const clear = () => {
		SELECTOR_FIELDS.forEach((field) => (lists[field].selected = null));
		note = '';
	};
	const all = { clientId: 'client-1', projectId: 'project-1', teamId: 'team-1', taskId: 'task-1', note: 'Notes' };
	const stored = {
		organizationContactId: 'client-1',
		projectId: 'project-1',
		organizationTeamId: 'team-1',
		taskId: 'task-1',
		note: 'Notes'
	};

	it('chooses client, project, team and task in turn, each in its list reloaded for the choices before it', async () => {
		await expect(prefill()).resolves.toEqual(all);

		expect(formService.getState()).toEqual(all);
		// The team is offered once its project is chosen, the task found on the third page.
		expect(lists.teamId.load).toHaveBeenCalled();
		expect(lists.taskId.load).toHaveBeenCalledTimes(3);
		expect(selectorElectron.update).toHaveBeenCalledWith(stored);
	});

	it('CONTROL: setting the linked choices at once loses the team (the bug the stages avoid)', () => {
		lists.clientId.data = [{ id: 'client-1' }];
		lists.projectId.data = [{ id: 'project-1' }];
		lists.teamId.data = [{ id: 'team-1' }];

		formService.setState(all);

		expect(formService.getState().projectId).toBe('project-1');
		expect(formService.getState().teamId).toBe('');
	});

	it('leaves out a choice the employee can no longer pick, and stores only what was chosen', async () => {
		statusService.status.mockResolvedValueOnce({ running: false, lastLog: { ...lastLog, taskId: 'task-gone' } });

		await expect(prefill()).resolves.toEqual({ ...all, taskId: undefined });

		expect(formService.getState().taskId).toBe('');
		expect(selectorElectron.update).toHaveBeenCalledWith({ ...stored, taskId: undefined });
	});

	it('runs once per user and organization: a selection cleared afterwards stays cleared', async () => {
		await prefill();
		clear();

		await expect(prefill()).resolves.toBeNull();
		expect(statusService.status).toHaveBeenCalledTimes(1);
	});

	it('runs again in another organization, or after reset()', async () => {
		await prefill();
		clear();
		store.organizationId = 'org-2';
		statusService.status.mockResolvedValueOnce({
			running: false,
			lastLog: { ...lastLog, organizationId: 'org-2' }
		});

		await expect(prefill()).resolves.not.toBeNull();

		// Switching back clears the selection, and the switch calls reset().
		clear();
		store.organizationId = 'org-1';
		service.reset();
		await expect(prefill()).resolves.not.toBeNull();
	});

	it('drops an answer for an organization left while it was pending', async () => {
		const answer = deferred<unknown>();
		statusService.status.mockReturnValueOnce(answer.promise);

		const pending = prefill();
		// The user switches organization: the switch resets, and the new organization's form is empty.
		store.organizationId = 'org-2';
		service.reset();
		answer.resolve({ running: false, lastLog });

		await expect(pending).resolves.toBeNull();
		expect(formService.setState).not.toHaveBeenCalled();
		expect(selectorElectron.update).not.toHaveBeenCalled();
	});

	it('tries again on the next load after a failed lookup', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		statusService.status.mockRejectedValueOnce(new Error('offline'));

		await expect(prefill()).resolves.toBeNull();
		expect(formService.setState).not.toHaveBeenCalled();

		await expect(prefill()).resolves.toEqual(all);
		expect(statusService.status).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});

	it('takes back an attempt whose list could not load, stores nothing and tries again on the next load', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		// Client and project are chosen, then the team list fails to load.
		lists.teamId.failNext = true;

		await expect(prefill()).resolves.toBeNull();
		expect(formService.getState()).toEqual({ clientId: '', projectId: '', teamId: '', taskId: '', note: '' });
		expect(selectorElectron.update).not.toHaveBeenCalled();

		await expect(prefill()).resolves.toEqual(all);
		expect(selectorElectron.update).toHaveBeenCalledWith(stored);
		warn.mockRestore();
	});

	it('takes back an attempt that went offline while a list loaded', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		lists.projectId.onLoad = () => {
			lists.projectId.onLoad = undefined;
			store.isOffline = true;
		};

		await expect(prefill()).resolves.toBeNull();
		expect(formService.getState().clientId).toBe('');
		expect(selectorElectron.update).not.toHaveBeenCalled();

		store.isOffline = false;
		await expect(prefill()).resolves.toEqual(all);
		warn.mockRestore();
	});

	it('runs one lookup at a time', async () => {
		const answer = deferred<unknown>();
		statusService.status.mockReturnValueOnce(answer.promise);

		const first = prefill();
		await expect(prefill()).resolves.toBeNull();
		answer.resolve({ running: false, lastLog });

		await expect(first).resolves.toEqual(all);
		expect(statusService.status).toHaveBeenCalledTimes(1);
	});

	it('leaves a selection of its own alone, without asking the server', async () => {
		lists.taskId.selected = { id: 'mine' };

		await expect(prefill()).resolves.toBeNull();
		expect(statusService.status).not.toHaveBeenCalled();
		expect(formService.setState).not.toHaveBeenCalled();
	});

	it('leaves a saved choice alone that the selectors could not show yet', async () => {
		// Cold start: the saved project was set before the lists loaded, so the form shows nothing.
		await expect(prefill({ projectId: 'saved-project' })).resolves.toBeNull();

		expect(statusService.status).not.toHaveBeenCalled();
		expect(selectorElectron.update).not.toHaveBeenCalled();
	});

	it('stops when the user starts choosing during the lookup, keeping their choice', async () => {
		// While the team list loads, the user picks another project.
		lists.teamId.onLoad = () => {
			lists.teamId.onLoad = undefined;
			lists.projectId.selected = { id: 'project-0' };
		};

		await expect(prefill()).resolves.toEqual({ clientId: 'client-1' });

		expect(formService.getState()).toEqual({ ...all, projectId: 'project-0', teamId: '', taskId: '', note: '' });
		// Only what the prefill chose and the user kept is stored: never over the user's project.
		expect(selectorElectron.update).toHaveBeenCalledWith({ organizationContactId: 'client-1' });
	});

	it('chooses nothing more once a timer start begins: the timer tracks the selection shown when it starts', async () => {
		// The user presses Start while the team list loads (`isRunning` covers the start under way).
		lists.teamId.onLoad = () => {
			lists.teamId.onLoad = undefined;
			running = true;
		};

		await expect(prefill()).resolves.toBeNull();

		// What was shown when the start began stays (the start sent it), and nothing is chosen after it.
		expect(formService.getState()).toEqual({ ...all, teamId: '', taskId: '', note: '' });
		expect(lists.teamId.load).toHaveBeenCalledTimes(1);
		expect(lists.taskId.load).not.toHaveBeenCalled();
		expect(selectorElectron.update).not.toHaveBeenCalled();
	});

	it('takes back an attempt a reload interrupts and starts over, instead of stopping for good', async () => {
		// The reload (timer_tracker_show) comes while the team list loads: it cancels, then replays the saved selection.
		lists.teamId.onLoad = () => {
			lists.teamId.onLoad = undefined;
			service.cancel();
		};

		await expect(prefill()).resolves.toBeNull();
		expect(formService.getState()).toEqual({ clientId: '', projectId: '', teamId: '', taskId: '', note: '' });
		expect(selectorElectron.update).not.toHaveBeenCalled();

		// The reload's own prefill.
		await expect(prefill()).resolves.toEqual(all);
		expect(selectorElectron.update).toHaveBeenCalledWith(stored);
	});

	it('stays settled through a reload once it ran: a selection cleared afterwards stays cleared', async () => {
		await prefill();
		clear();
		service.cancel();

		await expect(prefill()).resolves.toBeNull();
		expect(statusService.status).toHaveBeenCalledTimes(1);
	});

	it('does nothing while the timer runs, including when it started during the request', async () => {
		statusService.status.mockImplementationOnce(async () => {
			running = true;
			return { running: false, lastLog };
		});

		await expect(prefill()).resolves.toBeNull();
		expect(formService.setState).not.toHaveBeenCalled();
	});

	it('does nothing offline or outside an organization', async () => {
		store.isOffline = true;
		await expect(prefill()).resolves.toBeNull();

		store.isOffline = false;
		store.organizationId = null;
		await expect(prefill()).resolves.toBeNull();

		expect(statusService.status).not.toHaveBeenCalled();
	});
});
