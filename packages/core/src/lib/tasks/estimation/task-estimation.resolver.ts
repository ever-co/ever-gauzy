import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, ITaskEstimation, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { BaseQueryDTO } from '../../core/crud';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { TaskEstimation } from './task-estimation.entity';
import { TaskEstimationService } from './task-estimation.service';
import { TaskEstimationCreateCommand, TaskEstimationDeleteCommand, TaskEstimationUpdateCommand } from './commands';

/** The members `CreateTaskEstimationInput` declares in the schema. */
export interface ICreateTaskEstimationInput {
	organizationId: Id;
	estimate: number;
	employeeId: Id;
	taskId: Id;
}

/** The members `UpdateTaskEstimationInput` declares in the schema. */
export interface IUpdateTaskEstimationInput extends ICreateTaskEstimationInput {
	id: Id;
}

/**
 * The fields an estimation list may be filterable and sorted by, and the order it answers in when the
 * caller states none.
 *
 * `taskId` is the member that matters: the rows are a task's own, so a task's estimates are this
 * connection narrowed rather than a root field per task. The reader applies no order of its own, so
 * the default is the connection's decision — newest first, with the identifier as the last key so
 * that two estimates written in the same millisecond still have one order between them.
 */
const TASK_ESTIMATION_FILTERABLE = {
	id: 'ID',
	estimate: 'NUMBER',
	employeeId: 'ID',
	taskId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const TASK_ESTIMATION_SORTABLE = ['createdAt', 'updatedAt', 'estimate'] as const;

/** The order the connection answers in when the caller states none. */
const TASK_ESTIMATION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * How long one person thinks a task takes, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `TaskEstimationService` method the `/api/task-estimation`
 * routes call, or dispatches the same command its three writes dispatch.
 *
 * **The guard chain and the permission are the controller's, field by field.** The delivered
 * controller carries both guards on the class and `ALL_ORG_EDIT` as its class-level permission; its
 * three own routes then state the add, edit and delete permission beside it, and the routes it
 * inherits from the CRUD base state nothing of their own and run under the class permission alone.
 * This resolver carries the same chain — plus the gate — and states on each field exactly what its
 * own route states, the inherited ones included: an inherited route's permission is the class's, and
 * a field that stated none would be wider than the route it mirrors.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field.
 */
@Resolver('TaskEstimation')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
export class TaskEstimationResolver {
	constructor(
		private readonly taskEstimationService: TaskEstimationService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The estimates of the caller's tenant.
	 *
	 * A task's own estimates are this connection with `taskId` in `filter`: the rows carry the task
	 * they belong to, so the connection is the list and the task is the narrowing. The controller
	 * serves the same rows a second time through the inherited `GET /pagination`, which is one
	 * capability and therefore this one field.
	 */
	@Query('taskEstimations')
	async taskEstimations(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<TaskEstimation>> {
		const { items }: IPagination<TaskEstimation> = await this.taskEstimationService.findAll(
			{ ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<TaskEstimation>
		);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One estimate, or null when there is none.
	 */
	@Query('taskEstimation')
	async taskEstimation(@Args('id', { type: () => ID }) id: Id): Promise<TaskEstimation | null> {
		try {
			return await this.taskEstimationService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many estimates the caller's tenant holds.
	 */
	@Query('taskEstimationCount')
	async taskEstimationCount(): Promise<number> {
		return await this.taskEstimationService.countBy();
	}

	/**
	 * Records an estimate: the same command the create route dispatches.
	 */
	@Mutation('createTaskEstimation')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	async createTaskEstimation(@Args('input') input: ICreateTaskEstimationInput): Promise<ITaskEstimation> {
		return await this.commandBus.execute(new TaskEstimationCreateCommand(input as never));
	}

	/**
	 * Changes an estimate: the same command the edit route dispatches, with the identifier in both
	 * places the delivered route carries it because the handler reads it off the command.
	 */
	@Mutation('updateTaskEstimation')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	async updateTaskEstimation(@Args('input') input: IUpdateTaskEstimationInput): Promise<ITaskEstimation> {
		const { id, ...values } = input;

		return await this.commandBus.execute(new TaskEstimationUpdateCommand(id, values as never));
	}

	/**
	 * Removes an estimate outright: the same command the removal route dispatches.
	 */
	@Mutation('deleteTaskEstimation')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	async deleteTaskEstimation(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.commandBus.execute(new TaskEstimationDeleteCommand(id));

		return true;
	}

	/**
	 * Withdraws an estimate without removing it. The delivered route is inherited from the CRUD base
	 * and states no permission of its own, so this field states the class's.
	 */
	@Mutation('softDeleteTaskEstimation')
	async softDeleteTaskEstimation(@Args('id', { type: () => ID }) id: Id): Promise<TaskEstimation> {
		return await this.taskEstimationService.softRemove(id);
	}

	/**
	 * Puts a withdrawn estimate back. Inherited for the same reason the withdrawal above is.
	 */
	@Mutation('recoverTaskEstimation')
	async recoverTaskEstimation(@Args('id', { type: () => ID }) id: Id): Promise<TaskEstimation> {
		return await this.taskEstimationService.softRecover(id);
	}

	/** The connection one list root field answers with. */
	private connection(
		rows: readonly TaskEstimation[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<TaskEstimation> {
		return buildConnection<TaskEstimation>({
			rows: rows ?? [],
			filterable: TASK_ESTIMATION_FILTERABLE,
			sortable: TASK_ESTIMATION_SORTABLE,
			defaultSort: TASK_ESTIMATION_DEFAULT_SORT,
			request
		});
	}
}
