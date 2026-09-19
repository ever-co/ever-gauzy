import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, IScreeningTask } from '@gauzy/contracts';
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
import { ScreeningTask } from './screening-task.entity';
import { ScreeningTasksService } from './screening-tasks.service';
import { ScreeningTaskCreateCommand, ScreeningTaskUpdateCommand } from './commands';
import { ICreateTaskInput } from '../task.resolver';

/** The members `CreateScreeningTaskInput` declares in the schema. */
export interface ICreateScreeningTaskInput {
	organizationId: Id;
	task: ICreateTaskInput;
	taskId: Id;
	mentionEmployeeIds?: Id[];
}

/** The members `UpdateScreeningTaskInput` declares in the schema. */
export interface IUpdateScreeningTaskInput {
	id: Id;
	organizationId: Id;
	status: string;
	onHoldUntil?: Date;
}

/**
 * The fields a screening list may be narrowed and sorted by, and the order it answers in when the
 * caller states none.
 *
 * The reader applies no order of its own, so the default is the connection's decision: newest first,
 * with the identifier as the last key so that two decisions written in the same millisecond still
 * have one order between them.
 */
const SCREENING_TASK_FILTERABLE = {
	id: 'ID',
	status: 'STRING',
	onHoldUntil: 'DATE',
	taskId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const SCREENING_TASK_SORTABLE = ['createdAt', 'updatedAt', 'status', 'onHoldUntil'] as const;

/** The order the connection answers in when the caller states none. */
const SCREENING_TASK_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The decision a task goes through before it becomes work, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ScreeningTasksService` method the `/api/screening-tasks`
 * routes call, or dispatches the same command its two writes dispatch — and those two are the writes
 * that file the task, subscribe the assignees, mentions them and write the activity logs, so neither
 * is re-implemented here.
 *
 * **The guard chain is the controller's, and no field states a permission.** The delivered controller
 * carries both guards on the class and `@Permissions()` — the decorator with no permission in it,
 * which is an empty set rather than an absent statement. Every one of its routes therefore runs under
 * the guards alone. This resolver carries the same chain and the same empty statement, so a field
 * here is neither narrower nor wider than the route it mirrors; the permission guard is in the chain
 * because the controller's chain has it, and it has nothing to check.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field.
 */
@Resolver('ScreeningTask')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions()
export class ScreeningTaskResolver {
	constructor(
		private readonly screeningTasksService: ScreeningTasksService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The screening decisions of the caller's tenant.
	 *
	 * The controller serves the same rows a second time through the inherited `GET /pagination`, which
	 * is one capability and therefore this one field.
	 */
	@Query('screeningTasks')
	async screeningTasks(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ScreeningTask>> {
		const { items }: IPagination<ScreeningTask> = await this.screeningTasksService.findAll(
			{} as BaseQueryDTO<ScreeningTask>
		);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One screening decision, or null when there is none.
	 */
	@Query('screeningTask')
	async screeningTask(@Args('id', { type: () => ID }) id: Id): Promise<ScreeningTask | null> {
		try {
			return await this.screeningTasksService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many screening decisions the caller's tenant holds. The route is inherited from the CRUD
	 * base and runs under the guards alone.
	 */
	@Query('screeningTaskCount')
	async screeningTaskCount(): Promise<number> {
		return await this.screeningTasksService.countBy();
	}

	/**
	 * Puts a task up for screening.
	 *
	 * The same command the create route dispatches. The delivered handler files the task the `task`
	 * member states before it writes the decision, which is why that member is a whole task body here
	 * rather than an identifier.
	 */
	@Mutation('createScreeningTask')
	async createScreeningTask(@Args('input') input: ICreateScreeningTaskInput): Promise<IScreeningTask> {
		return await this.commandBus.execute(new ScreeningTaskCreateCommand(input as never));
	}

	/**
	 * Records where a decision stands.
	 *
	 * The same command the edit route dispatches. Its handler moves the task with the decision — a
	 * declined or duplicated outcome cancels the task, a pending or snoozed one keeps it in screening
	 * — so the field answers the decision the write produced and the task's own state is read back
	 * through the task resource.
	 */
	@Mutation('updateScreeningTask')
	async updateScreeningTask(@Args('input') input: IUpdateScreeningTaskInput): Promise<IScreeningTask> {
		const { id, ...values } = input;

		return await this.commandBus.execute(new ScreeningTaskUpdateCommand(id, values as never));
	}

	/**
	 * Removes a screening decision outright.
	 */
	@Mutation('deleteScreeningTask')
	async deleteScreeningTask(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.screeningTasksService.delete(id);

		return true;
	}

	/**
	 * Withdraws a screening decision without removing it. The route is inherited from the CRUD base
	 * and runs under the guards alone.
	 */
	@Mutation('softDeleteScreeningTask')
	async softDeleteScreeningTask(@Args('id', { type: () => ID }) id: Id): Promise<ScreeningTask> {
		return await this.screeningTasksService.softRemove(id);
	}

	/**
	 * Puts a withdrawn decision back. Inherited for the same reason the withdrawal above is.
	 */
	@Mutation('recoverScreeningTask')
	async recoverScreeningTask(@Args('id', { type: () => ID }) id: Id): Promise<ScreeningTask> {
		return await this.screeningTasksService.softRecover(id);
	}

	/** The connection one list root field answers with. */
	private connection(
		rows: readonly ScreeningTask[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<ScreeningTask> {
		return buildConnection<ScreeningTask>({
			rows: rows ?? [],
			filterable: SCREENING_TASK_FILTERABLE,
			sortable: SCREENING_TASK_SORTABLE,
			defaultSort: SCREENING_TASK_DEFAULT_SORT,
			request
		});
	}
}
