import { EventBus } from '@nestjs/cqrs';
import {
	Injectable,
	BadRequestException,
	ForbiddenException,
	HttpStatus,
	HttpException,
	NotFoundException,
	Optional
} from '@nestjs/common';
import {
	DeleteResult,
	IsNull,
	SelectQueryBuilder,
	Brackets,
	WhereExpressionBuilder,
	In,
	FindOptionsWhere,
	FindManyOptions,
	Between,
	FindOptionsRelations,
	LessThanOrEqual,
	MoreThanOrEqual,
	Raw,
	SaveOptions,
	Not,
	EntityManager
} from 'typeorm';
import { isBoolean, isUUID } from 'class-validator';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import {
	BaseEntityEnum,
	ActorTypeEnum,
	ID,
	IEmployee,
	IUser,
	IGetTaskOptions,
	IGetTasksByViewFilters,
	IPagination,
	ITask,
	ITaskUpdateInput,
	PermissionsEnum,
	RolesEnum,
	ActionTypeEnum,
	ITaskDateFilterInput,
	EntitySubscriptionTypeEnum,
	ITaskAdvancedFilter,
	IAdvancedTaskFiltering,
	EmployeeNotificationTypeEnum,
	NotificationActionTypeEnum,
	ITimeLog,
	TaskSyncScopeEnum,
	TimesheetStatus,
	ITaskBuiltInViewQuery,
	ITaskBulkUpdateInput,
	ITaskBulkUpdateOutcome,
	ITaskBulkUpdateResult,
	ITaskReferenceResolution,
	ITaskReferenceResolveInput,
	TaskBuiltInViewEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/utils';
import { isMySQL, isPostgres, isSqlite } from '@gauzy/config';
import { TenantAwareCrudService, BaseQueryDTO } from './../core/crud';
import { IPartialEntity } from './../core/crud/icrud.service';
import { sanitizeRichHtml } from './../core/html-sanitizer';
import {
	mikroOrmContains,
	MultiORMEnum,
	parseFindOptionsRelations,
	parseFindOptionsSelect,
	parseTypeORMFindToMikroOrm
} from './../core/utils';
import { addBetween, LIKE_OPERATOR } from './../core/util';
import { RequestContext } from '../core/context';
import { TaskViewService } from './views/view.service';
import { EntitySubscriptionService } from '../entity-subscription/entity-subscription.service';
import { MentionService } from '../mention/mention.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { EmployeeNotificationService } from '../employee-notification/employee-notification.service';
import { EmployeeRecentVisitService } from '../employee-recent-visit/employee-recent-visit.service';
import { ManagedEmployeeService } from '../employee/managed-employee.service';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import {
	Employee,
	Organization,
	OrganizationProject,
	OrganizationSprintTaskHistory,
	TaskFormerReference,
	TimeLog,
	Timesheet
} from '../core/entities/internal';
import { EventBus as DomainEventBus } from '../event-bus/event-bus';
import { TaskEvent } from '../event-bus/events/task.event';
import { BaseEntityEventTypeEnum } from '../event-bus/base-entity-event';
import { IFindOneOptions } from '../core/crud/icrud.service';
import { Task } from './task.entity';
import { BulkUpdateRequestError, changesToUpdate, normalizeBulkUpdate } from './bulk-update';
import { derivedProjectKey, keysOfProject, normalizeTaskKey, parseTaskReference } from './task-reference';
import { BUILT_IN_VIEW_DEFAULT_RELATIONS, BUILT_IN_VIEW_RELATIONS, builtInViewWindow, relationsTreeOf } from './built-in-views';
import { TypeOrmOrganizationSprintTaskHistoryRepository } from './../organization-sprint/repository/type-orm-organization-sprint-task-history.repository';
import { GetTaskByIdDTO } from './dto';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmTaskRepository } from './repository/type-orm-task.repository';
import { MikroOrmTaskRepository } from './repository/mikro-orm-task.repository';
import { FavoriteService } from '../core/decorators';
import { assertCallerColumnsAllowed } from '../core/util/caller-restricted-columns.helper';

function isLockedTimeLog(timeLog: ITimeLog): boolean {
	const isApproved = timeLog.timesheet?.status === TimesheetStatus.APPROVED;
	const isBilled = timeLog.timesheet?.isBilled === true;
	return isApproved || isBilled;
}

function isMovableToProject(timeLog: ITimeLog, projectId: ID | null): boolean {
	const isUnderAnotherProject = (timeLog.projectId ?? null) !== projectId;
	return isUnderAnotherProject && !isLockedTimeLog(timeLog);
}

function timesheetIdsOf(timeLogs: ITimeLog[]): ID[] {
	const ids = timeLogs.map((timeLog) => timeLog.timesheet?.id);
	const presentIds = ids.filter((id): id is ID => Boolean(id));
	return [...new Set(presentIds)];
}

/**
 * The task's teams that belong to the task's own organization. Task writes only check that a linked team is in the
 * same tenant, so a task can reference a team of another organization: only teams of the task's organization count
 * towards managing it, and a task without an organization has none.
 */
function teamIdsOfTaskOrganization(task: Pick<Task, 'organizationId' | 'teams'>): ID[] {
	if (!isNotEmpty(task.organizationId)) {
		return [];
	}
	const ownTeams = (task.teams ?? []).filter((team) => team.organizationId === task.organizationId);
	return ownTeams.map((team) => team.id);
}

@FavoriteService(BaseEntityEnum.Task)
@Injectable()
export class TaskService extends TenantAwareCrudService<Task> {
	constructor(
		readonly typeOrmTaskRepository: TypeOrmTaskRepository,
		readonly mikroOrmTaskRepository: MikroOrmTaskRepository,
		readonly typeOrmOrganizationSprintTaskHistoryRepository: TypeOrmOrganizationSprintTaskHistoryRepository,
		private readonly _eventBus: EventBus,
		private readonly _taskViewService: TaskViewService,
		private readonly _entitySubscriptionService: EntitySubscriptionService,
		private readonly _mentionService: MentionService,
		private readonly _activityLogService: ActivityLogService,
		private readonly _employeeNotificationService: EmployeeNotificationService,
		private readonly _employeeRecentVisitService: EmployeeRecentVisitService,
		private readonly _managedEmployeeService: ManagedEmployeeService,
		/**
		 * The in-process domain event bus `TaskEvent` travels on (the one the create and update handlers
		 * publish to). Optional so that a service built by hand in a test needs no stand-in for it.
		 */
		@Optional() private readonly _domainEventBus?: DomainEventBus
	) {
		super(typeOrmTaskRepository, mikroOrmTaskRepository);
	}

	/**
	 * Creates a task, sanitizing the rich-text `description` HTML through the shared
	 * server-side allowlist before persisting (see `sanitizeRichHtml`).
	 *
	 * @param entity - The task creation input
	 * @returns The created task
	 */
	public async create(entity: IPartialEntity<Task>): Promise<Task> {
		const input = entity as { description?: string };
		if (typeof input.description === 'string') {
			input.description = sanitizeRichHtml(input.description);
		}
		return await super.create(entity);
	}

