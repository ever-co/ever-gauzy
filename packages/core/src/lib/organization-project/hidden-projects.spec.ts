import { PROJECT_ID_OF_ROW, withHiddenProjectsWithheld, withProjectIdKept } from './hidden-projects';

/**
 * CORE-27 (ever-co/ever-gauzy#12031): where an organization keeps its private projects private, every record that
 * names a project the caller may not see answers its id and the `projectHidden` marker, and nothing else of it. The
 * time it holds stays where it is.
 */

const CONFIDENTIAL = 'project-client-x-redesign';
const PUBLIC = 'project-website';
const HIDDEN = new Map([[CONFIDENTIAL, 'Client X redesign']]);

const confidentialProject = {
	id: CONFIDENTIAL,
	name: 'Client X redesign',
	imageUrl: 'https://img/x.png',
	membersCount: 1,
	organizationContact: { id: 'client-x', name: 'Client X' }
};
const publicProject = { id: PUBLIC, name: 'Website', imageUrl: null, membersCount: 4 };

describe('withHiddenProjectsWithheld', () => {
	it('answers a hidden project of a time entry as its id and the marker, and keeps the entry whole', () => {
		const log = { id: 'log-1', duration: 43200, projectId: CONFIDENTIAL, project: confidentialProject };

		expect(withHiddenProjectsWithheld(log, HIDDEN)).toEqual({
			id: 'log-1',
			duration: 43200,
			projectId: CONFIDENTIAL,
			project: { id: CONFIDENTIAL, projectHidden: true }
		});
	});

	it('leaves a project the caller may see as it is', () => {
		const log = { id: 'log-2', projectId: PUBLIC, project: publicProject };

		expect(withHiddenProjectsWithheld(log, HIDDEN)).toBe(log);
	});

	it('hands back the very same answer when nothing is hidden', () => {
		const answer = [{ id: 'log-1', project: confidentialProject }];

		expect(withHiddenProjectsWithheld(answer, new Map())).toBe(answer);
	});

	it('changes none of the records the services returned', () => {
		const log = { id: 'log-1', projectId: CONFIDENTIAL, project: confidentialProject };

		withHiddenProjectsWithheld({ items: [log] }, HIDDEN);

		expect(log.project).toBe(confidentialProject);
		expect(confidentialProject.name).toBe('Client X redesign');
	});

	it('keeps the class of the records it copies, so their serialization reads them as before', () => {
		class TimeLog {
			id = 'log-1';
			projectId = CONFIDENTIAL;
			project: unknown = confidentialProject;
			get isRunning(): boolean {
				return false;
			}
		}
		const withheld = withHiddenProjectsWithheld(new TimeLog(), HIDDEN);

		expect(withheld).toBeInstanceOf(TimeLog);
		expect(withheld.isRunning).toBe(false);
		expect(withheld.project).toEqual({ id: CONFIDENTIAL, projectHidden: true });
	});

	it('reaches the projects of a grouped report, of tasks and of nested time entries', () => {
		const report = [
			{
				date: '2026-11-09',
				logs: [
					{ project: confidentialProject, employeeLogs: [{ sum: 43200, employee: { id: 'marie' } }] },
					{ project: publicProject, employeeLogs: [{ sum: 3600 }] }
				]
			}
		];
		const slot = { id: 'slot-1', timeLogs: [{ projectId: CONFIDENTIAL, project: confidentialProject }] };
		const plan = { id: 'plan-1', tasks: [{ id: 'task-1', projectId: CONFIDENTIAL, project: confidentialProject }] };

		const [day] = withHiddenProjectsWithheld(report, HIDDEN);
		expect(day.logs[0]).toEqual({
			project: { id: CONFIDENTIAL, projectHidden: true },
			employeeLogs: [{ sum: 43200, employee: { id: 'marie' } }]
		});
		expect(day.logs[1]).toBe(report[0].logs[1]);
		expect(withHiddenProjectsWithheld(slot, HIDDEN).timeLogs[0].project).toEqual({
			id: CONFIDENTIAL,
			projectHidden: true
		});
		expect(withHiddenProjectsWithheld(plan, HIDDEN).tasks[0].project).toEqual({
			id: CONFIDENTIAL,
			projectHidden: true
		});
	});

	it('knows a project read without its id by the row project id, or by the id a read kept beside it', () => {
		const withRowColumn = { id: 'log-1', projectId: CONFIDENTIAL, project: { name: 'Client X redesign' } };
		const keptBeside = { id: 'log-2', project: { name: 'Client X redesign', imageUrl: null } };
		Object.defineProperty(keptBeside.project, PROJECT_ID_OF_ROW, { value: CONFIDENTIAL });

		expect(withHiddenProjectsWithheld(withRowColumn, HIDDEN).project).toEqual({
			id: CONFIDENTIAL,
			projectHidden: true
		});
		expect(withHiddenProjectsWithheld(keptBeside, HIDDEN).project).toEqual({
			id: CONFIDENTIAL,
			projectHidden: true
		});
	});

	it('keeps the id of a project answered as a few fields out of the answer, for the walk alone', () => {
		const row = {
			id: 'log-3',
			project: withProjectIdKept({ name: 'Client X redesign', imageUrl: null }, CONFIDENTIAL)
		};

		expect(JSON.stringify(row)).toBe(
			JSON.stringify({ id: 'log-3', project: { name: 'Client X redesign', imageUrl: null } })
		);
		expect(withHiddenProjectsWithheld(row, HIDDEN).project).toEqual({ id: CONFIDENTIAL, projectHidden: true });
		expect(withProjectIdKept({ name: 'Website' }, null)).toEqual({ name: 'Website' });
	});

	it('withholds the fields of a row that tell about its hidden project, and keeps the time', () => {
		const budgetRow = {
			project: confidentialProject,
			budgetType: 'hours',
			budget: 100,
			spent: 12,
			remainingBudget: 88,
			spentPercentage: 12
		};
		const options = { withheldWithProject: ['budgetType', 'budget', 'remainingBudget', 'spentPercentage'] };

		expect(withHiddenProjectsWithheld([budgetRow], HIDDEN, options)).toEqual([
			{ project: { id: CONFIDENTIAL, projectHidden: true }, spent: 12 }
		]);
	});

	it('keeps the figures of a hidden project row of a statistic, and nothing else of it', () => {
		const statistics = [
			{ id: CONFIDENTIAL, name: 'Client X redesign', duration: 43200, durationPercentage: 92 },
			{ id: PUBLIC, name: 'Website', duration: 3600, durationPercentage: 8 }
		];
		const options = { rootRowsAreProjects: { keep: ['duration', 'durationPercentage'] } };

		expect(withHiddenProjectsWithheld(statistics, HIDDEN, options)).toEqual([
			{ id: CONFIDENTIAL, projectHidden: true, duration: 43200, durationPercentage: 92 },
			{ id: PUBLIC, name: 'Website', duration: 3600, durationPercentage: 8 }
		]);
	});

	it('withholds a hidden project from a time entry history row: its references and its description', () => {
		const row = {
			entity: 'TimeLog',
			description: 'Updated TimeLog "Client X redesign"',
			previousValues: [{ projectId: PUBLIC }],
			updatedValues: [{ projectId: CONFIDENTIAL }],
			previousEntities: [{ projectId: { id: PUBLIC, name: 'Website' } }],
			updatedEntities: [{ projectId: { id: CONFIDENTIAL, name: 'Client X redesign' } }]
		};

		expect(withHiddenProjectsWithheld(row, HIDDEN)).toEqual({
			entity: 'TimeLog',
			description: 'Updated TimeLog "time entry"',
			previousValues: [{ projectId: PUBLIC }],
			updatedValues: [{ projectId: CONFIDENTIAL }],
			previousEntities: [{ projectId: { id: PUBLIC, name: 'Website' } }],
			updatedEntities: [{ projectId: { id: CONFIDENTIAL, projectHidden: true } }]
		});
	});

	it('withholds the label of a history row whose entry is on a hidden project, whatever name the project had', () => {
		const row = withProjectIdKept(
			{ id: 'history-1', entity: 'TimeLog', description: 'Created TimeLog "Client X (old name)"' },
			CONFIDENTIAL
		);

		expect(withHiddenProjectsWithheld(row, HIDDEN).description).toBe('Created TimeLog "time entry"');
	});

	it('withholds the label of a history row whose change names a hidden project, for an entry deleted for good', () => {
		const row = {
			id: 'history-2',
			entity: 'TimeLog',
			description: 'Deleted TimeLog "Client X (old name)"',
			previousValues: [{ projectId: CONFIDENTIAL }]
		};

		expect(withHiddenProjectsWithheld(row, HIDDEN).description).toBe('Deleted TimeLog "time entry"');
	});

	it('leaves the label of a history row whose entry is on a project the caller sees', () => {
		const row = withProjectIdKept(
			{ id: 'history-3', entity: 'TimeLog', description: 'Updated TimeLog "Homepage copy"' },
			PUBLIC
		);

		expect(withHiddenProjectsWithheld(row, HIDDEN)).toBe(row);
	});

	it('leaves the description of a row about another record as it is', () => {
		const row = { entity: 'Task', description: 'Updated Task "Client X redesign"' };

		expect(withHiddenProjectsWithheld(row, HIDDEN)).toBe(row);
	});

	it('walks a page and leaves dates and records that refer to each other alone', () => {
		const startedAt = new Date('2026-11-09T08:00:00Z');
		const log: Record<string, unknown> = { id: 'log-1', startedAt, projectId: CONFIDENTIAL };
		log['project'] = { ...confidentialProject, timeLogs: [log] };
		const page = { items: [log], total: 1 };

		const withheld = withHiddenProjectsWithheld(page, HIDDEN);

		expect(withheld.total).toBe(1);
		expect(withheld.items[0]['startedAt']).toBe(startedAt);
		expect(withheld.items[0]['project']).toEqual({ id: CONFIDENTIAL, projectHidden: true });
	});
});
