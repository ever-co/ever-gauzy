import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ID, ITaskAutomationRule, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import { TaskAutomationRuleService } from '../services/task-automation-rule.service';
import { TaskAutomationRunner } from '../services/task-automation-runner.service';
import { TaskAutomationRunStore } from '../services/task-automation-run.store';
import { TaskAutomationRetryLaterError } from '../services/task-automation-task-lock';
import { TaskAutomationTaskReader } from '../services/task-automation-task-reader.service';
import {
	TASK_AUTOMATION_DUE_BATCH,
	TASK_AUTOMATION_DUE_LOOKBACK_MS,
	TASK_AUTOMATION_DUE_SWEEP_LOCK
} from '../task-automation.constants';
import { TaskAutomationSweepLock } from './task-automation-sweep-lock';

/** The delivery identity of a due date: once per rule, task and due date (spec FR-10). */
export const dueEventKey = (taskId: ID, dueDate: Date): string => `due:${taskId}:${dueDate.toISOString()}`;

/** The window a rule's sweep looks at: due dates that passed since the rule exists, at most the lookback ago. */
export function dueWindow(rule: Pick<ITaskAutomationRule, 'createdAt'>, now: Date): { after: Date; until: Date } {
	const lookback = now.getTime() - TASK_AUTOMATION_DUE_LOOKBACK_MS;
	const created = rule.createdAt ? new Date(rule.createdAt).getTime() : lookback;
	return { after: new Date(Math.max(lookback, Number.isNaN(created) ? lookback : created)), until: now };
}

/**
 * The due-date trigger (spec FR-9, FR-10): for every rule that is on with `DUE_DATE_PASSED`, the open tasks of its
 * scope whose due date passed since the last day (and since the rule exists — a new rule does not report the
 * backlog), oldest first; each runs the rule once per due date (the run's key), however often the sweep comes by.
 * One sweep at a time across the processes. The sweep pages through the whole window (a day at most), so tasks that
 * stay open after their notice never hold back one due later: the read already leaves out the tasks the rule reported
 * and has not seen change since, and each page's keys are checked exactly. It runs a rule for at most
 * `TASK_AUTOMATION_DUE_BATCH` tasks a sweep; the rest wait for the next sweep, which starts from the oldest again.
 */
@Injectable()
export class TaskAutomationDueSweepService {
	private readonly logger = new Logger(TaskAutomationDueSweepService.name);
	private readonly lock: TaskAutomationSweepLock;

	constructor(
		dataSource: DataSource,
		private readonly rules: TaskAutomationRuleService,
		private readonly reader: TaskAutomationTaskReader,
		private readonly runner: TaskAutomationRunner,
		private readonly runs: TaskAutomationRunStore
	) {
		this.lock = new TaskAutomationSweepLock(dataSource);
	}

	/** One sweep; `null` when another sweep holds the lock. */
	async sweep(now = new Date()): Promise<{ rules: number; runs: number } | null> {
		return this.lock.tryRun(TASK_AUTOMATION_DUE_SWEEP_LOCK, async () => {
			const rules = await this.rules.enabledRulesOfTrigger(TaskAutomationTriggerEnum.DUE_DATE_PASSED);
			let runs = 0;
			for (const rule of rules) {
				try {
					runs += await this.sweepRule(rule, now);
				} catch (error) {
					// One rule's failure (a database blip) leaves the others to run; it is tried again next sweep.
					this.logger.warn(`The due-date sweep of rule ${rule.id} failed: ${(error as Error)?.message}`);
				}
			}
			if (runs) this.logger.log(`The due-date sweep ran ${runs} automation(s) for ${rules.length} rule(s).`);
			return { rules: rules.length, runs };
		});
	}

	private async sweepRule(rule: ITaskAutomationRule, now: Date): Promise<number> {
		const window = dueWindow(rule, now);
		const scope = {
			tenantId: rule.tenantId as ID,
			organizationId: rule.organizationId as ID,
			projectId: rule.projectId ?? null,
			organizationTeamId: rule.organizationTeamId ?? null,
			ruleId: rule.id as ID
		};
		let runs = 0;
		let cursor: { id: ID; dueDate: Date } | null = null;
		while (runs < TASK_AUTOMATION_DUE_BATCH) {
			const page = await this.reader.dueTasks(scope, window, TASK_AUTOMATION_DUE_BATCH, cursor);
			if (!page.length) break;
			cursor = page[page.length - 1];
			// The due dates this rule already reported are left out before anything is read of them.
			const done = await this.runs.finishedKeys(
				rule.id as ID,
				page.map((task) => dueEventKey(task.id, task.dueDate))
			);
			for (const task of page) {
				if (runs >= TASK_AUTOMATION_DUE_BATCH) break;
				if (done.has(dueEventKey(task.id, task.dueDate))) continue;
				try {
					const result = await this.runner.run(rule, task.id, {
						eventKey: dueEventKey(task.id, task.dueDate),
						triggerType: TaskAutomationTriggerEnum.DUE_DATE_PASSED,
						depth: 0,
						chain: [],
						requiresOpenAndDue: task.dueDate.toISOString(),
						now
					});
					if (result.outcome) runs += 1;
				} catch (error) {
					// The task is busy with another run, or this due date's run is still marked running: the next sweep
					// comes back to it (its key is not finished).
					if (error instanceof TaskAutomationRetryLaterError) continue;
					throw error;
				}
			}
			if (page.length < TASK_AUTOMATION_DUE_BATCH) break;
		}
		return runs;
	}
}
