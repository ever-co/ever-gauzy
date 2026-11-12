import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { In, Not } from 'typeorm';
import { ID, IIntegrationTenant, ITaskUpdateInput } from '@gauzy/contracts';
import {
	mergeSyncedFields,
	parseSyncedValues,
	sameSyncedValue,
	SYNCED_TASK_FIELDS,
	SyncedFieldsMerge,
	SyncedTaskField,
	syncedValuesOf,
	SyncedTaskValues,
	Task,
	TaskUpdateCommand,
	taskPatchOf
} from '@gauzy/core';
import { TypeOrmJiraIssueBaselineRepository, JiraIssueBaseline } from './entities/jira-issue-baseline.entity';
import { canonicalHtml } from './sync/jira-adf';
import {
	JiraSyncConflict,
	JiraSyncConflictResolution,
	JiraSyncConflictStatus,
	TypeOrmJiraSyncConflictRepository
} from './entities/jira-sync-conflict.entity';
import { JIRA_CONFLICT_NOT_FOUND, JIRA_CONFLICT_STALE } from './jira.constants';

/** The task columns read to compare and restore the synced fields. */
const TASK_SELECT = { id: true, title: true, description: true, status: true, taskStatusId: true, priority: true, taskPriorityId: true, dueDate: true };

/** Where an issue's apply stands before its task is written: the merge, and the task as it was. */
export interface JiraApplyMerge extends SyncedFieldsMerge {
	/** The task's columns before the write (none for a new task): a conflict keeps them to restore. */
	task: Record<string, unknown> | null;
}

/** The conflicts of an issue's merge, recorded before its task is written. */
export interface JiraApplyRecord {
	tenantId: ID;
	organizationId: ID;
	integrationId: ID;
	mappingId: ID | null;
	runId: ID | null;
	sourceId: string;
	merge: JiraApplyMerge | null;
}

/** A conflict recorded for an issue's apply: its id and field. */
export interface JiraRecordedConflict {
	id: ID;
	field: SyncedTaskField;
}

/** One issue applied: what to settle once its task is written. */
export interface JiraApplySettlement {
	tenantId: ID;
	organizationId: ID;
	integrationId: ID;
	sourceId: string;
	taskId: ID;
	external: SyncedTaskValues;
	/** The conflicts {@link JiraSyncConflictService.record} recorded for this apply. */
	recorded: readonly JiraRecordedConflict[];
}

/** Filters of the conflict list. */
export interface JiraConflictQuery {
	status?: JiraSyncConflictStatus;
	mappingId?: ID;
	taskId?: ID;
	runId?: ID;
	take?: number;
}

/**
 * The conflicts between Jira and the platform, and the baseline they are found against.
 *
 * An inbound apply asks {@link prepare} before writing the task (which fields the task keeps, which changed on both
 * sides), records the conflicts with {@link record} while the task still holds its own values (a failure after the
 * write cannot lose them), takes them back with {@link discard} when the write fails, and calls {@link settle} after
 * it (the issue's values become the baseline; an older open conflict on the same field is superseded). A manager
 * lists them and resolves each: Jira's value stays, or the task's is written back — through the platform's task
 * update, so a mapping that sends changes out sends it to the issue.
 */
