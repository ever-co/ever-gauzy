import { Store } from '../../services/store.service';
import {
	ITimeTrackerFormState,
	TimeTrackerFormService
} from '../../shared/features/time-tracker-form/time-tracker-form.service';
import { SelectorElectronService } from '../../shared/services/selector-electron.service';
import { TimeTrackerStatusService } from '../time-tracker-status/time-tracker-status.service';
import { SelectionPrefillService } from './selection-prefill.service';

/**
 * The prefill of an empty selection from the last time log (#7753): once per user and organization, never over a
 * selection of its own, and stored like a selection the user makes (only what the selectors accepted).
 */
describe('SelectionPrefillService', () => {
	const lastLog = { organizationId: 'org-1', projectId: 'project-1', taskId: 'task-1', description: 'Notes' };
	let store: { organizationId: string | null; isOffline: boolean; user: { id: string } };
	let form: ITimeTrackerFormState;
	let formService: { getState: jest.Mock; setState: jest.Mock };
	let statusService: { status: jest.Mock };
	let selectorElectron: { update: jest.Mock };
	let service: SelectionPrefillService;
	let running: boolean;

	beforeEach(() => {
		running = false;
		store = { organizationId: 'org-1', isOffline: false, user: { id: 'user-1' } };
		form = { clientId: '', projectId: '', teamId: '', taskId: '', note: '' };
		formService = {
			getState: jest.fn(() => ({ ...form })),
			// The selectors accept the project only: the task is not among the ones loaded.
			setState: jest.fn((state: Partial<ITimeTrackerFormState>) => {
				form = { ...form, projectId: state.projectId ?? form.projectId, note: state.note ?? form.note };
			})
		};
		statusService = { status: jest.fn(async () => ({ running: false, lastLog })) };
		selectorElectron = { update: jest.fn() };
		service = new SelectionPrefillService(
			store as unknown as Store,
			statusService as unknown as TimeTrackerStatusService,
			formService as unknown as TimeTrackerFormService,
			selectorElectron as unknown as SelectorElectronService
		);
	});

	const prefill = () => service.prefill(() => running);

	it('prefills an empty selection and stores what the selectors accepted', async () => {
		await expect(prefill()).resolves.toEqual({ projectId: 'project-1', taskId: 'task-1', note: 'Notes' });

		expect(formService.setState).toHaveBeenCalledWith({ projectId: 'project-1', taskId: 'task-1', note: 'Notes' });
		expect(selectorElectron.update).toHaveBeenCalledWith({ projectId: 'project-1', note: 'Notes' });
	});

	it('runs once per user and organization: a selection cleared afterwards stays cleared', async () => {
		await prefill();
		form = { clientId: '', projectId: '', teamId: '', taskId: '', note: '' };

		await expect(prefill()).resolves.toBeNull();
		expect(statusService.status).toHaveBeenCalledTimes(1);
	});

	it('runs again in another organization, or after reset()', async () => {
		await prefill();
		form = { clientId: '', projectId: '', teamId: '', taskId: '', note: '' };
		store.organizationId = 'org-2';
		statusService.status.mockResolvedValueOnce({
			running: false,
			lastLog: { ...lastLog, organizationId: 'org-2' }
		});

		await expect(prefill()).resolves.not.toBeNull();

		// Switching back clears the selection, and the switch calls reset().
		form = { clientId: '', projectId: '', teamId: '', taskId: '', note: '' };
		store.organizationId = 'org-1';
		service.reset();
		await expect(prefill()).resolves.not.toBeNull();
	});

	it('leaves a selection of its own alone, without asking the server', async () => {
		form.taskId = 'mine';

		await expect(prefill()).resolves.toBeNull();
		expect(statusService.status).not.toHaveBeenCalled();
		expect(formService.setState).not.toHaveBeenCalled();
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

	it('keeps the selection empty when the server cannot answer', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		statusService.status.mockRejectedValueOnce(new Error('offline'));

		await expect(prefill()).resolves.toBeNull();
		expect(formService.setState).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
