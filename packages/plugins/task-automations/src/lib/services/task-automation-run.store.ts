import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, LessThan, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import {
	ID,
	ITaskAutomationRun,
	TASK_AUTOMATION_LIMITS,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { TaskAutomationRun } from '../entities/task-automation-run.entity';
import { TASK_AUTOMATION_RUN_DEDUPE_MS, TASK_AUTOMATION_RUN_LEASE_MS } from '../task-automation.constants';
import { runFromRow } from './task-automation-rule.mapper';
import { TaskAutomationRetryLaterError } from './task-automation-task-lock';

/** What a claim needs: the rule, the task, the delivery identity, the trigger and the depth. */
export interface ITaskAutomationRunClaim {
	tenantId: ID;
	organizationId: ID;
	ruleId: ID;
	taskId: ID;
	eventKey: string;
	triggerType: TaskAutomationTriggerEnum;
	depth: number;
}

/** The outcomes a person's eye counts as "the rule changed the task" (the rate limit counts these). */
const CHANGED = [TaskAutomationRunOutcomeEnum.APPLIED, TaskAutomationRunOutcomeEnum.PARTIAL];

/**
 * The run history (spec FR-10, FR-14) and the once-per-change claim. A run row is inserted `RUNNING` before a rule
 * does anything, under the unique `(ruleId, eventKey)`: a second delivery of the same change finds it finished and
 * does nothing. A row still `RUNNING` (a process that stopped mid-run, or an outcome that could not be recorded) is
 * not "done": a delivery that finds it is put back for later (`TaskAutomationRetryLaterError`), and the first one
 * after its lease ran out takes it over (the actions are idempotent: a status already set is no change, a notice is
 * upserted by its identity).
 */
@Injectable()
export class TaskAutomationRunStore {
	private readonly logger = new Logger(TaskAutomationRunStore.name);

	constructor(private readonly dataSource: DataSource) {}

	private get runs() {
		return this.dataSource.getRepository(TaskAutomationRun);
	}

	/**
	 * Claims a run, or answers `null` when this rule already ran for this change. Throws
	 * `TaskAutomationRetryLaterError` while the change's run is still marked running inside its lease.
	 */
	async claim(claim: ITaskAutomationRunClaim, now = new Date()): Promise<TaskAutomationRun | null> {
		const existing = await this.runs.findOne({ where: { ruleId: claim.ruleId, eventKey: claim.eventKey } as never });
		if (existing) return this.takeOver(existing, now);
		try {
			return await this.runs.save(
				this.runs.create({
					tenantId: claim.tenantId,
					organizationId: claim.organizationId,
					ruleId: claim.ruleId,
					taskId: claim.taskId,
					eventKey: claim.eventKey.slice(0, 160),
					triggerType: claim.triggerType,
					outcome: TaskAutomationRunOutcomeEnum.RUNNING,
					depth: claim.depth
				} as Partial<TaskAutomationRun>)
			);
		} catch (error) {
			// Another delivery inserted it between the read and here: the unique key decided, and it is theirs (done, or
			// still running and so to be tried again later).
			const raced = await this.runs.findOne({ where: { ruleId: claim.ruleId, eventKey: claim.eventKey } as never });
			if (raced) return this.takeOver(raced, now);
			throw error;
		}
	}

	/**
	 * An existing row: finished means "done" (`null`); `RUNNING` past its lease is this delivery's to finish; `RUNNING`
	 * inside it is put back for later, so the delivery is not acknowledged before the run's outcome is recorded.
	 */
	private async takeOver(existing: TaskAutomationRun, now: Date): Promise<TaskAutomationRun | null> {
		if (existing.outcome !== TaskAutomationRunOutcomeEnum.RUNNING) return null;
		const startedAt = new Date(existing.updatedAt ?? existing.createdAt ?? now).getTime();
		if (now.getTime() - startedAt < TASK_AUTOMATION_RUN_LEASE_MS) {
			throw new TaskAutomationRetryLaterError(`The automation run ${existing.id} is still marked running.`);
		}
		// Only one delivery takes it over: the row must still be running and still stale when the update lands.
		const result = await this.runs.update(
			{
				id: existing.id,
				outcome: TaskAutomationRunOutcomeEnum.RUNNING,
				updatedAt: LessThanOrEqual(new Date(now.getTime() - TASK_AUTOMATION_RUN_LEASE_MS))
			} as never,
			{ updatedAt: now } as never
		);
		if (!result.affected) {
			// Another delivery took it over first; it records the outcome, or leaves it running for a later try.
			throw new TaskAutomationRetryLaterError(`The automation run ${existing.id} was taken over by another delivery.`);
		}
		this.logger.warn(`Took over the automation run ${existing.id}, left running since ${new Date(startedAt).toISOString()}.`);
		return { ...existing, updatedAt: now } as TaskAutomationRun;
	}

	/** Records how a run ended, and keeps the rule's history within its bound. */
	async finish(
		run: Pick<TaskAutomationRun, 'id' | 'ruleId'>,
		outcome: TaskAutomationRunOutcomeEnum,
		result: { details?: unknown; error?: string | null; durationMs?: number | null } = {},
		now = new Date()
	): Promise<void> {
		await this.runs.update({ id: run.id } as never, {
			outcome,
			details: result.details === undefined ? null : JSON.stringify(result.details),
			error: result.error ? String(result.error).slice(0, 4000) : null,
			durationMs: result.durationMs ?? null
		} as never);
		await this.prune(run.ruleId, TASK_AUTOMATION_LIMITS.runsKept, now).catch((error: unknown) =>
			this.logger.warn(`The history of rule ${run.ruleId} could not be pruned: ${(error as Error)?.message}`)
		);
	}

	/** Which of these delivery identities a rule has finished runs for (a `RUNNING` one is left to be taken over). */
	async finishedKeys(ruleId: ID, eventKeys: string[]): Promise<Set<string>> {
		const keys = [...new Set(eventKeys)];
		const found = new Set<string>();
		for (let index = 0; index < keys.length; index += 100) {
			const rows = await this.runs.find({
				where: { ruleId, eventKey: In(keys.slice(index, index + 100)) } as never,
				select: { id: true, eventKey: true, outcome: true } as never
			});
			for (const row of rows) {
				if (row.outcome !== TaskAutomationRunOutcomeEnum.RUNNING) found.add(row.eventKey);
			}
		}
		return found;
	}

	/** How many times automations changed a task since a moment (spec FR-13). */
	async changesSince(taskId: ID, since: Date): Promise<number> {
		return this.runs.count({ where: { taskId, outcome: In(CHANGED), createdAt: MoreThan(since) } as never });
	}

	/** A rule's runs, newest first (at most the shown limit). */
	async history(ruleId: ID, limit: number = TASK_AUTOMATION_LIMITS.runsShown): Promise<ITaskAutomationRun[]> {
		const take = Math.max(1, Math.min(Number(limit) || TASK_AUTOMATION_LIMITS.runsShown, TASK_AUTOMATION_LIMITS.runsShown));
		const rows = await this.runs.find({ where: { ruleId } as never, order: { createdAt: 'DESC', id: 'DESC' } as never, take });
		return rows.map(runFromRow);
	}

	/**
	 * Deletes a rule's runs beyond the newest it keeps (by id: runs written in the same instant are not lumped together),
	 * but never one younger than the dedupe horizon (`TASK_AUTOMATION_RUN_DEDUPE_MS`): its key is what stops the same
	 * change or due date from running the rule again. A busy rule may so hold more than the bound for a day.
	 */
	async prune(ruleId: ID, keep: number = TASK_AUTOMATION_LIMITS.runsKept, now = new Date()): Promise<number> {
		const newest = await this.runs.find({
			where: { ruleId } as never,
			order: { createdAt: 'DESC', id: 'DESC' } as never,
			take: Math.max(0, keep),
			select: { id: true } as never
		});
		const horizon = new Date(now.getTime() - TASK_AUTOMATION_RUN_DEDUPE_MS);
		const beyond = await this.runs.find({
			where: {
				ruleId,
				createdAt: LessThan(horizon),
				// A claim still running is never history to prune.
				outcome: Not(TaskAutomationRunOutcomeEnum.RUNNING),
				...(newest.length ? { id: Not(In(newest.map((row) => row.id))) } : {})
			} as never,
			order: { createdAt: 'ASC', id: 'ASC' } as never,
			take: 500,
			select: { id: true } as never
		});
		if (!beyond.length) return 0;
		const result = await this.runs.delete({ id: In(beyond.map((row) => row.id)) } as never);
		return result.affected ?? beyond.length;
	}
}
