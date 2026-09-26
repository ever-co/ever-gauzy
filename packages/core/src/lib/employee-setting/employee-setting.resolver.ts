import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	BaseEntityEnum,
	EmployeeSettingTypeEnum,
	ID as Id,
	IEmployeeSettingCreateInput,
	IPagination,
	JsonData
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { BaseQueryDTO } from '../core/crud';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeSetting } from './employee-setting.entity';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSettingCreateCommand, EmployeeSettingUpdateCommand } from './commands';

/** The members `CreateEmployeeSettingInput` declares in the schema. */
export interface ICreateEmployeeSettingInput {
	settingType?: EmployeeSettingTypeEnum;
	entityId?: Id;
	entity?: BaseEntityEnum;
	data?: JsonData;
	defaultData?: JsonData;
	employeeId?: Id;
	organizationId?: Id;
}

/** The members `UpdateEmployeeSettingInput` declares in the schema. */
export interface IUpdateEmployeeSettingInput extends Omit<ICreateEmployeeSettingInput, 'employeeId'> {
	id: Id;
}

/**
 * The fields a setting list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeSettingFilter` and
 * `EmployeeSettingSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `data` and `defaultData` are `JSON` because that is what the columns are, and the connection
 * protocol's document kind is what lets a caller narrow a list by a value inside the stored document
 * rather than by the document as a whole. `settingType` and `entity` are `STRING` rather than schema
 * enums: their vocabularies belong to the contracts package and to the entity columns the entity
 * declares, and a second declaration here could diverge from the column it describes.
 */
const EMPLOYEE_SETTING_FILTERABLE = {
	id: 'ID',
	settingType: 'STRING',
	entityId: 'ID',
	entity: 'STRING',
	data: 'JSON',
	defaultData: 'JSON',
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
const EMPLOYEE_SETTING_SORTABLE = [
	'createdAt',
	'updatedAt',
	'settingType',
	'entity',
	'employeeId',
	'deletedAt'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read states no order of its own — it is the platform's own `findAll`, which
 * hands back whatever the store returned — so this is a decision the connection has to make rather
 * than one it reproduces: newest first, then the identifier, which is the key that makes the order
 * total and a cursor walk over it stable.
 */
const EMPLOYEE_SETTING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The settings of one employee over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `EmployeeSettingService` method the
 * `/api/employee-settings` routes reach, or dispatches the same command.
 *
 * **The guard chain is the controller's, and the class states exactly it.** The delivered controller
 * carries `TenantPermissionGuard` at class level and no `@Permissions` anywhere — not on the class
 * and not on a single handler — so every route it serves runs under the tenant guard alone. This
 * resolver therefore states no permission either, at any level: a statement of one here would narrow
 * GraphQL below REST for this resource, and leaving the guard off would widen it. The absence is the
 * parity, and it is deliberate rather than an omission — there is nothing on the controller to copy.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmployeeSetting')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EmployeeSettingResolver {
	constructor(
		private readonly employeeSettingService: EmployeeSettingService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The settings of the caller's tenant, newest first.
	 */
	@Query('employeeSettings')
	async employeeSettings(
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
	): Promise<GraphqlConnection<EmployeeSetting>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<EmployeeSetting>;
		const { items }: IPagination<EmployeeSetting> = await this.employeeSettingService.findAll(options);

		return buildConnection<EmployeeSetting>({
			rows: items ?? [],
			filterable: EMPLOYEE_SETTING_FILTERABLE,
			sortable: EMPLOYEE_SETTING_SORTABLE,
			defaultSort: EMPLOYEE_SETTING_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One setting of the caller's tenant.
	 *
	 * A setting that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 *
	 * The delivered route binds its query string to `FindOptionsQueryDTO`, which names the relations
	 * to load; this surface's type carries no relation but the identifier that always travels, so the
	 * read names none and runs with the route's own defaults.
	 */
	@Query('employeeSetting')
	async employeeSetting(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeSetting | null> {
		try {
			return await this.employeeSettingService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many settings the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('employeeSettingCount')
	async employeeSettingCount(): Promise<number> {
		return await this.employeeSettingService.countBy();
	}

	/**
	 * Files a setting, or overwrites the one already there for the same employee and entity.
	 *
	 * The write is dispatched as the same command the REST route dispatches, so the two surfaces
	 * perform the same operation: the delivered create looks the setting up by employee, entity and
	 * organization first and, when it finds one, writes the stated body over that row under its own
	 * identifier rather than adding a second row. The employee and the tenant are never taken from the
	 * caller's scope when the credential supplies them, so a caller cannot file a setting into a
	 * person's or a tenant's records that it is not acting in.
	 *
	 * The payload is cast into the shape the command declares because the contract's create input is the
	 * entity's own shape and therefore carries the relation this surface deliberately does not: the
	 * caller states the employee's identifier, which is the member that always travels, and the cast
	 * says so rather than widening the command's declaration.
	 */
	@Mutation('createEmployeeSetting')
	async createEmployeeSetting(@Args('input') input: ICreateEmployeeSettingInput): Promise<EmployeeSetting> {
		return await this.commandBus.execute(
			new EmployeeSettingCreateCommand(input as unknown as IEmployeeSettingCreateInput)
		);
	}

	/**
	 * Changes a setting that exists.
	 *
	 * The identifier travels in the input because this surface's mutation takes one argument, and it
	 * is passed on exactly as the delivered route passes it: the command carries the identifier from
	 * the path and the body beside it, and the delivered service reads the row by that identifier
	 * before it writes — a caller naming a setting of another tenant, or one that is not there, is
	 * answered with the miss rather than with a write it does not own.
	 */
	@Mutation('updateEmployeeSetting')
	async updateEmployeeSetting(@Args('input') input: IUpdateEmployeeSettingInput): Promise<EmployeeSetting> {
		return await this.commandBus.execute(new EmployeeSettingUpdateCommand(input.id, input));
	}

	/**
	 * Removes a setting outright.
	 *
	 * The delivered route answers the store's deletion result; the field answers the fact of the
	 * removal, which is the one member of that result a caller reads.
	 */
	@Mutation('deleteEmployeeSetting')
	async deleteEmployeeSetting(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.employeeSettingService.delete(id);

		return true;
	}

	/**
	 * Withdraws a setting without removing it: the row stays and keeps its identifier, and the
	 * delivered list stops answering it.
	 *
	 * The same service method the REST route calls, so the two surfaces mark the same row and answer
	 * with the same row afterwards.
	 */
	@Mutation('softDeleteEmployeeSetting')
	async softDeleteEmployeeSetting(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeSetting> {
		return await this.employeeSettingService.softRemove(id);
	}

	/**
	 * Puts a withdrawn setting back.
	 */
	@Mutation('recoverEmployeeSetting')
	async recoverEmployeeSetting(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeSetting> {
		return await this.employeeSettingService.softRecover(id);
	}
}