@Injectable()
export class JiraSyncConflictService {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly conflicts: TypeOrmJiraSyncConflictRepository,
		private readonly baselines: TypeOrmJiraIssueBaselineRepository
	) {}

	// ---------------------------------------------------------------- inbound apply

	/** The merge of an issue mapped to a task: the baseline, the task now, the issue now. Nothing for a new task. */
	async prepare(input: { tenantId: ID; organizationId: ID; integrationId: ID; sourceId: string; taskId: ID | null; external: SyncedTaskValues }): Promise<JiraApplyMerge | null> {
		if (!input.taskId) return null;
		const [baseline, task] = await Promise.all([
			this.baselines.findOne({ where: { integrationId: input.integrationId, sourceId: input.sourceId, tenantId: input.tenantId } }),
			this.conflicts.manager.findOne(Task, {
				where: { id: input.taskId, tenantId: input.tenantId, organizationId: input.organizationId } as never,
				select: TASK_SELECT as never
			}) as unknown as Promise<Record<string, unknown> | null>
		]);
		// A baseline of another task (the issue's task was re-created) says nothing about this one.
		const synced = baseline && String(baseline.taskId) === String(input.taskId) ? parseSyncedValues(baseline.syncedFields) : null;
		const platform = task ? platformValuesOf(task) : null;
		return { ...mergeSyncedFields(synced, platform, input.external), task };
	}

	/**
	 * Whether a task's description is still what its issue last sent (unchanged on the platform since the last apply).
	 * An outbound push then leaves Jira's description alone: Jira's rich text can hold what the task store cannot (media,
	 * for one), and sending the task's reading of it back would drop that on an edit of another field.
	 */
	async descriptionUnchangedSinceSync(input: { tenantId: ID; integrationId: ID; sourceId: string; task: Record<string, unknown> }): Promise<boolean> {
		const baseline = await this.baselines.findOne({ where: { integrationId: input.integrationId, sourceId: input.sourceId, tenantId: input.tenantId } });
		if (!baseline || String(baseline.taskId) !== String(input.task['id'])) return false;
		const synced = parseSyncedValues(baseline.syncedFields);
		if (!synced) return false;
		return sameSyncedValue('description', platformValuesOf(input.task).description ?? null, synced.description ?? null);
	}

	/**
	 * Before the task is written: each conflict of the merge is recorded with the task's value and its own columns
	 * (read before the write), so nothing the task held is lost if anything after the write fails. Answers what was
	 * recorded.
	 */
	async record(input: JiraApplyRecord): Promise<JiraRecordedConflict[]> {
		const found = input.merge?.conflicts ?? [];
		const task = input.merge?.task;
		if (!found.length || !task?.['id']) return [];
		const saved = await this.conflicts.save(
			found.map((conflict) =>
				Object.assign(new JiraSyncConflict(), {
					tenantId: input.tenantId,
					organizationId: input.organizationId,
					integrationId: input.integrationId,
					mappingId: input.mappingId,
					runId: input.runId,
					taskId: task['id'] as ID,
					sourceId: input.sourceId,
					field: conflict.field,
					syncedValue: conflict.synced,
					platformValue: conflict.platform,
					externalValue: conflict.external,
					platformPatch: JSON.stringify(taskPatchOf(task, conflict.field)),
					status: JiraSyncConflictStatus.OPEN
				})
			)
		);
		return saved.map((row) => ({ id: row.id as ID, field: row.field as SyncedTaskField }));
	}

	/** The task could not be written: the conflicts recorded for the apply are taken back (it keeps its values). */
	async discard(recorded: readonly JiraRecordedConflict[]): Promise<void> {
		if (!recorded.length) return;
		await this.conflicts.delete({ id: In(recorded.map((conflict) => conflict.id)) } as never);
	}

	/**
	 * After the task was written: the issue's values become the baseline, and an older open conflict on a field just
	 * recorded is superseded (the task's value it kept was replaced since). A failure here leaves the conflicts
	 * recorded; the next apply of the issue writes the baseline again.
	 */
	async settle(input: JiraApplySettlement): Promise<void> {
		const syncedFields = JSON.stringify(input.external);
		const existing = await this.baselines.findOne({ where: { integrationId: input.integrationId, sourceId: input.sourceId, tenantId: input.tenantId } });
		if (existing) {
			await this.baselines.update({ id: existing.id }, { taskId: input.taskId, syncedFields, updatedAt: new Date() } as never);
		} else {
			await this.baselines.save(
				Object.assign(new JiraIssueBaseline(), {
					tenantId: input.tenantId,
					organizationId: input.organizationId,
					integrationId: input.integrationId,
					sourceId: input.sourceId,
					taskId: input.taskId,
					syncedFields
				})
			);
		}
		if (!input.recorded.length) return;
		await this.conflicts.update(
			{
				integrationId: input.integrationId,
				taskId: input.taskId,
				field: In(input.recorded.map((conflict) => conflict.field)),
				id: Not(In(input.recorded.map((conflict) => conflict.id))),
				status: JiraSyncConflictStatus.OPEN,
				tenantId: input.tenantId
			} as never,
			{ status: JiraSyncConflictStatus.RESOLVED, resolution: JiraSyncConflictResolution.SUPERSEDED, resolvedAt: new Date(), updatedAt: new Date() } as never
		);
	}

	// ---------------------------------------------------------------- routes

	/** The conflicts of a connection, newest first (open ones by default). */
	async list(tenant: IIntegrationTenant, query: JiraConflictQuery = {}): Promise<JiraSyncConflict[]> {
		return this.conflicts.find({
			where: {
				integrationId: tenant.id as ID,
				tenantId: tenant.tenantId as ID,
				status: query.status ?? JiraSyncConflictStatus.OPEN,
				...(query.mappingId ? { mappingId: query.mappingId } : {}),
				...(query.taskId ? { taskId: query.taskId } : {}),
				...(query.runId ? { runId: query.runId } : {})
			},
			order: { createdAt: 'DESC' },
			take: Math.min(Math.max(query.take ?? 50, 1), 200)
		});
	}

	/** How many conflicts each run found. */
	async countByRun(tenant: IIntegrationTenant, runIds: readonly ID[]): Promise<Map<string, number>> {
		const counts = new Map<string, number>();
		if (!runIds.length) return counts;
		const rows: Array<{ runId: string; count: string | number }> = await this.conflicts
			.createQueryBuilder('conflict')
			.select('conflict.runId', 'runId')
			.addSelect('COUNT(*)', 'count')
			.where('conflict.integrationId = :integrationId', { integrationId: tenant.id })
			.andWhere('conflict.tenantId = :tenantId', { tenantId: tenant.tenantId })
			.andWhere('conflict.runId IN (:...runIds)', { runIds: [...runIds] })
			.groupBy('conflict.runId')
			.getRawMany();
		for (const row of rows) counts.set(String(row.runId), Number(row.count) || 0);
		return counts;
	}

	/**
	 * Resolves an open conflict. `external`: Jira's value, already the task's, stays. `platform`: the task's value is
	 * written back — refused (409) when the task's field holds something else than Jira's value by now (it changed
	 * since, and that change is not overwritten).
	 */
	async resolve(tenant: IIntegrationTenant, conflictId: ID, keep: 'external' | 'platform', userId: ID | null): Promise<JiraSyncConflict> {
		const conflict = await this.conflicts.findOne({ where: { id: conflictId, integrationId: tenant.id as ID, tenantId: tenant.tenantId as ID } });
		if (!conflict || conflict.status !== JiraSyncConflictStatus.OPEN) {
			throw new NotFoundException({ message: 'The conflict was not found, or is resolved already', code: JIRA_CONFLICT_NOT_FOUND });
		}
		const field = conflict.field as SyncedTaskField;
		let patch: Record<string, unknown> | null = null;
		if (keep === 'platform') {
			if (!(SYNCED_TASK_FIELDS as readonly string[]).includes(field)) {
				throw new ConflictException({ message: 'The conflict names a field that cannot be restored', code: JIRA_CONFLICT_STALE });
			}
			const task = (await this.conflicts.manager.findOne(Task, {
				where: { id: conflict.taskId, tenantId: conflict.tenantId, organizationId: conflict.organizationId } as never,
				select: TASK_SELECT as never
			})) as unknown as Record<string, unknown> | null;
			const current = task ? platformValuesOf(task)[field] : null;
			if (!task || !sameSyncedValue(field, current, conflict.externalValue ?? null)) {
				throw new ConflictException({ message: 'The task changed since the conflict was found; its value is not overwritten', code: JIRA_CONFLICT_STALE });
			}
			patch = restorePatchOf(conflict.platformPatch, field, conflict.platformValue ?? null);
		}
		const resolution = keep === 'platform' ? JiraSyncConflictResolution.KEPT_PLATFORM : JiraSyncConflictResolution.KEPT_EXTERNAL;
		const resolvedAt = new Date();
		// Claimed first: of two managers resolving it at once, one writes the task.
		const claimed = await this.conflicts.update(
			{ id: conflict.id, status: JiraSyncConflictStatus.OPEN } as never,
			{ status: JiraSyncConflictStatus.RESOLVED, resolution, resolvedAt, resolvedByUserId: userId, updatedAt: resolvedAt } as never
		);
		if (claimed?.affected === 0) {
			throw new NotFoundException({ message: 'The conflict was not found, or is resolved already', code: JIRA_CONFLICT_NOT_FOUND });
		}
		if (patch) {
			try {
				// Through the platform's task update, with its event: a mapping that sends changes out sends the value to the issue.
				await this.commandBus.execute(
					new TaskUpdateCommand(conflict.taskId, { ...patch, tenantId: conflict.tenantId, organizationId: conflict.organizationId } as ITaskUpdateInput, true)
				);
			} catch (error) {
				await this.conflicts
					.update({ id: conflict.id } as never, { status: JiraSyncConflictStatus.OPEN, resolution: null, resolvedAt: null, resolvedByUserId: null, updatedAt: new Date() } as never)
					.catch(() => undefined);
				throw error;
			}
		}
		return Object.assign(conflict, { status: JiraSyncConflictStatus.RESOLVED, resolution, resolvedAt, resolvedByUserId: userId });
	}
}

