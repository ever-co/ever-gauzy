import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, JsonData } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';
import { EmployeeNotificationSettingCreateCommand, EmployeeNotificationSettingUpdateCommand } from './commands';

/** The members `CreateEmployeeNotificationSettingInput` declares in the schema. */
export interface ICreateEmployeeNotificationSettingInput {
	payment?: boolean;
	assignment?: boolean;
	invitation?: boolean;
	mention?: boolean;
	comment?: boolean;
	message?: boolean;
	preferences: JsonData;
	organizationId?: Id;
}

/** The members `UpdateEmployeeNotificationSettingInput` declares in the schema. */
export interface IUpdateEmployeeNotificationSettingInput extends Partial<ICreateEmployeeNotificationSettingInput> {
	id: Id;
}

/**
 * The fields a setting list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeNotificationSettingFilter` and
 * `EmployeeNotificationSettingSortField` are its two renderings, and keeping the three in one file is
 * what makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every flag is a `BOOLEAN` rather than a `NUMBER`: a flag compared as a number would let `2` select
 * the rows that carry it, which is a question no caller means to ask. `preferences` is `JSON` because
 * that is what the column is, and the connection protocol's document kind is what lets a caller
 * narrow a list by a value inside the stored document rather than by the document as a whole.
 */
const EMPLOYEE_NOTIFICATION_SETTING_FILTERABLE = {
	id: 'ID',
	payment: 'BOOLEAN',
	assignment: 'BOOLEAN',
	invitation: 'BOOLEAN',
	mention: 'BOOLEAN',
	comment: 'BOOLEAN',
	message: 'BOOLEAN',
	preferences: 'JSON',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMPLOYEE_NOTIFICATION_SETTING_SORTABLE = ['createdAt', 'updatedAt', 'employeeId', 'deletedAt'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read states no order of its own — it is the platform's own `findAll`, which hands
 * back whatever the store returned — so this is a decision the connection has to make rather than one
 * it reproduces: newest first, then the identifier, which is the key that makes the order total and a
 * cursor walk over it stable.
 */
const EMPLOYEE_NOTIFICATION_SETTING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * One employee's notification preferences over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `EmployeeNotificationSettingService` method the
 * `/api/employee-notification-setting` routes reach, or dispatches the same command.
 *
 * **The guard chain is the controller's, and the empty permission list is a statement rather than an
 * omission.** The delivered controller carries `TenantPermissionGuard` and `PermissionGuard` at class
 * level and states `@Permissions()` with no members, and none of its handlers states a guard or a
 * permission of its own. `PermissionGuard` reads an empty list as "no permission required" — it
 * authorises the request before it looks anything up — so that empty list *is* the scope of every
 * route this resource serves. It is restated here rather than left off so that the two surfaces carry
 * the same metadata: a reader comparing them should find the controller's statement, not have to work
 * out whether a missing decorator meant the same thing.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmployeeNotificationSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@Permissions()
@FeatureFlag(FEATURE_GRAPHQL)
export class EmployeeNotificationSettingResolver {
	constructor(
		private readonly employeeNotificationSettingService: EmployeeNotificationSettingService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The notification settings of the caller's tenant, newest first.
	 */
	@Query('employeeNotificationSettings')
	async employeeNotificationSettings(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<EmployeeNotificationSetting>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const options = {} as BaseQueryDTO<EmployeeNotificationSetting>;
		const { items }: IPagination<EmployeeNotificationSetting> =
			await this.employeeNotificationSettingService.findAll(options);

		return buildConnection<EmployeeNotificationSetting>({
			rows: items ?? [],
			filterable: EMPLOYEE_NOTIFICATION_SETTING_FILTERABLE,
			sortable: EMPLOYEE_NOTIFICATION_SETTING_SORTABLE,
			defaultSort: EMPLOYEE_NOTIFICATION_SETTING_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One notification setting of the caller's tenant.
	 *
	 * A setting that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 *
	 * The delivered route binds its query string to `BaseQueryDTO`, which names the relations to load;
	 * this surface's type carries no relation but the identifier that always travels, so the read names
	 * none and runs with the route's own defaults.
	 */
	@Query('employeeNotificationSetting')
	async employeeNotificationSetting(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EmployeeNotificationSetting | null> {
		try {
			return await this.employeeNotificationSettingService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many notification settings the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('employeeNotificationSettingCount')
	async employeeNotificationSettingCount(): Promise<number> {
		return await this.employeeNotificationSettingService.countBy();
	}

	/**
	 * Files an employee's notification preferences.
	 *
	 * The write is dispatched as the same command the REST route dispatches, so the two surfaces write
	 * the same row: the delivered service stamps the tenant of the credential and derives the employee
	 * from the credential when the body names none, which is why neither is a member of the input, and
	 * a caller cannot file preferences into a person's or a tenant's records that it is not acting in.
	 */
	@Mutation('createEmployeeNotificationSetting')
	async createEmployeeNotificationSetting(
		@Args('input') input: ICreateEmployeeNotificationSettingInput
	): Promise<EmployeeNotificationSetting> {
		return await this.commandBus.execute(new EmployeeNotificationSettingCreateCommand(input));
	}

	/**
	 * Changes a notification setting that exists.
	 *
	 * The identifier travels in the input because this surface's mutation takes one argument, and it is
	 * passed on exactly as the delivered route passes it: the command carries the identifier from the
	 * path and the body beside it, and the delivered handler refuses the call outright when either is
	 * missing. A caller naming a setting of another tenant is answered with the miss the service raises
	 * before it writes, rather than with a write it does not own.
	 */
	@Mutation('updateEmployeeNotificationSetting')
	async updateEmployeeNotificationSetting(
		@Args('input') input: IUpdateEmployeeNotificationSettingInput
	): Promise<EmployeeNotificationSetting> {
		return await this.commandBus.execute(new EmployeeNotificationSettingUpdateCommand(input.id, input));
	}

	/**
	 * Removes a notification setting outright.
	 *
	 * The delivered route answers the store's deletion result; the field answers the fact of the
	 * removal, which is the one member of that result a caller reads.
	 */
	@Mutation('deleteEmployeeNotificationSetting')
	async deleteEmployeeNotificationSetting(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.employeeNotificationSettingService.delete(id);

		return true;
	}

	/**
	 * Withdraws a notification setting without removing it: the row stays and keeps its identifier, and
	 * the delivered list stops answering it.
	 *
	 * The same service method the REST route calls, so the two surfaces mark the same row and answer
	 * with the same row afterwards.
	 */
	@Mutation('softDeleteEmployeeNotificationSetting')
	async softDeleteEmployeeNotificationSetting(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EmployeeNotificationSetting> {
		return await this.employeeNotificationSettingService.softRemove(id);
	}

	/**
	 * Puts a withdrawn notification setting back.
	 */
	@Mutation('recoverEmployeeNotificationSetting')
	async recoverEmployeeNotificationSetting(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EmployeeNotificationSetting> {
		return await this.employeeNotificationSettingService.softRecover(id);
	}
}
