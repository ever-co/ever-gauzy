import { ILastLogSelectionContext, selectionFromLastLog, toProjectConfig } from './last-log-selection';

/**
 * A timer signed in on a second device started with an empty selection: only a timer RUNNING elsewhere had its
 * client, project, team, task and note copied (#7753). The last time log now prefills an empty selection.
 */
describe('selectionFromLastLog', () => {
	const lastLog = {
		organizationId: 'org-1',
		organizationContactId: 'client-1',
		projectId: 'project-1',
		organizationTeamId: 'team-1',
		taskId: 'task-1',
		description: 'Release notes'
	};
	const empty = { clientId: '', projectId: '', teamId: '', taskId: '', note: '' };
	const context = (overrides: Partial<ILastLogSelectionContext> = {}): ILastLogSelectionContext => ({
		local: empty,
		isRunning: false,
		status: { running: false, lastLog },
		organizationId: 'org-1',
		...overrides
	});

	it('prefills an empty selection from the last log', () => {
		expect(selectionFromLastLog(context())).toEqual({
			clientId: 'client-1',
			projectId: 'project-1',
			teamId: 'team-1',
			taskId: 'task-1',
			note: 'Release notes'
		});
	});

	it('never overwrites a selection of its own', () => {
		expect(selectionFromLastLog(context({ local: { ...empty, projectId: 'mine' } }))).toBeNull();
		expect(selectionFromLastLog(context({ local: { ...empty, taskId: 'mine' } }))).toBeNull();
		expect(selectionFromLastLog(context({ local: { ...empty, teamId: 'mine' } }))).toBeNull();
		expect(selectionFromLastLog(context({ local: { ...empty, clientId: 'mine' } }))).toBeNull();
	});

	it('keeps a note typed here, and still prefills the selectors', () => {
		expect(selectionFromLastLog(context({ local: { ...empty, note: 'typed here' } }))).toEqual({
			clientId: 'client-1',
			projectId: 'project-1',
			teamId: 'team-1',
			taskId: 'task-1'
		});
	});

	it('leaves a running timer to the remote timer sync', () => {
		expect(selectionFromLastLog(context({ isRunning: true }))).toBeNull();
		expect(selectionFromLastLog(context({ status: { running: true, lastLog } }))).toBeNull();
	});

	it('does nothing without a last log', () => {
		expect(selectionFromLastLog(context({ status: { running: false, lastLog: null } }))).toBeNull();
		expect(selectionFromLastLog(context({ status: undefined }))).toBeNull();
	});

	it('ignores a log of another organization', () => {
		expect(selectionFromLastLog(context({ organizationId: 'org-2' }))).toBeNull();
	});

	it('takes only what the log carries', () => {
		expect(
			selectionFromLastLog(context({ status: { lastLog: { organizationId: 'org-1', projectId: 'project-1' } } }))
		).toEqual({ projectId: 'project-1' });
		expect(selectionFromLastLog(context({ status: { lastLog: { organizationId: 'org-1' } } }))).toBeNull();
	});
});

describe('toProjectConfig', () => {
	it('maps the form fields to the stored project settings, leaving out empty ones', () => {
		expect(toProjectConfig({ clientId: 'c', projectId: 'p', teamId: '', taskId: 't', note: 'n' })).toEqual({
			organizationContactId: 'c',
			projectId: 'p',
			taskId: 't',
			note: 'n'
		});
	});
});