/**
 * The synced values of a task as they compare with an issue's: its description as it reads after a trip to Jira and
 * back (Jira keeps rich text as ADF, the task as HTML; the issue's value is Jira's ADF read back as HTML). Without it a
 * description sent to Jira would come back in Jira's reading of it, and the next apply would take the two spellings of
 * one text for a change on both sides.
 */
export function platformValuesOf(task: Record<string, unknown>): SyncedTaskValues {
	const values = syncedValuesOf(task as never);
	const description = task['description'];
	return { ...values, description: syncedValuesOf({ description: canonicalHtml(typeof description === 'string' ? description : null) }).description };
}

/**
 * The task columns a conflict restores: the ones recorded with it (a due date back to a date), or, when the record
 * cannot be read, the value it shows.
 */
export function restorePatchOf(json: string | null | undefined, field: SyncedTaskField, shown: string | null): Record<string, unknown> {
	let patch: Record<string, unknown> | null = null;
	try {
		const parsed = json ? JSON.parse(json) : null;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && field in parsed) patch = parsed as Record<string, unknown>;
	} catch {
		patch = null;
	}
	if (!patch) patch = { [field]: shown };
	if (field === 'dueDate') {
		const value = patch['dueDate'];
		return { dueDate: typeof value === 'string' && value ? new Date(value) : null };
	}
	return patch;
}