	/**
	 * Update task, if already exist
	 *
	 * @param id - The ID of the task to update
	 * @param input - The data to update the task with
	 * @returns The updated task
	 */
	async update(id: ID, input: Partial<ITaskUpdateInput>): Promise<ITask> {
		try {
			// Sanitize the rich-text description HTML before it reaches the persistence path below.
			if (typeof input.description === 'string') {
				input.description = sanitizeRichHtml(input.description);
			}
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const userId = RequestContext.currentUserId();

			const user = RequestContext.currentUser();
			const { mentionEmployeeIds, moveTimeLogs, ...data } = input;

			// Find task relations
			const relations: FindOptionsRelations<Task> = {
				tags: true,
				members: true,
				teams: true,
				modules: true,
				parent: true,
				project: true,
				organizationSprint: true,
				taskStatus: true,
				taskSize: true,
				taskPriority: true,
				linkedIssues: true,
				dailyPlans: true
			};

			const task = await this.findOneByIdString(id, { relations });

			const taskMembers = task.members;

			// Separate members into removed and new members. Only an update that carries `members` changes
			// them: without it (the estimate recalculated after an estimation changes, a module or screening
			// update, a partial PUT) every assignee used to count as removed and lost their ASSIGNMENT subscription.
			const membersChanged = Array.isArray(data.members);
			const memberIdSet = new Set((data.members || []).map(({ id }) => id));
			const existingMemberIdSet = new Set((taskMembers || []).map(({ id }) => id));

			const removedMembers = membersChanged
				? (taskMembers || []).filter((member) => !memberIdSet.has(member.id))
				: [];
			const newMembers = (data.members || []).filter((member) => !existingMemberIdSet.has(member.id));

			// A task that moves to another project is renumbered in the project it moves TO: `number` is unique
			// per project, so the next number of the old project (what this computed before) could collide in
			// the new one, or leave the task numbered as if it had never moved. The prefix follows the project
			// too, by the rule the create path uses (the first three characters of the project's name). The move
			// is written by the one save below, together with the rest of the update: a save that fails leaves
			// the task where it was.
			let moved: Partial<Task> | null = null;
			let reclaimedNumber: number | null = null;
			if (data.projectId && data.projectId !== task.projectId) {
				// The task's organization after the update: the destination must be a project of it, and the next
				// number is counted in it (counting in another organization could hand out a taken number).
				const organizationId = data.organizationId ?? task.organizationId;
				const projectId = data.projectId;

				// Fails closed: a project that is not one of the organization's, or one that cannot be checked, is
				// refused before anything is written (the tenant guard of the save checks the tenant only).
				const destination = await this.findDestinationProject(projectId, tenantId, organizationId);
				if (!destination.exists) {
					throw new BadRequestException(
						"The task cannot move to a project that is not one of the task's organization."
					);
				}

				// A task moving back to a project it left takes back the number it held there (an undo restores
				// `API-42`, not `API-43`); its former reference there is removed with the save. Otherwise the next number of
				// the project the task moves to, soft-deleted tasks included: they keep their number in the `taskNumber`
				// unique index, as for a new task
				reclaimedNumber = await this.reclaimableNumberOf(id, projectId, tenantId, organizationId);
				const number =
					reclaimedNumber ??
					(await this.getMaxTaskNumberByProject(
						{
							tenantId,
							organizationId,
							projectId
						},
						{ withDeleted: true }
					)) + 1;

				moved = {
					projectId,
					number,
					// The destination's prefix, never the input's.
					prefix: destination.prefix,
					// A relation object in the input would otherwise point the save back at another project.
					...('project' in data ? { project: { id: projectId } as Task['project'] } : {})
				};
			}

			// Update the task with the provided data. When the task moved, the project, number and prefix computed
			// above win over any the input carries: a client that sends the whole task back sends the old number.
			// A body that removes the project can still carry the old `project` relation, which would keep the task in it
			const saved: Partial<Task> = { ...(moved ?? {}) };
			const removesProject = data.projectId === null && 'project' in data;
			if (removesProject) {
				saved.project = null;
			}

			const namesProject = data.projectId !== undefined;
			const changesProject = (data.projectId ?? null) !== (task.projectId ?? null);
			const { organizationSprintId } = data;
			const movesSprint = !!organizationSprintId && organizationSprintId !== task.organizationSprintId;

			// The save, the reference the task leaves behind, the sprint move history and the read-back of the sync scope
			// are one transaction: when a step fails the save is undone, so an update reported as failed (a bulk update's
			// `ok: false`) changed nothing. The steps after it (mentions, time logs, subscriptions, activity) are best
			// effort and run once it committed.
			const updatedTask = await this.inUpdateTransaction(async ({ service, manager, inTransaction }) => {
				// A task that leaves its project keeps the reference it held there (`API-42`), so the reference keeps
				// resolving to it and the number is not handed to another task of that project (see TaskFormerReference).
				// The reference is the one the task holds when this transaction writes, read with the row locked: a move
				// that committed since the task was read above (`API-42` → `SYS-1`) leaves `SYS-1`, not `API-42` again.
				const current = namesProject ? await this.lockedReferenceOf(manager, id, task, inTransaction) : task;
				const leavesProject =
					namesProject &&
					!!current.projectId &&
					current.number !== null &&
					current.number !== undefined &&
					(data.projectId ?? null) !== current.projectId;

				// The reference is written before the save. In the transaction the order does not matter. Without one
				// (MikroORM), a save that fails after it leaves a reference to the number the task still holds, which
				// the live number answers first: harmless. A reference written after a save that succeeded could
				// instead fail and lose `API-42` for good.
				if (leavesProject) {
					await manager.getRepository(TaskFormerReference).save({
						taskId: id,
						projectId: current.projectId,
						number: current.number,
						prefix: current.prefix ?? null,
						// The organization the reference was valid in: the one the task was in before the update
						organizationId: current.organizationId ?? task.organizationId,
						tenantId
					});
				}

				const updated = await service.saveTaskRow({
					...data,
					id,
					...saved
				});

				if (reclaimedNumber !== null && moved) {
					// The reference the task held in the project it is back in is its live number again
					await manager.getRepository(TaskFormerReference).delete({
						taskId: id,
						projectId: moved.projectId,
						number: reclaimedNumber
					});
				}

				// Register Task Sprint moving history
				if (movesSprint) {
					await manager.getRepository(OrganizationSprintTaskHistory).save({
						fromSprintId: task.organizationSprintId || organizationSprintId, // Use incoming sprint ID if the task's organizationSprintId was previously null or undefined
						toSprintId: organizationSprintId,
						taskId: updated.id,
						movedById: userId,
						reason: data.taskSprintMoveReason,
						// A partial update may not carry the organization: fall back to the stored one
						organizationId: data.organizationId ?? task.organizationId,
						tenantId
					});
				}

				// Same for the sync scope: the integrations read it from the updated-task event, so a partial update of a
				// private task must not look like an `all` task to them. The scope is read back from the row after the save
				// (not from the copy read before it), so a concurrent edit of the scope is not overwritten in the event. A
				// failed read-back fails the update (no UPDATED event) rather than publish a possibly stale scope.
				if (updated.syncScope === undefined) {
					const row = await service.findOneByIdString(id, { select: { id: true, syncScope: true } });
					updated.syncScope = row.syncScope ?? null;
				}
				return updated;
			});

			// Synchronize mentions (only if mentionEmployeeIds is provided)
			if (data.description && mentionEmployeeIds) {
				// The saved organization: the edit may have moved the task to another one
				await this.syncTaskMentions(id, mentionEmployeeIds, updatedTask.organizationId ?? task.organizationId);
			}

			// The save returns what was written: a partial update (e.g. only the estimate) carries no organization
			// or title, so fall back to the stored task for the subscriptions and the activity log.
			const organizationId = updatedTask.organizationId ?? task.organizationId;

			const timeLogsFollowProject = moveTimeLogs === true && namesProject && changesProject;
			if (timeLogsFollowProject) {
				const taskProjectId = moved?.projectId ?? data.projectId ?? null;
				await this.moveTimeLogsToProject(id, taskProjectId, organizationId, tenantId);
			}

			// Unsubscribe members who were unassigned from task
			await this.unsubscribeRemovedMembers(removedMembers, updatedTask.id, organizationId, tenantId);

			// Subscribe the new assignees to the task
			await this.subscribeNewMembers(newMembers, task, updatedTask.id, organizationId, tenantId, user);

			// Generate the activity log
			this._activityLogService.logActivity<Task>(
				BaseEntityEnum.Task,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User, // TODO : Since we have Github Integration, make sure we can also store "System" for actor
				updatedTask.id,
				updatedTask.title ?? task.title,
				updatedTask,
				organizationId,
				tenantId,
				task,
				data
			);

			// Return the updated Task
			return updatedTask;
		} catch (error) {
			console.error(`Error while updating task: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Runs the writes of one task update in one TypeORM transaction. `work` gets the manager of the transaction and a
	 * view of this service whose TypeORM repository is bound to it, so the tenant-aware save (its scope and foreign-row
	 * checks included) and every read and write made through either take part in the transaction: when one fails,
	 * nothing of the update is stored. On MikroORM the work runs as it always did, on the service and the data source's
	 * manager, without a transaction around it.
	 *
	 * Nothing that opens a transaction of its own on another connection may run inside `work` (on Postgres it would wait
	 * for the task row this transaction holds): the time-log move, which locks that row, runs after the commit.
	 */
	private async inUpdateTransaction<R>(
		work: (scope: { service: TaskService; manager: EntityManager; inTransaction: boolean }) => Promise<R>
	): Promise<R> {
		if (this.ormType !== MultiORMEnum.TypeORM) {
			return work({ service: this, manager: this.typeOrmRepository.manager, inTransaction: false });
		}
		return this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			// A view, not a copy: every other member is this service's own, read through the prototype.
			const service: TaskService = Object.create(this, {
				typeOrmRepository: { value: manager.getRepository(Task), configurable: true }
			});
			return work({ service, manager, inTransaction: true });
		});
	}

	/**
	 * The number a task held in a project before it moved out of it (its latest former reference there), when no task of
	 * the project holds it now: the number the task takes back when it moves back. Null when there is none. Best
	 * effort: a failed read counts as none, and the task is numbered as any moved task.
	 */
	private async reclaimableNumberOf(taskId: ID, projectId: ID, tenantId: ID, organizationId: ID): Promise<number | null> {
		try {
			const former = await this.typeOrmRepository.manager.findOne(TaskFormerReference, {
				where: { taskId, projectId, tenantId, organizationId },
				select: { id: true, number: true },
				order: { number: 'DESC' }
			});
			if (!former || former.number === null || former.number === undefined) {
				return null;
			}
			const number = Number(former.number);
			const holders = await this.typeOrmRepository.manager.count(Task, {
				where: { projectId, number, tenantId, organizationId },
				withDeleted: true
			});
			return holders === 0 ? number : null;
		} catch (error) {
			console.error('Error reading the former number of the task in its project:', error?.message);
			return null;
		}
	}

	/** The tenant-aware save of an update, on the repository `this` carries (a transaction's, see inUpdateTransaction). */
	private saveTaskRow(entity: IPartialEntity<Task>): Promise<Task> {
		return super.create(entity);
	}

	/**
	 * The task's project, number, prefix and organization as stored now, read by the update's transaction. On Postgres
	 * and MySQL the row stays locked until the transaction ends (`FOR UPDATE`), so a concurrent update of the same task
	 * waits for this one and then reads what it stored; the embedded dialect runs one transaction at a time. Outside a
	 * transaction (MikroORM) it is a plain read. What the read does not answer is taken from the task read before.
	 */
	private async lockedReferenceOf(
		manager: EntityManager,
		id: ID,
		task: Task,
		inTransaction: boolean
	): Promise<Pick<Task, 'projectId' | 'number' | 'prefix' | 'organizationId'>> {
		const query = manager
			.createQueryBuilder(Task, 'task')
			.select(['task.id', 'task.projectId', 'task.number', 'task.prefix', 'task.organizationId'])
			.where({ id });
		if (inTransaction && (isPostgres() || isMySQL())) {
			query.setLock('pessimistic_write');
		}
		const row = await query.getOne();
		return row ? { ...task, ...row } : task;
	}

	/**
	 * Synchronizes the task's mention records with the employees mentioned in the update.
	 *
	 * Best-effort by design: the task itself is already persisted by the time this runs, so a
	 * mention-sync failure is logged and swallowed instead of failing the update.
	 *
	 * @param taskId - The ID of the updated task
	 * @param mentionEmployeeIds - The IDs of the employees mentioned in the description
	 */
	private async syncTaskMentions(taskId: ID, mentionEmployeeIds: ID[], organizationId: ID): Promise<void> {
		try {
			await this._mentionService.updateEntityMentions(
				BaseEntityEnum.Task,
				taskId,
				mentionEmployeeIds,
				undefined,
				undefined,
				organizationId
			);
		} catch (error) {
			console.error('Error synchronizing mentions:', error);
		}
	}

	/**
	 * Unsubscribes the members who were unassigned from the task.
	 *
	 * Best-effort by design: failures are logged and swallowed so subscription cleanup can never
	 * fail an update that already succeeded.
	 *
	 * @param members - The members that are no longer assigned to the task
	 * @param taskId - The ID of the updated task
	 * @param organizationId - The organization of the updated task
	 * @param tenantId - The tenant of the updated task
	 */
	private async unsubscribeRemovedMembers(
		members: IEmployee[],
		taskId: ID,
		organizationId: ID,
		tenantId: ID
	): Promise<void> {
		if (members.length === 0) {
			return;
		}

		try {
			await Promise.all(
				members.map(
					async (member) =>
						await this._entitySubscriptionService.delete({
							entity: BaseEntityEnum.Task,
							entityId: taskId,
							employeeId: member.id,
							type: EntitySubscriptionTypeEnum.ASSIGNMENT,
							organizationId,
							tenantId
						})
				)
			);
		} catch (error) {
			console.error('Error unsubscribing members from the task:', error);
		}
	}

	/**
	 * Subscribes the newly assigned members to the task and notifies them of the assignment.
	 *
	 * Best-effort by design: failures are logged and swallowed so the subscription/notification
	 * path can never fail an update that already succeeded.
	 *
	 * @param members - The members newly assigned to the task
	 * @param task - The task as loaded BEFORE the update (source of the notified id and title)
	 * @param updatedTaskId - The ID of the updated task (subscription target)
	 * @param organizationId - The organization of the updated task
	 * @param tenantId - The tenant of the updated task
	 * @param user - The user performing the update
	 */
	private async subscribeNewMembers(
		members: IEmployee[],
		task: Task,
		updatedTaskId: ID,
		organizationId: ID,
		tenantId: ID,
		user: IUser
	): Promise<void> {
		if (!members.length) {
			return;
		}

		try {
			await Promise.all(
				members.map((member: IEmployee) => {
					this._eventBus.publish(
						new CreateEntitySubscriptionEvent({
							entity: BaseEntityEnum.Task,
							entityId: updatedTaskId,
							employeeId: member.id,
							type: EntitySubscriptionTypeEnum.ASSIGNMENT,
							organizationId,
							tenantId
						})
					);

					this._employeeNotificationService.publishNotificationEvent(
						{
							entity: BaseEntityEnum.Task,
							entityId: task.id,
							type: EmployeeNotificationTypeEnum.ASSIGNMENT,
							organizationId,
							tenantId,
							receiverEmployeeId: member.id,
							sentByEmployeeId: user?.employeeId
						},
						NotificationActionTypeEnum.Assigned,
						task.title,
						user?.name
					);
				})
			);
		} catch (error) {
			console.error('Error publishing CreateSubscriptionEvent:', error);
		}
	}

	/**
	 * Retrieves a task by its ID and includes optional related data.
	 *
	 * @param id The unique identifier of the task.
	 * @param params Additional parameters for fetching task details, including related entities.
	 * @returns A Promise that resolves to the task entity.
	 */
	async findById(id: ID, params: GetTaskByIdDTO): Promise<ITask> {
		const task = await this.findOneByIdString(id, params);

		// Include the root epic if requested
		if (params.includeRootEpic && task) {
			task.rootEpic = await this.findParentUntilEpic(task.id);
		}

		// Register the last visited at date for the current employee
		try {
			await this._employeeRecentVisitService.emitSaveEmployeeRecentVisitEvent<Task>(
				BaseEntityEnum.Task,
				task.id,
				task,
				task.organizationId,
				task.tenantId
			);
		} catch (error) {
			console.error('[Task] Error emitting employee recent visit event:', error);
		}

		return task;
	}

	/**
	 * Retrieves a paginated list of tasks, with optional advanced filters applied.
	 *
	 * @param options - Pagination options including limit, page, and sorting.
	 * @param filters - Optional filters for advanced task filtering.
	 * @returns A promise that resolves to a paginated list of tasks.
	 * @throws If an error occurs during the retrieval process.
	 */
	async findAll(options: BaseQueryDTO<Task> & IAdvancedTaskFiltering): Promise<IPagination<Task>> {
		try {
			const { filters } = options;
			let advancedFilters: FindOptionsWhere<Task> = {};
			if (filters) {
				advancedFilters = this.buildAdvancedWhereCondition(filters, options.where);
			}

			return super.findAll({ ...options, where: { ...advancedFilters, ...options.where } });
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Deletes a task on behalf of the current user.
	 *
	 * The route also admits ORG_TASK_EDIT so that a team manager, whose role holds no task-delete
	 * permission, reaches this check. Without ALL_ORG_EDIT or ORG_TASK_DELETE, the caller must manage one
	 * of the task's teams that belongs to the task's organization.
	 *
	 * @param id - The task to delete
	 * @returns The result of the deletion
	 * @throws ForbiddenException when the caller may not delete that task
	 */
	async deleteTask(id: ID): Promise<DeleteResult> {
		if (!RequestContext.hasAnyPermission([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE])) {
			const employeeId = RequestContext.currentEmployeeId();
			const taskWithTeams = await this.findOneByIdString(id, { relations: { teams: true } });
			const teamIds = teamIdsOfTaskOrganization(taskWithTeams);
			const isTeamManager =
				isNotEmpty(employeeId) &&
				(await this._managedEmployeeService.isManagerOfTeamsOrProjects(employeeId, teamIds));

			if (!isTeamManager) {
				throw new ForbiddenException('You can only delete a task of a team you manage.');
			}
		}

		// A hard delete leaves nothing to read afterwards, so the row the event carries is read first. A task that
		// does not exist is a delete that removes nothing, as before; a read that FAILS stops the delete, so a task
		// is never removed without its DELETED event.
		let task: Task | null = null;
		try {
			task = await this.findOneByIdString(id);
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		const result = await this.delete(id);

		if (task && result?.affected) {
			this.publishTaskEvent(task, BaseEntityEventTypeEnum.DELETED);
		}

		return result;
	}

	/**
	 * Assigns one employee to a task and writes nothing else on the task: the full update writes the whole member list,
	 * so a client that sends it back to add one member undoes any assignment made since it read the task.
	 *
	 * An employee may assign themselves. Assigning someone else needs an organization admin, a caller who acts for
	 * every employee, or a manager of one of the task's teams. The employee must be one of the task's organization, and
	 * an employee already on the task is a no-op.
	 *
	 * @param id - The task
	 * @param employeeId - The employee to assign
	 * @param organizationId - The caller's organization, which must be the task's
	 * @throws NotFoundException when the task is not one of the caller's tenant and organization
	 * @throws ForbiddenException when the caller may not assign that employee
	 * @throws BadRequestException when the employee is not one of the task's organization
	 */
	async addMember(id: ID, employeeId: ID, organizationId: ID): Promise<void> {
		const task = await this.findTaskForMemberChange(id, organizationId);
		await this.assertMayChangeMember(task, employeeId);

		const members = task.members ?? [];
		const isAlreadyMember = members.some((member) => member.id === employeeId);
		if (isAlreadyMember) {
			return;
		}

		const isEmployeeOfTaskOrganization = await this.isEmployeeOfOrganization(
			employeeId,
			task.tenantId,
			task.organizationId
		);
		if (!isEmployeeOfTaskOrganization) {
			throw new BadRequestException("The employee is not one of the task's organization.");
		}

		await this.insertMemberLink(id, employeeId);

		const addedMember = { id: employeeId } as IEmployee;
		const user = RequestContext.currentUser();
		await this.subscribeNewMembers([addedMember], task, id, task.organizationId, task.tenantId, user);
		await this.recordMemberChange(task, [...members, addedMember]);
	}

	/**
	 * Takes one employee off a task and writes nothing else on the task, for the same reason as {@link addMember}.
	 *
	 * An employee may take themselves off. Taking off someone else needs what assigning them needs. An employee who is
	 * not on the task is a no-op.
	 *
	 * @param id - The task
	 * @param employeeId - The employee to take off the task
	 * @param organizationId - The caller's organization, which must be the task's
	 * @throws NotFoundException when the task is not one of the caller's tenant and organization
	 * @throws ForbiddenException when the caller may not take that employee off the task
	 */
	async removeMember(id: ID, employeeId: ID, organizationId: ID): Promise<void> {
		const task = await this.findTaskForMemberChange(id, organizationId);
		await this.assertMayChangeMember(task, employeeId);

		const members = task.members ?? [];
		const removedMember = members.find((member) => member.id === employeeId);
		if (!removedMember) {
			return;
		}

		await this.deleteMemberLink(id, employeeId);

		await this.unsubscribeRemovedMembers([removedMember], id, task.organizationId, task.tenantId);
		const remainingMembers = members.filter((member) => member.id !== employeeId);
		await this.recordMemberChange(task, remainingMembers);
	}

	/**
	 * The task whose members change, with its members and teams, read in the caller's tenant.
	 *
	 * @param id - The task
	 * @param organizationId - The caller's organization, which must be the task's
	 * @throws NotFoundException when the task is not one of the caller's tenant and organization
	 */
	private async findTaskForMemberChange(id: ID, organizationId: ID): Promise<Task> {
		const task = await this.findOneByIdString(id, { relations: { members: true, teams: true } });
		const isTaskOfOrganization = isNotEmpty(organizationId) && task.organizationId === organizationId;
		if (!isTaskOfOrganization) {
			throw new NotFoundException('The requested record was not found');
		}
		return task;
	}

	/**
	 * Refuses to assign or unassign a member unless the caller changes their own assignment, is an organization admin
	 * or acts for every employee, or manages one of the task's teams (by the team's MANAGER role or the manager flag).
	 *
	 * @param task - The task, with its teams
	 * @param employeeId - The employee whose assignment changes
	 * @throws ForbiddenException when none of these holds
	 */
	private async assertMayChangeMember(task: Task, employeeId: ID): Promise<void> {
		// `currentEmployeeId()` answers null for a CHANGE_SELECTED_EMPLOYEE holder, so the caller's own employee is
		// read off the user.
		const callerEmployeeId = RequestContext.currentUser()?.employeeId;
		const changesOwnAssignment = isNotEmpty(callerEmployeeId) && callerEmployeeId === employeeId;
		if (changesOwnAssignment) {
			return;
		}

		const isOrganizationAdmin = RequestContext.hasRoles([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);
		const actsForEveryEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		if (isOrganizationAdmin || actsForEveryEmployee) {
			return;
		}

		const teamIds = teamIdsOfTaskOrganization(task);
		const managesTaskTeam = await this._managedEmployeeService.managesAnyTeam(callerEmployeeId, teamIds);
		if (!managesTaskTeam) {
			throw new ForbiddenException("Only a manager of the task's team can change another member's assignment.");
		}
	}

	/**
	 * Whether the employee is one of the organization, in the tenant.
	 *
	 * @param employeeId - The employee
	 * @param tenantId - The task's tenant
	 * @param organizationId - The task's organization
	 */
	private async isEmployeeOfOrganization(employeeId: ID, tenantId: ID, organizationId: ID): Promise<boolean> {
		const employee = await this.typeOrmRepository.manager.findOne(Employee, {
			where: { id: employeeId, tenantId, organizationId },
			select: { id: true }
		});
		return Boolean(employee);
	}

	/**
	 * Writes the activity log and the updated-task event of a member change, as the full update does.
	 *
	 * The integrations read the sync scope from the event, so it is read back from the row after the write, as the
	 * full update reads it: a scope turned off while this request waited must not reach them as the old one.
	 *
	 * @param task - The task as read before the change
	 * @param members - The task's members after the change
	 */
	private async recordMemberChange(task: Task, members: IEmployee[]): Promise<void> {
		const syncScope = await this.savedSyncScopeOrNone(task.id);
		const updatedTask = { ...task, members, syncScope } as Task;
		this._activityLogService.logActivity<Task>(
			BaseEntityEnum.Task,
			ActionTypeEnum.Updated,
			ActorTypeEnum.User,
			task.id,
			task.title,
			updatedTask,
			task.organizationId,
			task.tenantId,
			{ members: task.members ?? [] },
			{ members }
		);
		// The event states the members, so a listener that watches the followed fields sees the change.
		this.publishTaskEvent(updatedTask, BaseEntityEventTypeEnum.UPDATED, {
			members: members.map((member) => member.id).filter(Boolean)
		} as unknown as Partial<ITaskUpdateInput>);
	}

	/**
	 * The task's sync scope as saved, read back after a member write. The write is already done when this runs, so a
	 * read that fails does not fail the request and lose the activity and the event: it answers `none`, the scope no
	 * integration syncs.
	 *
	 * @param id - The task
	 * @returns The saved scope, or `none` when it cannot be read
	 */
	private async savedSyncScopeOrNone(id: ID): Promise<TaskSyncScopeEnum | null> {
		try {
			const saved = await this.findOneByIdString(id, { select: { id: true, syncScope: true } });
			return saved.syncScope ?? null;
		} catch (error) {
			console.error(`Failed to read back the sync scope of task ${id}:`, (error as Error)?.message);
			return TaskSyncScopeEnum.NONE;
		}
	}

	/**
	 * Inserts the one `task_employee` row that links the employee to the task, and does nothing when it exists.
	 *
	 * @param taskId - The task
	 * @param employeeId - The employee to link
	 */
	private async insertMemberLink(taskId: ID, employeeId: ID): Promise<void> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				await this.mikroOrmRepository
					.getKnex()('task_employee')
					.insert({ taskId, employeeId })
					.onConflict(['taskId', 'employeeId'])
					.ignore();
				break;
			case MultiORMEnum.TypeORM:
			default:
				await this.typeOrmRepository
					.createQueryBuilder()
					.insert()
					.into('task_employee')
					.values({ taskId, employeeId })
					.orIgnore()
					.execute();
				break;
		}
	}

	/**
	 * Deletes the one `task_employee` row that links the employee to the task.
	 *
	 * @param taskId - The task
	 * @param employeeId - The employee to unlink
	 */
	private async deleteMemberLink(taskId: ID, employeeId: ID): Promise<void> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				await this.mikroOrmRepository.getKnex()('task_employee').where({ taskId, employeeId }).del();
				break;
			case MultiORMEnum.TypeORM:
			default:
				await this.typeOrmRepository
					.createQueryBuilder()
					.relation(Task, 'members')
					.of(taskId)
					.remove(employeeId);
				break;
		}
	}

	/**
	 * Soft-deletes a task (`DELETE /tasks/:id/soft`, GraphQL `softDeleteTask`) and publishes
	 * `TaskEvent` `DELETED` for it, as a hard delete does.
	 *
	 * @param id - The task to soft-delete
	 * @param options - Find options for the lookup
	 * @param saveOptions - Save options for the write
	 * @returns The soft-deleted task
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Task>, saveOptions?: SaveOptions): Promise<Task> {
		const task = await super.softRemove(id, options, saveOptions);

		if (task) {
			this.publishTaskEvent(task, BaseEntityEventTypeEnum.DELETED);
		}

		return task;
	}

	/**
	 * Publishes a `TaskEvent` for a task written outside the create and update handlers (a hard or soft removal,
	 * a member taken off), so that integrations that mirror tasks elsewhere (Ever Works, GitHub, SIM workflows)
	 * learn about it the way they learn about a create or an update.
	 *
	 * The event's `input` carries the task's scope (`tenantId`, `organizationId`, `projectId`): existing
	 * `TaskEvent` subscribers read it before they switch on the event type. Publishing never fails the
	 * write: it is already done when this runs.
	 *
	 * @param task - The task as written
	 * @param type - What happened to it
	 */
	private publishTaskEvent(task: Task, type: BaseEntityEventTypeEnum, input: Partial<ITaskUpdateInput> = {}): void {
		if (!this._domainEventBus) {
			return;
		}
		const logFailure = (error: unknown) =>
			console.error(`Failed to publish the ${type} event of task ${task?.id}:`, (error as Error)?.message);
		try {
			const ctx = RequestContext.currentRequestContext();
			const { tenantId, organizationId, projectId } = task;
			// `publish` is async: a rejection is caught here as well, never left unhandled after the write.
			Promise.resolve(
				this._domainEventBus.publish(
					new TaskEvent(ctx, task, type, {
						tenantId,
						organizationId,
						projectId,
						...input
					} as ITaskUpdateInput)
				)
			).catch(logFailure);
		} catch (error) {
			logFailure(error);
		}
	}

	/**
	 * Recursively searches for the parent epic of a given task (issue) using a SQL recursive query.
	 *
	 * @param issueId The ID of the task (issue) to start the search from.
	 * @returns A Promise that resolves to the epic task if found, otherwise null.
	 */
	async findParentUntilEpic(issueId: ID): Promise<Task | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmRepository.getKnex();
				const result = await knex.raw(
					p(`
					WITH RECURSIVE IssueHierarchy AS (
						SELECT *
						FROM task
						WHERE id = ?
					UNION ALL
						SELECT i.*
						FROM task i
						INNER JOIN IssueHierarchy ih ON i.id = ih."parentId"
					)
					SELECT *
					FROM IssueHierarchy
					WHERE "issueType" = 'Epic'
					LIMIT 1;
				`),
					[issueId]
				);
				const items = result.rows || result;
				return items.length > 0 ? items[0] : null;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// TypeORM's `query()` hands the parameters straight to the driver, so the placeholder
				// syntax is dialect-specific: PostgreSQL uses `$1`, while SQLite/better-sqlite3 and
				// MySQL use `?`. `$1` on better-sqlite3 is parsed as a *named* parameter, so binding
				// a positional array throws "RangeError: Too many parameter values were provided"
				// and every `GET /tasks/:id?includeRootEpic=true` fails on SQLite (demo) instances.
				const idPlaceholder = isPostgres() ? '$1' : '?';

				// Define the recursive SQL query to find the parent epic
				const query = p(`
					WITH RECURSIVE IssueHierarchy AS (
						SELECT *
						FROM task
						WHERE id = ${idPlaceholder}
					UNION ALL
						SELECT i.*
						FROM task i
						INNER JOIN IssueHierarchy ih ON i.id = ih."parentId"
					)
					SELECT *
					FROM IssueHierarchy
					WHERE "issueType" = 'Epic'
					LIMIT 1;
				`);

				// Execute the raw SQL query with the issueId parameter
				const result = await this.typeOrmRepository.query(query, [issueId]);

				// Return the first epic task found or null if no epic is found
				return result.length > 0 ? result[0] : null;
			}
		}
	}

	/**
	 * GET my tasks
	 *
	 * @param options
	 * @returns
	 */
	async getMyTasks(options: BaseQueryDTO<Task>) {
		return await this.getEmployeeTasks(options);
	}

	/**
	 * Case-insensitive "contains" filters on task title / prefix for the MikroORM task list queries
	 * (`$ilike` is PostgreSQL-only, see `mikroOrmContains`).
	 */
	private mikroOrmTitlePrefixFilters(title?: string, prefix?: string): Record<string, unknown> {
		return {
			...(isNotEmpty(title) ? { title: mikroOrmContains(title) } : {}),
			...(isNotEmpty(prefix) ? { prefix: mikroOrmContains(prefix) } : {})
		};
	}

	/**
	 * Resolves the employee whose tasks a member-filtered list returns, or null for no member filter.
	 *
	 * A CHANGE_SELECTED_EMPLOYEE holder gets the `members.id` they asked for. Anyone else keeps their own
	 * tasks, unless they ask for a member they manage in a team of the requested organization.
	 *
	 * @param where - The list query's where clause, as the client sent it
	 * @returns The employee to filter the tasks by, or null
	 */
	private async resolveMemberFilter(where: FindOptionsWhere<Task>): Promise<ID | null> {
		const { members, organizationId } = where;
		const requestedId = isNotEmpty(members) && isNotEmpty(members['id']) ? members['id'] : null;

		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return requestedId;
		}

		// A repeated or nested query value is not an id: it is never looked up and the caller keeps their own tasks
		const canManageRequested =
			typeof requestedId === 'string' &&
			isUUID(requestedId) &&
			typeof organizationId === 'string' &&
			(await this._managedEmployeeService.canManageEmployee(requestedId, undefined, organizationId));

		return canManageRequested ? requestedId : RequestContext.currentEmployeeId();
	}

	/**
	 * Find employee tasks
	 *
	 * @param options - Pagination options including limit, page, and sorting.
	 * @param filters - Optional filters for advanced task filtering.
	 * @returns
	 */
	async getEmployeeTasks(options: BaseQueryDTO<Task> & IAdvancedTaskFiltering) {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(options);

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { where, filters } = options;
					const {
						status,
						title,
						prefix,
						isDraft,
						isScreeningTask = false,
						organizationSprintId = null
					} = where;
					const { organizationId, projectId } = where;
					const tenantId = RequestContext.currentTenantId();

					const mikroWhere: any = { tenantId, organizationId, isScreeningTask };
					if (isNotEmpty(projectId)) mikroWhere.projectId = projectId;
					if (isNotEmpty(status)) mikroWhere.status = status;
					if (isNotEmpty(isDraft)) mikroWhere.isDraft = isDraft;
					Object.assign(mikroWhere, this.mikroOrmTitlePrefixFilters(title as string, prefix as string));
					if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
						mikroWhere.organizationSprintId = null;
					}
					// The column filters of the advanced filters; the relation ones are TypeORM-only here.
					if (filters) {
						Object.assign(mikroWhere, this.mikroOrmColumnFilters(filters, mikroWhere));
					}

					const employeeId = await this.resolveMemberFilter(where);

					if (isNotEmpty(employeeId)) {
						mikroWhere.$or = [{ members: { id: employeeId } }, { teams: { members: { employeeId } } }];
					}

					const [items, total] = await this.mikroOrmRepository.findAndCount(mikroWhere, {
						...(options.relations ? { populate: Object.keys(options.relations) as any[] } : {}),
						...('skip' in options
							? {
									offset: (options.take || 10) * (options.skip - 1),
									limit: options.take || 10
							  }
							: {})
					});
					return { items: items.map((e) => this.serialize(e)) as Task[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					const { where, filters } = options;
					const {
						status,
						title,
						prefix,
						isDraft,
						isScreeningTask = false,
						organizationSprintId = null
					} = where;
					const { organizationId, projectId } = where;
					const employeeId = await this.resolveMemberFilter(where);

					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					query.innerJoin(`${query.alias}.members`, 'members');
					/**
					 * If find options
					 */
					if (isNotEmpty(options)) {
						if ('skip' in options) {
							query.setFindOptions({
								skip: (options.take || 10) * (options.skip - 1),
								take: options.take || 10
							});
						}
						query.setFindOptions({
							...(options.relations ? { relations: parseFindOptionsRelations(options.relations) } : {})
						});
					}

					// Apply advanced filters
					if (filters) {
						const advancedWhere = this.buildAdvancedWhereCondition(filters, where);
						query.setFindOptions({ where: advancedWhere });
					}

					query.andWhere((qb: SelectQueryBuilder<Task>) => {
						const subQuery = qb.subQuery();
						subQuery.select(p('"task_employee"."taskId"')).from(p('task_employee'), p('task_employee'));

						if (isNotEmpty(employeeId)) {
							subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });
						}
						return p('"task_members"."taskId" IN ') + subQuery.distinct(true).getQuery();
					});
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							const tenantId = RequestContext.currentTenantId();
							qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						})
					);
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (isNotEmpty(projectId)) {
								qb.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
							}
							if (isNotEmpty(status)) {
								qb.andWhere(p(`"${query.alias}"."status" = :status`), {
									status
								});
							}
							if (isNotEmpty(isDraft)) {
								qb.andWhere(p(`"${query.alias}"."isDraft" = :isDraft`), {
									isDraft
								});
							}
							if (isNotEmpty(title)) {
								qb.andWhere(p(`"${query.alias}"."title" ${LIKE_OPERATOR} :title`), {
									title: `%${title}%`
								});
							}
							if (isNotEmpty(prefix)) {
								qb.andWhere(p(`"${query.alias}"."prefix" ${LIKE_OPERATOR} :prefix`), {
									prefix: `%${prefix}%`
								});
							}
							if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
								qb.andWhere(p(`"${query.alias}"."organizationSprintId" IS NULL`));
							}

							qb.andWhere(p(`"${query.alias}"."isScreeningTask" = :isScreeningTask`), {
								isScreeningTask
							});
						})
					);

					console.log('query.getSql', query.getSql());
					const [items, total] = await query.getManyAndCount();
					return { items, total };
				}
			}
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET all tasks by employee
	 *
	 * @param employeeId - The employee ID for whom retrieve tasks
	 * @param options - Pagination options including limit, page, and sorting.
	 * @param filters - Optional filters for advanced task filtering.
	 * @returns
	 */
	async getAllTasksByEmployee(employeeId: IEmployee['id'], options: BaseQueryDTO<Task> & IAdvancedTaskFiltering) {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(options);
		assertCallerColumnsAllowed(this.typeOrmRepository?.metadata, options);

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { isScreeningTask = false } = options.where;
					const tenantId = RequestContext.currentTenantId();

					// MikroORM: Use members relation filter (simplified vs TypeORM subquery approach)
					const mikroWhere: any = {
						tenantId,
						isScreeningTask,
						$or: [{ members: { id: employeeId } }, { teams: { members: { employeeId } } }]
					};

					if (isNotEmpty(options.where)) {
						Object.assign(mikroWhere, options.where);
					}

					const items = await this.mikroOrmRepository.find(mikroWhere, {
						...(options.relations ? { populate: Object.keys(options.relations) as any[] } : {})
					});
					return items.map((e) => this.serialize(e)) as Task[];
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					query.leftJoin(`${query.alias}.members`, 'members');
					query.leftJoin(`${query.alias}.teams`, 'teams');
					const { isScreeningTask = false } = options.where;
					const { filters } = options;

					// Apply advanced filters
					if (filters) {
						const advancedWhere = this.buildAdvancedWhereCondition(filters, options.where);
						query.setFindOptions({ where: advancedWhere });
					}

					/**
					 * If additional options found
					 */
					query.setFindOptions({
						...(isNotEmpty(options) &&
							isNotEmpty(options.where) && {
								where: options.where
							}),
						...(isNotEmpty(options) &&
							isNotEmpty(options.relations) && {
								relations: parseFindOptionsRelations(options.relations)
							})
					});

					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							const tenantId = RequestContext.currentTenantId();
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), {
								tenantId
							});
						})
					);
					query.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.andWhere((qb: SelectQueryBuilder<Task>) => {
								const subQuery = qb.subQuery();
								subQuery
									.select(p('"task_employee"."taskId"'))
									.from(p('task_employee'), p('task_employee'));
								subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });
								return p(`"task_members"."taskId" IN (${subQuery.distinct(true).getQuery()})`);
							});
							web.orWhere((qb: SelectQueryBuilder<Task>) => {
								const subQuery = qb.subQuery();
								subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
								subQuery.leftJoin(
									'organization_team_employee',
									'organization_team_employee',
									p(
										'"organization_team_employee"."organizationTeamId" = "task_team"."organizationTeamId"'
									)
								);
								subQuery.andWhere(p('"organization_team_employee"."employeeId" = :employeeId'), {
									employeeId
								});
								return p(`"task_teams"."taskId" IN (${subQuery.distinct(true).getQuery()})`);
							});
						})
					);

					query.andWhere(p(`"${query.alias}"."isScreeningTask" = :isScreeningTask`), {
						isScreeningTask
					});

					return await query.getMany();
				}
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET team tasks
	 *
	 * @param options - Pagination options including limit, page, and sorting.
	 * @param filters - Optional filters for advanced task filtering.
	 * @returns
	 */
	async findTeamTasks(options: BaseQueryDTO<Task> & IAdvancedTaskFiltering): Promise<IPagination<ITask>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(options);
		assertCallerColumnsAllowed(this.typeOrmRepository?.metadata, options);

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { where, filters } = options;
					const {
						status,
						teams = [],
						title,
						prefix,
						isDraft,
						isScreeningTask = false,
						organizationSprintId = null
					} = where;
					const { organizationId, projectId, members } = where;
					const tenantId = RequestContext.currentTenantId();

					const mikroWhere: any = { tenantId, organizationId, isScreeningTask };
					if (isNotEmpty(projectId) && isEmpty(teams)) mikroWhere.projectId = projectId;
					if (isNotEmpty(status)) mikroWhere.status = status;
					if (isNotEmpty(isDraft)) mikroWhere.isDraft = isDraft;
					Object.assign(mikroWhere, this.mikroOrmTitlePrefixFilters(title as string, prefix as string));
					if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
						mikroWhere.organizationSprintId = null;
					}
					if (isNotEmpty(teams)) {
						mikroWhere.teams = { id: { $in: teams as ID[] } };
					}
					// Same rule as the TypeORM branch: only a CHANGE_SELECTED_EMPLOYEE holder may pick the
					// employee; everyone else is limited to the teams they are a member of.
					const canChangeEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
					let employeeId: ID | null = RequestContext.currentEmployeeId();
					if (canChangeEmployee) {
						employeeId = isNotEmpty(members) && isNotEmpty(members['id']) ? members['id'] : null;
					}
					// A caller who may not act for other employees and has no employee record belongs to no
					// team: without this, the missing filter listed every team task of the organization. An
					// organization-wide viewer keeps the access their role gives them (same carve-out as
					// ManagedEmployeeService.filterAccessibleEmployeeIds, #10249).
					if (
						!canChangeEmployee &&
						!isNotEmpty(employeeId) &&
						!RequestContext.hasPermission(PermissionsEnum.ALL_ORG_VIEW)
					) {
						return { items: [], total: 0 };
					}
					if (isNotEmpty(employeeId)) {
						mikroWhere.teams = { ...mikroWhere.teams, members: { employeeId } };
					}

					// The advanced filters (projects, tags, statuses, members, ...) were only applied by the
					// TypeORM branch; here they were read and dropped. Build the same TypeORM where and
					// translate it, merging the `teams` predicate with the team scoping above.
					if (filters) {
						const { where: advancedWhere } = parseTypeORMFindToMikroOrm<Task>({
							where: this.buildAdvancedWhereCondition(filters, where)
						});
						const { teams: advancedTeams, ...advancedRest } = advancedWhere as any;
						Object.assign(mikroWhere, advancedRest);
						if (advancedTeams) {
							mikroWhere.teams = { ...mikroWhere.teams, ...advancedTeams };
						}
					}

					// With a project and teams, the project's tasks are listed alongside the team's, as in the TypeORM
					// branch. Every other condition stays at the top level, so it applies to both.
					if (isNotEmpty(projectId) && isNotEmpty(teams)) {
						mikroWhere.$or = [{ teams: mikroWhere.teams }, { projectId }];
						delete mikroWhere.teams;
					}

					const [items, total] = await this.mikroOrmRepository.findAndCount(mikroWhere, {
						...(options.relations ? { populate: Object.keys(options.relations) as any[] } : {}),
						...(options.order ? { orderBy: options.order as any } : {}),
						...('skip' in options
							? {
									offset: (options.take || 10) * (options.skip - 1),
									limit: options.take || 10
							  }
							: {})
					});
					return { items: items.map((e) => this.serialize(e)) as ITask[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					const { where, filters } = options;

					const {
						status,
						teams = [],
						title,
						prefix,
						isDraft,
						isScreeningTask = false,
						organizationSprintId = null
					} = where;
					const { organizationId, projectId, members } = where;

					// See the MikroORM branch: no employee record and no CHANGE_SELECTED_EMPLOYEE means no team,
					// unless the caller is an organization-wide viewer
					if (
						!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) &&
						!isNotEmpty(RequestContext.currentEmployeeId()) &&
						!RequestContext.hasPermission(PermissionsEnum.ALL_ORG_VIEW)
					) {
						return { items: [], total: 0 };
					}

					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					query.leftJoin(`${query.alias}.teams`, 'teams');

					/**
					 * If find options
					 */
					if (isNotEmpty(options)) {
						if ('skip' in options) {
							query.setFindOptions({
								skip: (options.take || 10) * (options.skip - 1),
								take: options.take || 10
							});
						}
						query.setFindOptions({
							...(options.select ? { select: parseFindOptionsSelect(options.select) } : {}),
							...(options.relations ? { relations: parseFindOptionsRelations(options.relations) } : {}),
							...(options.order ? { order: options.order } : {})
						});
					}

					// Apply advanced filters
					if (filters) {
						const advancedWhere = this.buildAdvancedWhereCondition(filters, options.where);
						query.setFindOptions({ where: advancedWhere });
					}

					const teamTasksCondition = (qb: SelectQueryBuilder<Task>) => {
						const subQuery = qb.subQuery();
						subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
						subQuery.leftJoin(
							'organization_team_employee',
							'organization_team_employee',
							p('"organization_team_employee"."organizationTeamId" = "task_team"."organizationTeamId"')
						);
						// If user have permission to change employee
						if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
							if (isNotEmpty(members) && isNotEmpty(members['id'])) {
								const employeeId = members['id'];
								subQuery.andWhere(p('"organization_team_employee"."employeeId" = :employeeId'), {
									employeeId
								});
							}
						} else {
							// If employee has login and don't have permission to change employee
							const employeeId = RequestContext.currentEmployeeId();
							if (isNotEmpty(employeeId)) {
								subQuery.andWhere(p('"organization_team_employee"."employeeId" = :employeeId'), {
									employeeId
								});
							}
						}
						if (isNotEmpty(teams)) {
							subQuery.andWhere(p(`"${subQuery.alias}"."organizationTeamId" IN (:...teams)`), {
								teams
							});
						}
						return p(`"task_teams"."taskId" IN `) + subQuery.distinct(true).getQuery();
					};
					// With a project and teams, the project's tasks are listed alongside the team's. Keeping both
					// in one bracket makes the tenant and filter conditions below apply to each.
					query.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.andWhere(teamTasksCondition);
							if (isNotEmpty(projectId) && isNotEmpty(teams)) {
								web.orWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
							}
						})
					);
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							const tenantId = RequestContext.currentTenantId();
							qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						})
					);
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (isNotEmpty(projectId) && isEmpty(teams)) {
								qb.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
							}
							if (isNotEmpty(status)) {
								qb.andWhere(p(`"${query.alias}"."status" = :status`), {
									status
								});
							}
							if (isNotEmpty(isDraft)) {
								qb.andWhere(p(`"${query.alias}"."isDraft" = :isDraft`), {
									isDraft
								});
							}
							if (isNotEmpty(title)) {
								qb.andWhere(p(`"${query.alias}"."title" ${LIKE_OPERATOR} :title`), {
									title: `%${title}%`
								});
							}
							if (isNotEmpty(prefix)) {
								qb.andWhere(p(`"${query.alias}"."prefix" ${LIKE_OPERATOR} :prefix`), {
									prefix: `%${prefix}%`
								});
							}
							if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
								qb.andWhere(p(`"${query.alias}"."organizationSprintId" IS NULL`));
							}

							qb.andWhere(p(`"${query.alias}"."isScreeningTask" = :isScreeningTask`), {
								isScreeningTask
							});
						})
					);
					const [items, total] = await query.getManyAndCount();
					return { items, total };
				}
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET tasks by pagination with filtering options.
	 *
	 * @param options The pagination and filtering parameters.
	 * @param filters - Optional filters for advanced task filtering.
	 * @returns A Promise that resolves to a paginated list of tasks.
	 */
	public async pagination(options: BaseQueryDTO<Task> & IAdvancedTaskFiltering): Promise<IPagination<ITask>> {
		const filters = options?.filters;
		const where = options?.where;

		// Check if there are any filters in the options
		if (where) {
			const { isScreeningTask = false } = where;

			// Apply filters for task title with like operator
			if (where.title) {
				options.where.title = Raw((alias) => `${alias} ${LIKE_OPERATOR} :title`, { title: `%${where.title}%` });
			}

			// Apply filters for task prefix with like operator
			if (where.prefix) {
				options.where.prefix = Raw((alias) => `${alias} ${LIKE_OPERATOR} :prefix`, {
					prefix: `%${where.prefix}%`
				});
			}

			// Apply filters for isDraft, setting null if not a boolean. The query DTO only converts "true" /
			// "false", so keep accepting the "1" / "0" encodings API clients may send.
			const isDraft: unknown = where.isDraft; // typed as boolean, but the wire value may be '1' / '0'
			if (isDraft === '1' || isDraft === '0') {
				options.where.isDraft = isDraft === '1';
			} else if (isDraft !== undefined && !isBoolean(isDraft)) {
				options.where.isDraft = IsNull();
			}

			// Apply filters for organizationSprintId, setting null if not a valid UUID
			if (where.organizationSprintId && !isUUID(where.organizationSprintId)) {
				options.where.organizationSprintId = IsNull();
			}

			// Apply filters for teams, ensuring it uses In for array comparison
			if (where.teams) {
				options.where.teams = {
					id: In(where.teams as ID[])
				};
			}

			// Apply filter for isScreeningTask
			where.isScreeningTask = isScreeningTask;
		}

		// Apply Advanced filters
		let advancedFilters: FindOptionsWhere<Task> = {};
		if (filters) {
			advancedFilters = this.buildAdvancedWhereCondition(filters, where);
		}

		// Call the base paginate method
		return await super.paginate({ ...options, where: { ...advancedFilters, ...where } });
	}

	/**
	 * The project a task moves to, read in the caller's tenant and the task's organization: whether it is one
	 * of that organization's projects, and its task-number prefix by the rule the create path uses (the first
	 * three characters of its name, or `null` for a project without a name). Without a tenant or an
	 * organization to read it in, the answer is "not one of them"; a failed read is thrown, so the update fails
	 * rather than moving the task to a project nobody checked.
	 *
	 * @param projectId The project the task moves to.
	 * @param tenantId The caller's tenant.
	 * @param organizationId The task's organization (after the update).
	 */
	private async findDestinationProject(
		projectId: ID,
		tenantId: ID,
		organizationId: ID
	): Promise<{ exists: boolean; prefix?: string | null; billable?: boolean | null }> {
		if (!tenantId || !organizationId) {
			return { exists: false };
		}
		const project = await this.typeOrmRepository.manager.findOne(OrganizationProject, {
			where: { id: projectId, tenantId, organizationId },
			select: { id: true, name: true, billable: true }
		});
		if (!project) {
			return { exists: false };
		}
		return { exists: true, prefix: project.name?.slice(0, 3) || null, billable: project.billable };
	}

	/**
	 * Moves the task's time logs to the task's project, so the time tracked on a task is counted where the task is.
	 * Moving a log changes recorded time, so it follows the rules of `PUT /timesheet/time-log/:id`: the caller holds
	 * ALLOW_MODIFY_TIME, the organization allows modifying time, and only the logs of employees the caller may act for
	 * move. A log of an approved or billed timesheet stays where it is: its hours were already signed off or invoiced
	 * under its project, and the write itself re-checks that so an approval read after the logs cannot be overridden.
	 * A moved log takes the billable setting of a project that has one.
	 *
	 * Best-effort, like the other steps after the save: a failure is logged and leaves the logs where they were,
	 * it never fails an update that already succeeded.
	 *
	 * @param taskId The task whose time logs move.
	 * @param projectId The task's project after the update, or `null` when the update removed it.
	 * @param organizationId The task's organization.
	 * @param tenantId The caller's tenant.
	 */
	private async moveTimeLogsToProject(
		taskId: ID,
		projectId: ID | null,
		organizationId: ID,
		tenantId: ID
	): Promise<void> {
		try {
			const mayModifyTime = await this.mayModifyTimeIn(organizationId, tenantId);
			if (!mayModifyTime) {
				return;
			}

			const changes: Partial<TimeLog> = { projectId };
			if (projectId) {
				const destination = await this.findDestinationProject(projectId, tenantId, organizationId);
				if (isBoolean(destination.billable)) {
					changes.isBillable = destination.billable;
				}
			}

			const timeLogs = await this.typeOrmRepository.manager.find(TimeLog, {
				where: { taskId, tenantId, organizationId },
				relations: { timesheet: true },
				select: {
					id: true,
					employeeId: true,
					projectId: true,
					timesheet: { id: true, status: true, isBilled: true }
				}
			});
			const movableLogs = timeLogs.filter((timeLog) => isMovableToProject(timeLog, projectId));
			const writableLogs = await this.logsTheCallerMayModify(movableLogs, organizationId);
			const writableIds = writableLogs.map((timeLog) => timeLog.id);
			if (writableIds.length === 0) {
				return;
			}

			// A concurrent move of the same task can save another project after this one: the write only lands while
			// the task is still in the project these logs move to, so the last move saved decides where they are. The
			// task row and the logs' timesheets stay locked until the write commits, so a project saved or a timesheet
			// approved meanwhile waits for it instead of landing between the checks and the write
			const timesheetIds = timesheetIdsOf(writableLogs);
			let taskStillThere = p(`"taskId" IN (SELECT "id" FROM "task" WHERE "projectId" IS NULL)`);
			if (projectId) {
				taskStillThere = p(`"taskId" IN (SELECT "id" FROM "task" WHERE "projectId" = :destinationProjectId)`);
			}

			await this.typeOrmRepository.manager.transaction(async (manager) => {
				// `pessimistic_write` maps to FOR UPDATE on both dialects; the embedded one serializes writers
				const locksRows = isPostgres() || isMySQL();
				if (locksRows) {
					const taskRow = manager.createQueryBuilder(Task, 'task').select('task.id').where({ id: taskId });
					await taskRow.setLock('pessimistic_write').getOne();
				}
				const locksTimesheets = locksRows && timesheetIds.length > 0;
				if (locksTimesheets) {
					const timesheetRows = manager
						.createQueryBuilder(Timesheet, 'timesheet')
						.select('timesheet.id')
						.where({ id: In(timesheetIds) });
					await timesheetRows.setLock('pessimistic_write').getMany();
				}

				await manager
					.createQueryBuilder()
					.update(TimeLog)
					.set(changes)
					.where({ id: In(writableIds), tenantId, organizationId, taskId })
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.where(p(`"timesheetId" IS NULL`));
							qb.orWhere(
								p(
									`"timesheetId" IN (SELECT "id" FROM "timesheet" WHERE "status" <> :approved AND "isBilled" = :billed)`
								),
								{ approved: TimesheetStatus.APPROVED, billed: false }
							);
						})
					)
					.andWhere(taskStillThere, { destinationProjectId: projectId })
					.execute();
			});
		} catch (error) {
			console.error('Error moving the task time logs to its project:', error);
		}
	}

	/**
	 * Whether the caller may modify recorded time in the organization: the ALLOW_MODIFY_TIME permission and the
	 * organization's `allowModifyTime` policy, as `OrganizationPermissionGuard` requires for a time log edit.
	 *
	 * @param organizationId The organization of the task.
	 * @param tenantId The caller's tenant.
	 */
	private async mayModifyTimeIn(organizationId: ID, tenantId: ID): Promise<boolean> {
		const hasPermission = RequestContext.hasPermission(PermissionsEnum.ALLOW_MODIFY_TIME);
		if (!hasPermission) {
			return false;
		}
		const organization = await this.typeOrmRepository.manager.findOne(Organization, {
			where: { id: organizationId, tenantId },
			select: { id: true, allowModifyTime: true }
		});
		return organization?.allowModifyTime === true;
	}

	/**
	 * The logs whose employee the caller may act for: their own, the members of a team they manage, or anyone with
	 * CHANGE_SELECTED_EMPLOYEE, as for a time log edit.
	 *
	 * @param timeLogs The logs that would move.
	 * @param organizationId The organization of the task.
	 */
	private async logsTheCallerMayModify(timeLogs: ITimeLog[], organizationId: ID): Promise<ITimeLog[]> {
		const employeeIds = [...new Set(timeLogs.map((timeLog) => timeLog.employeeId))];
		const allowed = new Set<ID>();
		for (const employeeId of employeeIds) {
			const mayActFor = await this._managedEmployeeService.canManageEmployee(
				employeeId,
				undefined,
				organizationId
			);
			if (mayActFor) {
				allowed.add(employeeId);
			}
		}
		return timeLogs.filter((timeLog) => allowed.has(timeLog.employeeId));
	}

	/**
	 * GET maximum task number by project filter
	 *
	 * @param options The filtering options including tenant, organization, and project details.
	 * @param withDeleted Also count soft-deleted tasks: they keep their number in the `taskNumber` unique
	 * index, so a caller that stores `max + 1` needs it. The max-number read routes leave it off.
	 * @returns A Promise that resolves to the maximum task number for the given project.
	 */
	public async getMaxTaskNumberByProject(
		options: IGetTaskOptions,
		{ withDeleted = false }: { withDeleted?: boolean } = {}
	): Promise<number> {
		const maxTaskNumber = await this.getMaxNumberOfProjectTasks(options, { withDeleted });
		if (!withDeleted) {
			return maxTaskNumber;
		}
		// A caller that stores `max + 1` also skips the numbers tasks held before they moved out of the project: those
		// references keep resolving to the moved tasks, so they are never handed to another task.
		const maxFormerNumber = await this.getMaxFormerReferenceNumber(options);
		return Math.max(maxTaskNumber, maxFormerNumber);
	}

	/**
	 * The highest number a task held in the project before it moved out (`task_former_reference`), 0 for none. Best
	 * effort: a failed read is logged and counts as none, so it never stops a task from being created; the number it
	 * hands out may then reach a moved task's old reference, which keeps resolving to the live task instead.
	 */
	private async getMaxFormerReferenceNumber(options: IGetTaskOptions): Promise<number> {
		const { organizationId, projectId } = options;
		if (!isNotEmpty(projectId)) {
			return 0;
		}
		try {
			const tenantId = RequestContext.currentTenantId() || options.tenantId;
			const query = this.typeOrmRepository.manager
				.createQueryBuilder(TaskFormerReference, 'former')
				.select(p(`COALESCE(MAX("former"."number"), 0)`), 'maxNumber')
				.where(p(`"former"."tenantId" = :tenantId`), { tenantId })
				.andWhere(p(`"former"."organizationId" = :organizationId`), { organizationId })
				.andWhere(p(`"former"."projectId" = :projectId`), { projectId })
				.withDeleted();
			const result = await query.getRawOne();
			return Number(result?.maxNumber) || 0;
		} catch (error) {
			console.error('Error reading the former task numbers of the project:', error?.message);
			return 0;
		}
	}

	/** The highest number of the project's tasks (see getMaxTaskNumberByProject). */
	private async getMaxNumberOfProjectTasks(
		options: IGetTaskOptions,
		{ withDeleted = false }: { withDeleted?: boolean } = {}
	): Promise<number> {
		try {
			// Extract tenantId from context or options
			const tenantId = RequestContext.currentTenantId() || options.tenantId;
			const { organizationId, projectId } = options;

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const mikroWhere: any = { tenantId, organizationId };
					if (isNotEmpty(projectId)) {
						mikroWhere.projectId = projectId;
					} else {
						mikroWhere.projectId = null;
					}
					if (withDeleted) {
						// Soft-deleted rows may predate task numbers, and PostgreSQL sorts NULL first in DESC
						mikroWhere.number = { $ne: null };
					}

					const items = await this.mikroOrmRepository.find(mikroWhere, {
						orderBy: { number: 'DESC' as any },
						limit: 1,
						fields: ['number'] as any[],
						...(withDeleted ? { filters: { [SOFT_DELETABLE_FILTER]: false } } : {})
					});
					const maxTaskNumber = items.length > 0 ? (items[0] as any).number || 0 : 0;
					console.log('get max task number (MikroORM)', maxTaskNumber);
					return maxTaskNumber;
				}
				case MultiORMEnum.TypeORM:
				default: {
					// Create a query builder for the Task entity
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

					// Build the query to get the maximum task number
					query.select(p(`COALESCE(MAX("${query.alias}"."number"), 0)`), 'maxTaskNumber');

					// Apply filters for organization and tenant
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						})
					);

					// Apply project filter if provided, otherwise check for null
					if (isNotEmpty(projectId)) {
						query.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
					} else {
						query.andWhere(p(`"${query.alias}"."projectId" IS NULL`));
					}

					if (withDeleted) {
						query.withDeleted();
					}

					// Execute the query and parse the result to a number
					const result = await query.getRawOne();
					const maxTaskNumber = parseInt(result.maxTaskNumber, 10);
					console.log('get max task number', maxTaskNumber);

					return maxTaskNumber;
				}
			}
		} catch (error) {
			// Log the error and throw a detailed exception
			console.log(`Error fetching max task number: ${error.message}`, error.stack);
			throw new HttpException({ message: 'Failed to get the max task number', error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * One task of the caller's tenant and organization, by its human key: the project prefix and the number.
	 *
	 * The key is what a person reads off a board or types into a link (`FUL-12`), and the create handler is
	 * what writes it: the prefix is the first three characters of the project's name and the number is one
	 * above that project's highest. So the number is unique within a project, but the prefix is not unique
	 * across projects — "Gauzy" and "Gauzy Teams" both file under `Gau`. A caller that states the project
	 * reads exactly one row; a caller that does not and hits two is refused rather than handed whichever
	 * row the store returned first, because a node read that silently picks one is a wrong answer with no
	 * way to tell it is one.
	 *
	 * The tenant is the credential's and the organization is the one the caller names (the REST twin
	 * validates it against the caller's memberships, the GraphQL field reads it from the credential), so the
	 * read can never reach another organization's board.
	 *
	 * @param options The tenant and organization, the prefix and number, and optionally the project.
	 * @returns The task.
	 * @throws NotFoundException when no task carries that key in the caller's scope.
	 * @throws BadRequestException when the prefix and number name more than one task and no project was stated.
	 */
	public async findByNumber(options: {
		tenantId?: ID;
		organizationId?: ID;
		prefix: string;
		number: number;
		projectId?: ID | null;
	}): Promise<Task> {
		const tenantId = RequestContext.currentTenantId() || options.tenantId;
		const { organizationId, prefix, number, projectId } = options;

		// Both scope members are required: an absent one would drop out of the criterion and widen the read
		// to every organization of the tenant, or to every tenant.
		if (!tenantId || !organizationId) {
			throw new BadRequestException('TASK_SCOPE_REQUIRED: a task is read by its number within one organization.');
		}

		const where: FindOptionsWhere<Task> = {
			tenantId,
			organizationId,
			prefix,
			number,
			...(isNotEmpty(projectId) ? { projectId } : {})
		} as FindOptionsWhere<Task>;

		// Two rows are enough to tell "one" from "more than one"; reading the rest would only cost.
		const rows = await this.find({ where, take: 2 } as never);

		if (rows.length === 0) {
			throw new NotFoundException(`TASK_NOT_FOUND: no task ${prefix}-${number} in this organization.`);
		}

		if (rows.length > 1) {
			throw new BadRequestException(
				`TASK_NUMBER_AMBIGUOUS: more than one project files tasks under ${prefix}-${number}; state the project.`
			);
		}

		return rows[0];
	}

	/**
	 * Unassign employee from team task
	 * @param employeeId
	 * @param organizationTeamId
	 */
	public async unassignEmployeeFromTeamTasks(employeeId: string, organizationTeamId?: string) {
		try {
			const tenantId = RequestContext.currentTenantId();

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					// MikroORM: Use simplified relation-based filtering
					const mikroWhere: any = {
						tenantId,
						$or: [{ members: { id: employeeId } }, { teams: { members: { employeeId } } }]
					};

					if (organizationTeamId) {
						mikroWhere.teams = { id: organizationTeamId };
					}

					const tasks = await this.mikroOrmRepository.find(mikroWhere, {
						populate: ['teams', 'members'] as any[]
					});

					const serializedTasks = tasks.map((e) => this.serialize(e)) as Task[];

					serializedTasks.forEach((task) => {
						if (task.teams?.length) {
							task.members = task.members.filter((member) => member.id !== employeeId);
						}
					});

					await this.saveMany(serializedTasks);
					break;
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

					// Use unique alias to avoid conflict with 'teams' used later
					if (organizationTeamId) {
						query.leftJoinAndSelect(
							`${query.alias}.teams`,
							'teamFilter',
							'teamFilter.id = :organizationTeamId',
							{
								organizationTeamId
							}
						);
					} else {
						query.leftJoinAndSelect(`${query.alias}.teams`, 'teamFilter');
					}

					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						})
					);

					query.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.andWhere((qb: SelectQueryBuilder<Task>) => {
								const subQuery = qb.subQuery();
								subQuery
									.select(p('"task_employee"."taskId"'))
									.from(p('task_employee'), p('task_employee'));
								subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });
								return p(`"${query.alias}"."id" IN (${subQuery.distinct(true).getQuery()})`);
							});
							web.orWhere((qb: SelectQueryBuilder<Task>) => {
								const subQuery = qb.subQuery();
								subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
								subQuery.leftJoin(
									'organization_team_employee',
									'organization_team_employee',
									p(
										'"organization_team_employee"."organizationTeamId" = "task_team"."organizationTeamId" AND "organization_team_employee"."deletedAt" IS NULL'
									)
								);
								subQuery.andWhere(p('"organization_team_employee"."employeeId" = :employeeId'), {
									employeeId
								});
								return p(`"${query.alias}"."id" IN (${subQuery.distinct(true).getQuery()})`);
							});
						})
					);

					// If unassigned for specific team
					if (organizationTeamId) {
						query.andWhere((qb: SelectQueryBuilder<Task>) => {
							const subQuery = qb.subQuery();
							subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
							subQuery.andWhere(p('"task_team"."organizationTeamId" = :organizationTeamId'), {
								organizationTeamId
							});
							return p(`"${query.alias}"."id" IN (${subQuery.distinct(true).getQuery()})`);
						});
					}

					// Find all assigned tasks of employee with relations
					// Use different aliases to avoid conflicts
					const tasks = await query
						.leftJoinAndSelect(`${query.alias}.members`, 'taskMembers')
						.leftJoinAndSelect(`${query.alias}.teams`, 'taskTeams')
						.getMany();

					// Unassign member from All the Team Tasks
					tasks.forEach((task) => {
						if (task.teams?.length) {
							task.members = task.members.filter((member) => member.id !== employeeId);
						}
					});

					// TODO : Unsubscribe employee from task

					// Save updated entities to DB
					await this.saveMany(tasks);
					break;
				}
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieves module tasks based on the provided options.
	 *
	 * @param options - The pagination options and filters for querying tasks.
	 * @param filters - Optional filters for advanced task filtering.
	 * @returns A promise that resolves with pagination task items and total count.
	 */
	async findModuleTasks(options: BaseQueryDTO<Task> & IAdvancedTaskFiltering): Promise<IPagination<ITask>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(options);
		assertCallerColumnsAllowed(this.typeOrmRepository?.metadata, options);

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { where, filters } = options;
					const {
						status,
						modules = [],
						title,
						prefix,
						isDraft,
						isScreeningTask = false,
						organizationSprintId = null,
						organizationId,
						projectId
					} = where;
					const tenantId = RequestContext.currentTenantId() ?? where.tenantId;

					const mikroWhere: any = { tenantId, organizationId, isScreeningTask };
					if (isNotEmpty(projectId) && isEmpty(modules)) mikroWhere.projectId = projectId;
					if (isNotEmpty(status)) mikroWhere.status = status;
					if (isNotEmpty(isDraft)) mikroWhere.isDraft = isDraft;
					Object.assign(mikroWhere, this.mikroOrmTitlePrefixFilters(title as string, prefix as string));
					if (isUUID(organizationSprintId)) {
						mikroWhere.organizationSprintId = organizationSprintId;
					}
					if (isNotEmpty(modules)) {
						mikroWhere.modules = { id: { $in: modules as ID[] } };
					}

					const [items, total] = await this.mikroOrmRepository.findAndCount(mikroWhere, {
						...(options.relations ? { populate: Object.keys(options.relations) as any[] } : {}),
						...(options.order ? { orderBy: options.order as any } : {})
					});
					return { items: items.map((e) => this.serialize(e)) as ITask[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					const { where, filters } = options;
					const {
						status,
						modules = [],
						title,
						prefix,
						isDraft,
						isScreeningTask = false,
						organizationSprintId = null,
						organizationId,
						projectId,
						members
					} = where;
					const tenantId = RequestContext.currentTenantId() ?? where.tenantId;

					// Initialize the query
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					query.leftJoin(`${query.alias}.modules`, 'modules');

					// Apply find options if provided
					if (isNotEmpty(options)) {
						query.setFindOptions({
							...(options.select && { select: parseFindOptionsSelect(options.select) }),
							...(options.relations && { relations: parseFindOptionsRelations(options.relations) }),
							...(options.order && { order: options.order })
						});
					}

					// Apply advanced filters
					if (filters) {
						const advancedWhere = this.buildAdvancedWhereCondition(filters, where);
						query.setFindOptions({ where: advancedWhere });
					}

					// Filter by project_module_task with a sub query
					query.andWhere((qb: SelectQueryBuilder<Task>) => {
						const subQuery = qb
							.subQuery()
							.select(p('"pmt"."taskId"')) // Use the alias 'pmt' here
							.from(p('project_module_task'), 'pmt') // Assign alias 'pmt' to project_module_task
							.leftJoin(
								'project_module_employee',
								'pme',
								p('"pme"."organizationProjectModuleId" = "pmt"."organizationProjectModuleId"')
							);

						// Retrieve the employee ID based on the permission
						const employeeId = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
							? members?.['id']
							: RequestContext.currentEmployeeId();

						if (isNotEmpty(employeeId)) {
							subQuery.andWhere(p('"pme"."employeeId" = :employeeId'), { employeeId });
						}
						if (isNotEmpty(modules)) {
							subQuery.andWhere(p(`"pmt"."organizationProjectModuleId" IN (:...modules)`), { modules });
						}

						return p(`"task_modules"."taskId" IN `) + subQuery.distinct(true).getQuery();
					});

					// Add organization and tenant filters
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						})
					);

					// Filter by projectId and modules
					if (isNotEmpty(projectId) && isEmpty(modules)) {
						query.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
					}

					// Add additional filters (status, draft, title, etc.)
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (isNotEmpty(status)) {
								qb.andWhere(p(`"${query.alias}"."status" = :status`), { status });
							}
							if (isNotEmpty(isDraft)) {
								qb.andWhere(p(`"${query.alias}"."isDraft" = :isDraft`), { isDraft });
							}
							if (isNotEmpty(title)) {
								qb.andWhere(p(`"${query.alias}"."title" ${LIKE_OPERATOR} :title`), {
									title: `%${title}%`
								});
							}
							if (isNotEmpty(prefix)) {
								qb.andWhere(p(`"${query.alias}"."prefix" ${LIKE_OPERATOR} :prefix`), {
									prefix: `%${prefix}%`
								});
							}
							if (isUUID(organizationSprintId)) {
								qb.andWhere(p(`"${query.alias}"."organizationSprintId" = :organizationSprintId`), {
									organizationSprintId
								});
							}
							qb.andWhere(p(`"${query.alias}"."isScreeningTask" = :isScreeningTask`), {
								isScreeningTask
							});
						})
					);

					const [items, total] = await query.getManyAndCount();
					return { items, total };
				}
			}
		} catch (error) {
			console.log('Error while retrieving module tasks', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * @description Get tasks by views query
	 * @param {ID} viewId - View ID
	 * @returns {Promise<IPagination<ITask>>} A Promise resolved to paginated found tasks and total matching query filters
	 * @memberof TaskService
	 */
	async findTasksByViewQuery(viewId: ID): Promise<IPagination<ITask>> {
		const tenantId = RequestContext.currentTenantId();
		try {
			// Retrieve Task View by ID for getting their pre-defined query params
			const taskView = await this._taskViewService.findOneByWhereOptions({ id: viewId, tenantId });
			if (!taskView) {
				throw new HttpException('View not found', HttpStatus.NOT_FOUND);
			}

			// Extract `queryParams` from the view
			const queryParams = taskView.queryParams;
			let viewFilters: IGetTasksByViewFilters = {};

			try {
				// SQLite stores the params as a JSON string: parse it once
				const parsed = isSqlite() && typeof queryParams === 'string' ? JSON.parse(queryParams) : queryParams;
				// A view saved without query params stores null: fall back to no filters, as on the other databases
				if (parsed !== null && parsed !== undefined && (typeof parsed !== 'object' || Array.isArray(parsed))) {
					throw new Error('Task view query parameters must be an object');
				}
				viewFilters = (parsed as IGetTasksByViewFilters) || {};
			} catch (error) {
				throw new HttpException('Invalid query parameters in task view', HttpStatus.BAD_REQUEST);
			}

			// Extract filters
			const {
				statuses = [],
				priorities = [],
				sizes = [],
				types = [],
				startDates = [],
				dueDates = [],
				organizationId,
				relations = []
			} = viewFilters;

			// Calculate min and max dates only if arrays are not empty
			const getMinMaxDates = (dates: Date[]) =>
				dates.length
					? [
							new Date(
								Math.min(
									...dates
										.filter((date) => !Number.isNaN(new Date(date).getTime()))
										.map((date) => new Date(date).getTime())
								)
							),
							new Date(
								Math.max(
									...dates
										.filter((date) => !Number.isNaN(new Date(date).getTime()))
										.map((date) => new Date(date).getTime())
								)
							)
					  ]
					: [undefined, undefined];

			const [minStartDate, maxStartDate] = getMinMaxDates(startDates);
			const [minDueDate, maxDueDate] = getMinMaxDates(dueDates);

			// Build the 'where' condition
			const mainWhereCondition = this.buildAdvancedWhereCondition(viewFilters);
			const where: FindOptionsWhere<Task> = {
				...mainWhereCondition,
				...(statuses.length && { status: In(statuses) }),
				...(priorities.length && { priority: In(priorities) }),
				...(sizes.length && { size: In(sizes) }),
				...(types.length && { issueType: In(types) }),
				...(minStartDate && maxStartDate && { startDate: Between(minStartDate, maxStartDate) }),
				...(minDueDate && maxDueDate && { dueDate: Between(minDueDate, maxDueDate) }),
				// Only scope by organization when one is known: the view's organizationId is a nullable
				// column and the stored query params may carry null (a null used to be dropped silently).
				...(taskView.organizationId || organizationId
					? { organizationId: taskView.organizationId || organizationId }
					: {}),
				tenantId
			};

			// Define find options
			const findOptions: FindManyOptions<Task> = { where, ...(relations && { relations: parseFindOptionsRelations(relations) }) };

			// Retrieve tasks using base class method
			return await super.findAll(findOptions);
		} catch (error) {
			console.error(`Error while retrieve view tasks: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Retrieves tasks based on the provided date filters for startDate and dueDate.
	 *
	 * @function getTasksByDateFilters
	 * @param {ITaskDateFilterInput} params - The query params containing the date filters for the tasks.
	 *
	 * @returns {Promise<IPagination<ITask>>} A promise that resolves to an paginated tasks filtered by the provided dates.
	 *
	 * @throws {Error} Will throw an error if there is a problem with the database query.
	 */
	async getTasksByDateFilters(params: ITaskDateFilterInput): Promise<IPagination<ITask>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(params);

		const tenantId = RequestContext.currentTenantId() || params.tenantId;

		try {
			const {
				startDateFrom,
				startDateTo,
				dueDateFrom,
				dueDateTo,
				createdByUserId,
				isScreeningTask = false,
				organizationId,
				employeeId,
				projectId,
				organizationTeamId,
				organizationSprintId,
				relations
			} = params;

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const mikroWhere: any = { tenantId, organizationId, isScreeningTask };

					// Date range filters
					if (isNotEmpty(startDateFrom) && isNotEmpty(startDateTo)) {
						mikroWhere.startDate = { $gte: startDateFrom, $lte: startDateTo };
					} else if (isNotEmpty(startDateFrom)) {
						mikroWhere.startDate = { $gte: startDateFrom };
					} else if (isNotEmpty(startDateTo)) {
						mikroWhere.startDate = { $lte: startDateTo };
					}

					if (isNotEmpty(dueDateFrom) && isNotEmpty(dueDateTo)) {
						mikroWhere.dueDate = { $gte: dueDateFrom, $lte: dueDateTo };
					} else if (isNotEmpty(dueDateFrom)) {
						mikroWhere.dueDate = { $gte: dueDateFrom };
					} else if (isNotEmpty(dueDateTo)) {
						mikroWhere.dueDate = { $lte: dueDateTo };
					}

					if (isNotEmpty(createdByUserId)) mikroWhere.createdByUserId = createdByUserId;
					if (isNotEmpty(employeeId)) mikroWhere.members = { id: employeeId };
					if (isNotEmpty(organizationTeamId)) mikroWhere.teams = { id: organizationTeamId };
					if (isNotEmpty(projectId)) mikroWhere.projectId = projectId;
					if (isNotEmpty(organizationSprintId)) mikroWhere.organizationSprintId = organizationSprintId;

					const [items, total] = await this.mikroOrmRepository.findAndCount(mikroWhere, {
						...(relations ? { populate: Object.keys(relations) as any[] } : {})
					});
					return { items: items.map((e) => this.serialize(e)) as ITask[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					let query = this.typeOrmRepository.createQueryBuilder(this.tableName);

					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
							qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
						})
					);

					// Apply the filters on startDate and dueDate
					query = addBetween<Task>(query, 'startDate', startDateFrom, startDateTo, p);
					query = addBetween<Task>(query, 'dueDate', dueDateFrom, dueDateTo, p);

					// Add Optional additional filters by
					query.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(createdByUserId)) {
								web.andWhere(p(`"${query.alias}"."createdByUserId" = :createdByUserId`), {
									createdByUserId
								});
							}

							if (isNotEmpty(employeeId)) {
								query.leftJoin(`${query.alias}.members`, 'members');
								web.andWhere((qb: SelectQueryBuilder<Task>) => {
									const subQuery = qb.subQuery();
									subQuery
										.select(p('"task_employee"."taskId"'))
										.from(p('task_employee'), p('task_employee'));
									subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });
									return p(`"task_members"."taskId" IN (${subQuery.distinct(true).getQuery()})`);
								});
							}

