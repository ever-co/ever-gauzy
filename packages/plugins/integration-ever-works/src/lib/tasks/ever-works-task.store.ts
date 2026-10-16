import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID, ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
import {
	Comment,
	Employee,
	OrganizationProject,
	OrganizationStrategicInitiative,
	RequestContext,
	Tag,
	Task,
	TaskCreateCommand,
	TaskPriority,
	TaskService,
	TaskStatus,
	TaskUpdateCommand
} from '@gauzy/core';
import { gauzyStatusSlug, resolveGauzyStatusRow } from '../sync/mappers/status-priority.mapper';

/** Who a Gauzy write made by the sync is attributed to (plan 01 §3, plan 03 §C.4 step 4). */
export interface EverWorksTaskActor {
	/** The Gauzy user (the mapped person, the agent's user, or the admin who connected); `null` = none. */
	userId: ID | null;
	name: string;
	/** An Ever Works agent wrote it: comments and activity carry `ActorTypeEnum.Agent`. */
	agent: boolean;
	/** The agent's (or person's) employee, for the comments it writes. */
	employeeId: ID | null;
}

/** Where a task sits, for resolving its status and priority rows (team → project → organization → global). */
export interface EverWorksTaskScope {
	tenantId: ID;
	organizationId: ID;
	projectId: ID | null;
	teamId: ID | null;
}

/** A status or priority row (or, when none fits, just the slug). */
export interface EverWorksTaskOption {
	value: string;
	id: ID | null;
}

/**
 * This process cannot open a request context (the worker builds its own module graph without core's
 * `AppModule`, so there is no CLS service and no task command handlers). Task writes are applied by a
 * process that serves the API; the change is retried there.
 */
export class EverWorksRequestContextUnavailableError extends Error {
	constructor() {
		super('This process has no request context for Gauzy task writes; a process that serves the API applies them.');
		this.name = 'EverWorksRequestContextUnavailableError';
	}
}

/** The relations every task read of the sync loads. */
const TASK_RELATIONS = { members: true, teams: true, tags: true, project: true, taskStatus: true, taskPriority: true } as const;

