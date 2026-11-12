/**
 * The due-date sweep's paging: due dates already reported do not hold back a task due later, a task busy with another
 * run is left to the next sweep, and one sweep runs a rule for at most a batch of tasks.
 */
// The services the sweep is given are doubled below; their modules (and the platform's barrel) are not loaded.
jest.mock('@gauzy/core', () => ({}));
jest.mock('../services/task-automation-rule.service', () => ({ TaskAutomationRuleService: class {} }));
jest.mock('../services/task-automation-runner.service', () => ({ TaskAutomationRunner: class {} }));
jest.mock('../services/task-automation-run.store', () => ({ TaskAutomationRunStore: class {} }));
jest.mock('../services/task-automation-task-reader.service', () => ({ TaskAutomationTaskReader: class {} }));

import { TaskAutomationRunOutcomeEnum, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { TaskAutomationRetryLaterError } from '../services/task-automation-task-lock';
import { TASK_AUTOMATION_DUE_BATCH } from '../task-automation.constants';
import { dueEventKey, TaskAutomationDueSweepService } from './task-automation-due-sweep.service';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const RULE = {
	id: 'rule-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	createdAt: new Date('2026-11-01T00:00:00.000Z'),
	trigger: { type: TaskAutomationTriggerEnum.DUE_DATE_PASSED }
};

/** `count` due tasks, one minute apart, named `task-<n>`. */
const dueTasks = (count: number, from = 0) =>
	Array.from({ length: count }, (_, index) => ({
		id: `task-${String(from + index).padStart(4, '0')}`,
		dueDate: new Date(NOW.getTime() - 60 * 60_000 + (from + index) * 1_000)
	}));

function sweepOver(all: Array<{ id: string; dueDate: Date }>, finished: Set<string>, run = jest.fn()) {
	const reader = {
		dueTasks: jest.fn(async (_scope: unknown, _window: unknown, limit: number, after: { id: string } | null) => {
			const start = after ? all.findIndex((task) => task.id === after.id) + 1 : 0;
			return all.slice(start, start + limit);
		})
	};
	const runs = {
		finishedKeys: jest.fn(async (_ruleId: string, keys: string[]) => new Set(keys.filter((key) => finished.has(key))))
	};
	const rules = { enabledRulesOfTrigger: jest.fn(async () => [RULE]) };
	const dataSource = { options: { type: 'better-sqlite3' } } as unknown as DataSource;
	const service = new TaskAutomationDueSweepService(dataSource, rules as never, reader as never, { run } as never, runs as never);
	return { service, reader, run };
}

describe('TaskAutomationDueSweepService', () => {
	it('pages past the due dates it already reported, so a task due later is reached', async () => {
		const all = dueTasks(TASK_AUTOMATION_DUE_BATCH + 1);
		const finished = new Set(all.slice(0, TASK_AUTOMATION_DUE_BATCH).map((task) => dueEventKey(task.id, task.dueDate)));
		const run = jest.fn(async () => ({ outcome: TaskAutomationRunOutcomeEnum.APPLIED }));
		const { service, reader } = sweepOver(all, finished, run);

		expect(await service.sweep(NOW)).toEqual({ rules: 1, runs: 1 });
		expect(reader.dueTasks).toHaveBeenCalledTimes(2);
		const last = all[TASK_AUTOMATION_DUE_BATCH];
		expect(run).toHaveBeenCalledWith(RULE, last.id, expect.objectContaining({ eventKey: dueEventKey(last.id, last.dueDate) }));
	});

	it('reads the whole window: thousands of reported tasks that stay open never hold back a later one', async () => {
		const all = dueTasks(6_001);
		const finished = new Set(all.slice(0, 6_000).map((task) => dueEventKey(task.id, task.dueDate)));
		const run = jest.fn(async () => ({ outcome: TaskAutomationRunOutcomeEnum.APPLIED }));
		const { service } = sweepOver(all, finished, run);

		expect(await service.sweep(NOW)).toEqual({ rules: 1, runs: 1 });
		expect(run).toHaveBeenCalledWith(RULE, all[6_000].id, expect.anything());
	});

	it('runs a rule for at most a batch of tasks a sweep', async () => {
		const all = dueTasks(TASK_AUTOMATION_DUE_BATCH + 5);
		const run = jest.fn(async () => ({ outcome: TaskAutomationRunOutcomeEnum.APPLIED }));
		const { service } = sweepOver(all, new Set(), run);

		expect(await service.sweep(NOW)).toEqual({ rules: 1, runs: TASK_AUTOMATION_DUE_BATCH });
		expect(run).toHaveBeenCalledTimes(TASK_AUTOMATION_DUE_BATCH);
	});

	it('leaves a task busy with another run to the next sweep, and goes on with the others', async () => {
		const all = dueTasks(3);
		const run = jest.fn(async (_rule: unknown, taskId: string) => {
			if (taskId === all[1].id) throw new TaskAutomationRetryLaterError('busy');
			return { outcome: TaskAutomationRunOutcomeEnum.APPLIED };
		});
		const { service } = sweepOver(all, new Set(), run);

		expect(await service.sweep(NOW)).toEqual({ rules: 1, runs: 2 });
		expect(run).toHaveBeenCalledTimes(3);
	});
});