							if (isNotEmpty(organizationTeamId)) {
								query.leftJoin(`${query.alias}.teams`, 'teams');
								web.andWhere((qb: SelectQueryBuilder<Task>) => {
									const subQuery = qb.subQuery();
									subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
									subQuery.andWhere(p('"task_team"."organizationTeamId" = :organizationTeamId'), {
										organizationTeamId
									});
									return p(`"task_teams"."taskId" IN (${subQuery.distinct(true).getQuery()})`);
								});
							}
							if (isNotEmpty(projectId)) {
								web.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
							}

							if (isNotEmpty(organizationSprintId)) {
								web.andWhere(p(`"${query.alias}"."organizationSprintId" = :organizationSprintId`), {
									organizationSprintId
								});
							}

							web.andWhere(p(`"${query.alias}"."isScreeningTask" = :isScreeningTask`), {
								isScreeningTask
							});
						})
					);

					// Check if relations were provided and include them
					query.setFindOptions({
						...(relations ? { relations: parseFindOptionsRelations(relations) } : {})
					});

					const [items, total] = await query.getManyAndCount();

					return { items, total };
				}
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Constructs advanced `where` conditions for filtering tasks based on the provided filters and existing conditions.
	 *
	 * @private
	 * @param {ITaskAdvancedFilter | IGetTasksByViewFilters} [filters] - Advanced filtering criteria for tasks, including projects, teams, sprints, and more.
	 * @param {FindOptionsWhere<Task>} [where] - Existing `where` conditions to be merged with the filters.
	 * @returns {FindOptionsWhere<Task>} A `where` condition object to be used in database queries.
	 */
	private buildAdvancedWhereCondition(
		filters?: ITaskAdvancedFilter | IGetTasksByViewFilters,
		where: FindOptionsWhere<Task> = {}
	): FindOptionsWhere<Task> {
		// Destructuring filter params
		const {
			ids = [],
			projects = [],
			teams = [],
			modules = [],
			sprints = [],
			members = [],
			tags = [],
			statusIds = [],
			priorityIds = [],
			sizeIds = [],
			parentIds = [],
			createdByUserIds = [],
			dailyPlans = [],
			statuses = [],
			priorities = []
		} = filters;

		// Build the 'where' condition
		return {
			...(ids.length && !where.id ? { id: In(ids) } : {}),
			...(projects.length && !where.projectId ? { projectId: In(projects) } : {}),
			...(teams.length && !where.teams ? { teams: { id: In(teams) } } : {}),
			...(modules.length && !where.modules ? { modules: { id: In(modules) } } : {}),
			...(sprints.length && !where.organizationSprintId ? { organizationSprintId: In(sprints) } : {}),
			...(members.length && !where.members ? { members: { id: In(members) } } : {}),
			...(tags.length && !where.tags ? { tags: { id: In(tags) } } : {}),
			...(statusIds.length && !where.taskStatusId ? { taskStatusId: In(statusIds) } : {}),
			...(priorityIds.length && !where.taskPriorityId ? { taskPriorityId: In(priorityIds) } : {}),
			...(sizeIds.length && !where.taskSizeId ? { taskSizeId: In(sizeIds) } : {}),
			...(parentIds.length && !where.parentId ? { parentId: In(parentIds) } : {}),
			...(createdByUserIds.length && !where.createdByUserId ? { createdByUserId: In(createdByUserIds) } : {}),
			...(dailyPlans.length && !where.dailyPlans ? { dailyPlans: { id: In(dailyPlans) } } : {}),
			...(statuses.length && !where.status ? { status: In(statuses) } : {}),
			...(priorities.length && !where.priority ? { priority: In(priorities) } : {}),
			...(!where.dueDate ? this.dueDateCondition(filters) : {})
		};
	}

	/**
	 * The `dueDate` condition of the advanced filters: none, a range (either end may be open), or
	 * "no due date", which wins over a range sent with it.
	 */
	private dueDateCondition(filters: ITaskAdvancedFilter): FindOptionsWhere<Task> {
		const { dueDateFrom, dueDateTo, withoutDueDate } = filters;
		if (withoutDueDate === true) {
			return { dueDate: IsNull() };
		}
		const from = this.validDate(dueDateFrom);
		const to = this.validDate(dueDateTo);
		if (from && to) {
			return { dueDate: Between(from, to) };
		}
		if (from) {
			return { dueDate: MoreThanOrEqual(from) };
		}
		if (to) {
			return { dueDate: LessThanOrEqual(to) };
		}
		return {};
	}

	/**
	 * The column filters of the advanced filters (status, priority, due date) in the MikroORM query
	 * syntax, for the hand-built employee task query. Keys already in `where` win.
	 */
	private mikroOrmColumnFilters(
		filters: ITaskAdvancedFilter,
		where: Record<string, unknown>
	): Record<string, unknown> {
		const { statuses = [], priorities = [], dueDateFrom, dueDateTo, withoutDueDate } = filters;
		const condition: Record<string, unknown> = {};
		if (statuses.length && !where.status) {
			condition.status = { $in: statuses };
		}
		if (priorities.length && !where.priority) {
			condition.priority = { $in: priorities };
		}
		if (!where.dueDate) {
			const from = this.validDate(dueDateFrom);
			const to = this.validDate(dueDateTo);
			if (withoutDueDate === true) {
				condition.dueDate = null;
			} else if (from || to) {
				condition.dueDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
			}
		}
		return condition;
	}

	/** A date from a filter, or `null` when it is missing or not a valid date. */
	private validDate(value: Date | string | undefined | null): Date | null {
		if (value === undefined || value === null || value === '') {
			return null;
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	// ------------------------------------------------------------------ task views extensions

	/**
	 * Changes many tasks in one request. Each task is read in the caller's tenant and the request's organization,
	 * its changes are turned into the update the single route runs (tag and member lists computed from the task as
	 * it is), `apply` runs that update (the controller passes the update command, so activity, notifications and
	 * sync events happen per task exactly as for one update), and the previous values are answered so the caller
	 * can undo. A task that is missing, another organization's, or refused by its update is reported; the others
	 * are applied. Tasks are applied one after another.
	 */
	async bulkUpdate(
		input: ITaskBulkUpdateInput,
		apply: (id: ID, update: Partial<ITaskUpdateInput>) => Promise<ITask>
	): Promise<ITaskBulkUpdateOutcome> {
		let items: ReturnType<typeof normalizeBulkUpdate>;
		try {
			items = normalizeBulkUpdate(input);
		} catch (error) {
			if (error instanceof BulkUpdateRequestError) {
				throw new BadRequestException(`${error.code}: ${error.message}`);
			}
			throw error;
		}
		const tenantId = tenantIdOf(input);
		const organizationId = organizationIdOf(input);
		const results: ITaskBulkUpdateResult[] = [];
		for (const item of items) {
			const taskId = String(item.taskId);
			let task: Task | null = null;
			try {
				task = await this.typeOrmRepository.findOne({
					where: { id: taskId, tenantId, organizationId },
					relations: { tags: true, members: true }
				});
			} catch (error) {
				results.push({ taskId, ok: false, error: `TASK_READ_FAILED: ${(error as Error)?.message ?? 'unknown'}` });
				continue;
			}
			if (!task) {
				results.push({ taskId, ok: false, error: 'TASK_NOT_FOUND: no such task in this organization.' });
				continue;
			}
			const { update, previous } = changesToUpdate(task, item.changes);
			try {
				await apply(task.id, update);
				results.push({ taskId, ok: true, previous });
			} catch (error) {
				const message = (error as { message?: unknown })?.message;
				const text = typeof message === 'string' ? message : (message as { message?: string })?.message ?? 'The update was refused.';
				results.push({ taskId, ok: false, error: text, previous });
			}
		}
		const applied = results.filter((result) => result.ok).length;
		return { applied, refused: results.length - applied, results };
	}

	/**
	 * Resolves `KEY-number` references to tasks of the organization: by the project's key, its former keys, or
	 * the key derived from its name (the prefix the create path writes). When no task of those projects holds the
	 * number, a task that held it before it moved to another project answers (`formerReference`, with the key and the
	 * number it holds today). A reference nobody answers to, or a number no task of that project holds or held,
	 * resolves to nothing; a task that cannot be read answers the same.
	 */
	async resolveReferences(input: ITaskReferenceResolveInput): Promise<ITaskReferenceResolution[]> {
		const tenantId = tenantIdOf(input);
		const organizationId = organizationIdOf(input);
		const projects = await this.typeOrmRepository.manager.find(OrganizationProject, {
			where: { tenantId, organizationId },
			select: { id: true, name: true, taskKey: true, taskKeyHistory: true }
		});
		const projectsById = new Map(projects.map((project) => [String(project.id), project]));
		const byKey = new Map<string, OrganizationProject[]>();
		for (const project of projects) {
			for (const key of keysOfProject(project)) {
				const list = byKey.get(key) ?? [];
				list.push(project);
				byKey.set(key, list);
			}
		}
		const resolutions: ITaskReferenceResolution[] = [];
		for (const reference of input.references ?? []) {
			const parts = parseTaskReference(reference);
			if (!parts) {
				resolutions.push({ reference, key: '', number: 0, resolved: false });
				continue;
			}
			const candidates = byKey.get(parts.key) ?? [];
			// Every project answering to the key is read: a derived key two projects share (`Gauzy`, `Gauzy Teams`),
			// or a former key that is now another project's, must not open whichever task the store listed first.
			const candidateIds = candidates.map((project) => project.id);
			let matches =
				candidates.length === 0
					? []
					: await this.typeOrmRepository.find({
							where: { tenantId, organizationId, projectId: In(candidateIds), number: parts.number },
							select: { id: true, title: true, status: true, projectId: true, number: true }
						});
			// The live numbers first: a former reference answers only when no task of those projects holds the number.
			const formerReference = matches.length === 0 && candidates.length > 0;
			if (formerReference) {
				matches = await this.findTasksByFormerReference(tenantId, organizationId, candidateIds, parts.number);
			}
			if (matches.length > 1) {
				resolutions.push({ reference, key: parts.key, number: parts.number, resolved: false, ambiguous: true });
				continue;
			}
			const found = matches[0] ?? null;
			if (!found) {
				resolutions.push({ reference, key: parts.key, number: parts.number, resolved: false });
				continue;
			}
			// The task's project today: one of the candidates for a live number, any project for a former reference (none
			// when the task left its project without moving to another one, and then no key addresses it today).
			const project = found.projectId ? projectsById.get(String(found.projectId)) : undefined;
			let currentKey: string | undefined = formerReference ? undefined : parts.key;
			if (project) {
				currentKey = normalizeTaskKey(project.taskKey) ?? derivedProjectKey(project.name) ?? currentKey;
			}
			const currentNumber = found.number === null || found.number === undefined ? undefined : Number(found.number);
			resolutions.push({
				reference,
				key: parts.key,
				number: parts.number,
				resolved: true,
				taskId: found.id,
				projectId: found.projectId,
				title: found.title,
				status: found.status as TaskStatusEnum,
				currentKey,
				currentNumber,
				...(formerReference ? { formerReference: true } : {})
			});
		}
		return resolutions;
	}

	/**
	 * The live tasks of the organization that held `number` in one of the projects before they moved out of it, each
	 * once (a task that moved out, back and out again holds two references there, both its own).
	 */
	private async findTasksByFormerReference(tenantId: ID, organizationId: ID, projectIds: ID[], number: number): Promise<Task[]> {
		const references = await this.typeOrmRepository.manager.find(TaskFormerReference, {
			where: { tenantId, organizationId, projectId: In(projectIds), number },
			select: { id: true, taskId: true }
		});
		const taskIds = [...new Set(references.map((former) => String(former.taskId)))];
		if (taskIds.length === 0) {
			return [];
		}
		return this.typeOrmRepository.find({
			where: { id: In(taskIds), tenantId, organizationId },
			select: { id: true, title: true, status: true, projectId: true, number: true }
		});
	}

	/**
	 * The caller's tasks of a built-in view (`mine`, `this-week`, `overdue`, `due-soon`), the day and week bounds
	 * computed in the caller's time zone. The caller is the signed-in employee; a user without an employee has no
	 * tasks of their own.
	 */
	async findBuiltInView(key: TaskBuiltInViewEnum, query: ITaskBuiltInViewQuery): Promise<IPagination<ITask>> {
		// The caller's own employee record: `currentEmployeeId()` answers null for a `CHANGE_SELECTED_EMPLOYEE` holder.
		const employeeId = RequestContext.currentUser()?.employeeId ?? RequestContext.currentEmployeeId();
		if (!employeeId) {
			return { items: [], total: 0 };
		}
		const tenantId = tenantIdOf(query);
		const organizationId = organizationIdOf(query);
		const window = builtInViewWindow(key, new Date(), query.timeZone);
		const where: FindOptionsWhere<Task> = {
			tenantId,
			organizationId,
			isScreeningTask: false
		};
		if (window.dueDateFrom && window.dueDateTo) {
			where.dueDate = Between(window.dueDateFrom, window.dueDateTo);
		} else if (window.dueDateFrom) {
			where.dueDate = MoreThanOrEqual(window.dueDateFrom);
		} else if (window.dueDateTo) {
			where.dueDate = LessThanOrEqual(window.dueDateTo);
		}
		// A task whose status is unset is still open: `NOT IN` alone would drop it (SQL `NOT IN` never matches NULL).
		const closed = [TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED];
		const wheres: FindOptionsWhere<Task>[] = window.openOnly
			? [
					{ ...where, status: Not(In(closed)) },
					{ ...where, status: IsNull() }
				]
			: [where];
		const take = Math.min(Math.max(Number(query.take) || 50, 1), 200);
		const skip = Math.max(Number(query.skip) || 0, 0);
		const requested = Array.isArray(query.relations) && query.relations.length > 0 ? query.relations : [...BUILT_IN_VIEW_DEFAULT_RELATIONS];
		const refused = requested.filter((name) => !BUILT_IN_VIEW_RELATIONS.has(String(name)));
		if (refused.length > 0) {
			throw new BadRequestException(`RELATION_NOT_ALLOWED: a built-in view does not load ${refused.join(', ')}.`);
		}
		const relations = relationsTreeOf(requested) as FindOptionsRelations<Task>;
		// The platform's sensitive-relation table applies here as on every other read (tracked time, for one).
		this.assertRelationsPermitted({ relations });
		// Membership is a subquery, never a join shared with the loaded `members` relation: a join used for both
		// would list the caller as a task's only assignee. The page of ids first, then the rows with every relation.
		const idsQuery = this.typeOrmRepository
			.createQueryBuilder('task')
			.select(['task.id'])
			.where(wheres)
			.andWhere((qb) => {
				const membership = qb
					.subQuery()
					.select('"task_employee"."taskId"')
					.from('task_employee', 'task_employee')
					.where('"task_employee"."employeeId" = :employeeId')
					.getQuery();
				return `"task"."id" IN ${membership}`;
			})
			.setParameter('employeeId', employeeId)
			.orderBy('task.dueDate', 'ASC')
			.addOrderBy('task.createdAt', 'DESC')
			.skip(skip)
			.take(take);
		const [page, total] = await idsQuery.getManyAndCount();
		if (page.length === 0) {
			return { items: [], total };
		}
		const ids = page.map((task) => task.id);
		const rows = await this.typeOrmRepository.find({ where: { id: In(ids), tenantId, organizationId }, relations });
		const byId = new Map(rows.map((task) => [String(task.id), task]));
		return { items: ids.map((id) => byId.get(String(id))).filter((task): task is Task => !!task), total };
	}
}

/**
 * The organization a request names, in either form the base DTO accepts (`organizationId`, or `organization.id`,
 * both checked against the caller's memberships by the DTO). Required: without one, a read scoped by the tenant
 * alone would reach every organization of the tenant.
 */
function organizationIdOf(input: { organizationId?: ID; organization?: { id?: ID } | null }): ID {
	const organizationId = input.organizationId ?? input.organization?.id;
	if (!organizationId) {
		throw new BadRequestException('TASK_SCOPE_REQUIRED: state the organization of the request.');
	}
	return organizationId;
}

/** The caller's tenant, which every one of these reads is scoped by; a request without one is refused. */
function tenantIdOf(input: { tenantId?: ID }): ID {
	const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
	if (!tenantId) {
		throw new BadRequestException('TASK_SCOPE_REQUIRED: the tenant of the request is unknown.');
	}
	return tenantId;
}