/** A tag colour from its name (Gauzy requires one), stable so a tag looks the same wherever it is made. */
const TAG_COLOURS = ['#6E49E8', '#0BA5EC', '#12B76A', '#F79009', '#F04438', '#EE46BC', '#667085', '#2E90FA'];
export function tagColourFor(name: string): string {
	let hash = 0;
	for (const char of name.toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
	return TAG_COLOURS[hash % TAG_COLOURS.length] as string;
}

/**
 * The Gauzy side of the task sync: reads tasks with what the sync compares, writes them through the
 * platform's own task commands (so numbering, sanitizing, subscriptions, mentions, activity and other
 * integrations behave as for any task write) inside a request context of the attributed user, and
 * resolves the rows a task points at (statuses, priorities, tags) in the task's scope.
 */
@Injectable()
export class EverWorksTaskStore {
	constructor(
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus,
		private readonly moduleRef: ModuleRef
	) {}

	/**
	 * Runs Gauzy writes as `actor`, in the task's tenant and organization: the platform's services read the
	 * tenant, the user (`createdByUserId` / `updatedByUserId`) and the organization from the request context,
	 * which a background sync does not have. No employee is set, so a task created by the sync does not get
	 * the creator added as a member (plan 01 §7), and no permission is held.
	 */
	async asActor<T>(scope: { tenantId: ID; organizationId: ID }, actor: EverWorksTaskActor | null, work: () => Promise<T>): Promise<T> {
		const user = {
			id: actor?.userId ?? undefined,
			tenantId: scope.tenantId,
			lastOrganizationId: scope.organizationId,
			name: actor?.name ?? 'Ever Works',
			firstName: actor?.name ?? 'Ever Works',
			lastName: '',
			employeeId: undefined,
			permissions: []
		};
		const request = { user, headers: {}, query: {}, params: {}, body: {} };
		return RequestContext.runWithRequest(
			request as never,
			async () => {
				// A process without the platform's request context (the worker: no core AppModule, no CLS) would
				// write tenant-less rows: refuse before anything is written.
				if (RequestContext.currentTenantId() !== scope.tenantId) throw new EverWorksRequestContextUnavailableError();
				return work();
			},
			{ id: randomUUID() as ID }
		);
	}

	/** A task with its members, teams, tags, project, status and priority; deleted ones included. */
	async load(tenantId: ID, taskId: ID): Promise<Task | null> {
		return this.dataSource.getRepository(Task).findOne({
			where: { id: taskId, tenantId } as never,
			relations: TASK_RELATIONS as never,
			withDeleted: true
		});
	}

	/** Creates a task through `TaskCreateCommand` (call inside {@link asActor}); returns its id. */
	async create(input: Partial<ITaskCreateInput>): Promise<ID> {
		const task = (await this.commandBus.execute(new TaskCreateCommand(input as ITaskCreateInput, true))) as Task;
		return task.id as ID;
	}

	/** Updates a task through `TaskUpdateCommand` (call inside {@link asActor}). */
	async update(taskId: ID, input: Partial<ITaskUpdateInput>): Promise<void> {
		await this.commandBus.execute(new TaskUpdateCommand(taskId, input as ITaskUpdateInput, true));
	}

	/** Soft-deletes a task through the platform's task service (call inside {@link asActor}). */
	async softDelete(taskId: ID): Promise<void> {
		await this.moduleRef.get(TaskService, { strict: false }).softRemove(taskId);
	}

	/**
	 * The status row for an Ever Works status in the task's scope: the first scope with statuses of its own
	 * (team, then project, then organization, then the global defaults) is the task's status set, and in it
	 * the row is found by slug, then by flag (plan 01 §7.1). No row fits → the slug alone.
	 */
	async statusFor(scope: EverWorksTaskScope, everWorksStatus: string, fallbackSlug: string): Promise<EverWorksTaskOption> {
		for (const rows of await this.scopedRows(TaskStatus, scope)) {
			if (!rows.length) continue;
			const row = resolveGauzyStatusRow(everWorksStatus, rows);
			if (row) return { value: row.value, id: row.id as ID };
			break;
		}
		return { value: fallbackSlug, id: null };
	}

	/** The priority row of a slug (`urgent`, `high`, `medium`, `low`) in the task's scope, else the slug alone. */
	async priorityFor(scope: EverWorksTaskScope, slug: string): Promise<EverWorksTaskOption> {
		for (const rows of await this.scopedRows(TaskPriority, scope)) {
			if (!rows.length) continue;
			const row = rows.find((candidate) => gauzyStatusSlug(candidate.value ?? candidate.name) === slug);
			if (row) return { value: row.value, id: row.id as ID };
			break;
		}
		return { value: slug, id: null };
	}

	/** Rows of a scoped option table, most specific scope first. */
	private async scopedRows<T extends TaskStatus | TaskPriority>(entity: new () => T, scope: EverWorksTaskScope): Promise<T[][]> {
		const repository = this.dataSource.getRepository(entity);
		const tiers: Array<Record<string, unknown>> = [];
		if (scope.teamId) tiers.push({ tenantId: scope.tenantId, organizationId: scope.organizationId, organizationTeamId: scope.teamId });
		if (scope.projectId) tiers.push({ tenantId: scope.tenantId, organizationId: scope.organizationId, projectId: scope.projectId, organizationTeamId: IsNull() });
		tiers.push({ tenantId: scope.tenantId, organizationId: scope.organizationId, projectId: IsNull(), organizationTeamId: IsNull() });
		tiers.push({ tenantId: IsNull(), organizationId: IsNull(), projectId: IsNull(), organizationTeamId: IsNull(), isSystem: true });
		const result: T[][] = [];
		// Statuses have an order of their own; priorities do not.
		const order = (entity as unknown) === TaskStatus ? ({ order: 'ASC' } as never) : undefined;
		for (const where of tiers) {
			result.push(await repository.find({ where: where as never, ...(order ? { order } : {}) }));
		}
		return result;
	}

	/**
	 * The organization's tags of these names (case-insensitive), created on demand (plan 01 §7: labels are
	 * Tag rows, organization-scoped, created by name). Returned in the order of `names`.
	 */
	async ensureTags(tenantId: ID, organizationId: ID, names: ReadonlyArray<string>): Promise<Array<{ id: ID; name: string }>> {
		const wanted = [...new Map(names.map((name) => [name.trim().toLowerCase(), name.trim()])).entries()].filter(([key]) => !!key);
		if (!wanted.length) return [];
		const repository = this.dataSource.getRepository(Tag);
		const existing = await repository.find({
			where: [
				{ tenantId, organizationId },
				{ tenantId, organizationId: IsNull() }
			] as never
		});
		// The organization's own tag wins over a tenant-wide one of the same name.
		const byName = new Map<string, Tag>();
		for (const tag of existing.sort((a, b) => Number(!!b.organizationId) - Number(!!a.organizationId))) {
			const key = (tag.name ?? '').trim().toLowerCase();
			if (key && !byName.has(key) && !tag.organizationTeamId) byName.set(key, tag);
		}
		const result: Array<{ id: ID; name: string }> = [];
		for (const [key, name] of wanted) {
			let tag = byName.get(key);
			if (!tag) {
				tag = await repository.save(repository.create({ name, color: tagColourFor(name), tenantId, organizationId, isSystem: false } as unknown as Tag));
				byName.set(key, tag);
			}
			result.push({ id: (tag as Tag).id as ID, name: (tag as Tag).name });
		}
		return result;
	}

	/** Adds a comment to a task (the sync's own notes: a kept status, a conflicting edit). */
	async addComment(scope: { tenantId: ID; organizationId: ID }, taskId: ID, html: string, actorType: ActorTypeEnum, employeeId: ID | null = null): Promise<void> {
		const repository = this.dataSource.getRepository(Comment);
		await repository.save(
			repository.create({
				entity: BaseEntityEnum.Task,
				entityId: taskId,
				comment: html,
				actorType,
				employeeId: employeeId ?? undefined,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			} as unknown as Comment)
		);
	}

	/** The user (and display name) of an employee. */
	async userOfEmployee(employeeId: ID): Promise<{ userId: ID | null; name: string | null }> {
		const employee = await this.dataSource.getRepository(Employee).findOne({ where: { id: employeeId } as never, relations: { user: true } as never });
		const user = employee?.user as { id?: ID; firstName?: string | null; lastName?: string | null; name?: string | null } | undefined;
		const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || null;
		return { userId: (employee?.userId as ID) ?? null, name };
	}

	/** The employee of a user in an organization, or `null`. */
	async employeeOfUser(tenantId: ID, organizationId: ID, userId: ID): Promise<ID | null> {
		const employee = await this.dataSource.getRepository(Employee).findOne({ where: { tenantId, organizationId, userId } as never });
		return (employee?.id as ID) ?? null;
	}

	/** Whether a project is an active project of the organization. */
	async projectExists(tenantId: ID, organizationId: ID, projectId: ID): Promise<boolean> {
		const count = await this.dataSource.getRepository(OrganizationProject).count({ where: { id: projectId, tenantId, organizationId, isArchived: false } as never });
		return count > 0;
	}

	/** The projects aligned with a strategic initiative. */
	async initiativeProjects(initiativeId: ID): Promise<ID[]> {
		const projects = (await this.dataSource
			.createQueryBuilder()
			.relation(OrganizationStrategicInitiative, 'projects')
			.of(initiativeId)
			.loadMany()) as Array<{ id: ID; isArchived?: boolean }>;
		return projects.filter((project) => !project.isArchived).map((project) => project.id);
	}

	/** Whether making `candidateParentId` the parent of `taskId` would make a cycle (it is the task or one of its descendants). */
	async isSelfOrAncestor(taskId: ID, candidateParentId: ID): Promise<boolean> {
		let cursor: ID | null = candidateParentId;
		for (let depth = 0; cursor && depth < 50; depth++) {
			if (cursor === taskId) return true;
			const row: { parentId?: ID | null } | null = await this.dataSource
				.getRepository(Task)
				.findOne({ where: { id: cursor } as never, select: { id: true, parentId: true } as never, withDeleted: true });
			cursor = (row?.parentId as ID) ?? null;
		}
		return false;
	}
}
