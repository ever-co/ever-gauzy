import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, LessThanOrEqual, MoreThan } from 'typeorm';
import {
	ID,
	ITaskAutomationRun,
	TASK_AUTOMATION_LIMITS,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { TaskAutomationRun } from '../entities/task-automation-run.entity';
import { TASK_AUTOMATION_RUN_LEASE_MS } from '../task-automation.constants';
import { runFromRow } from './task-automation-rule.mapper';

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
 * does anything, under the unique `(ruleId, eventKey)`: a second delivery of the same change finds it and does
 * nothing, and a row left `RUNNING` by a process that stopped mid-run is taken over once its lease ran out (the
 * actions are idempotent: a status already set is no change, a notice is upserted by its identity).
 */
@Injectable()
export class TaskAutomationRunStore {
	private readonly logger = new Logger(TaskAutomationRunStore.name);

	constructor(private readonly dataSource: DataSource) {}

	private get runs() {
		return this.dataSource.getRepository(TaskAutomationRun);
	}

	/** Claims a run, or answers `null` when this rule already ran (or is running) for this change. */
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
			// Another delivery inserted it between the read and here: the unique key decided, and it is theirs.
			const raced = await this.runs.findOne({ where: { ruleId: claim.ruleId, eventKey: claim.eventKey } as never });
			if (raced) return null;
			throw error;
		}
	}

	/** A `RUNNING` row older than the lease is this delivery's to finish; any other existing row means "done". */
	private async takeOver(existing: TaskAutomationRun, now: Date): Promise<TaskAutomationRun | null> {
		if (existing.outcome !== TaskAutomationRunOutcomeEnum.RUNNING) return null;
		const startedAt = new Date(existing.updatedAt ?? existing.createdAt ?? now).getTime();
		if (now.getTime() - startedAt < TASK_AUTOMATION_RUN_LEASE_MS) return null;
		// Only one delivery takes it over: the row must still be running and still stale when the update lands.
		const result = await this.runs.update(
			{
				id: existing.id,
				outcome: TaskAutomationRunOutcomeEnum.RUNNING,
				updatedAt: LessThanOrEqual(new Date(now.getTime() - TASK_AUTOMATION_RUN_LEASE_MS))
			} as never,
			{ updatedAt: now } as never
		);
		if (!result.affected) return null;
		this.logger.warn(`Took over the automation run ${existing.id}, left running since ${new Date(startedAt).toISOString()}.`);
		return { ...existing, updatedAt: now } as TaskAutomationRun;
	}

	/** Records how a run ended, and keeps the rule's history within its bound. */
	async finish(
		run: Pick<TaskAutomationRun, 'id' | 'ruleId'>,
		outcome: TaskAutomationRunOutcomeEnum,
		result: { details?: unknown; error?: string | null; durationMs?: number | null } = {}
	): Promise<void> {
		await this.runs.update({ id: run.id } as never, {
			outcome,
			details: result.details === undefined ? null : JSON.stringify(result.details),
			error: result.error ? String(result.error).slice(0, 4000) : null,
			durationMs: result.durationMs ?? null
		} as never);
		await this.prune(run.ruleId).catch((error: unknown) =>
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
		const rows = await this.runs.find({ where: { ruleId } as never, order: { createdAt: 'DESC' } as never, take });
		return rows.map(runFromRow);
	}

	/** Deletes a rule's runs beyond the newest it keeps. */
	async prune(ruleId: ID, keep: number = TASK_AUTOMATION_LIMITS.runsKept): Promise<number> {
		const [boundary] = await this.runs.find({
			where: { ruleId } as never,
			order: { createdAt: 'DESC' } as never,
			skip: keep,
			take: 1,
			select: { id: true, createdAt: true } as never
		});
		if (!boundary) return 0;
		const result = await this.runs.delete({ ruleId, createdAt: LessThanOrEqual(boundary.createdAt) } as never);
		return result.affected ?? 0;
	}
}
