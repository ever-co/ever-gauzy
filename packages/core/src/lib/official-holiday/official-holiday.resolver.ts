import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IOfficialHoliday, IOfficialHolidayFindInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OfficialHoliday } from './official-holiday.entity';
import { OfficialHolidayService } from './official-holiday.service';

/** The members `CreateOfficialHolidayInput` declares in the schema. */
export interface ICreateOfficialHolidayInput {
	organizationId: Id;
	name: string;
	countryCode: string;
	date: Date | string;
	endDate?: Date | string;
	isRecurring?: boolean;
	isActive?: boolean;
	isArchived?: boolean;
}

/** The members `UpdateOfficialHolidayInput` declares in the schema. */
export interface IUpdateOfficialHolidayInput extends Partial<ICreateOfficialHolidayInput> {
	id: Id;
}

/**
 * The fields a holiday list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OfficialHolidayFilter` and
 * `OfficialHolidaySortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * The delivered `year` member is not here, and it does not need to be: the read turns it into a
 * disjunction between a date range and the recurrence flag, and the connection protocol's own `or`
 * group expresses exactly that disjunction over the two members below. A `year` member would be a
 * second narrowing path that could disagree with the first.
 */
const OFFICIAL_HOLIDAY_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	name: 'STRING',
	countryCode: 'STRING',
	date: 'DATE',
	endDate: 'DATE',
	isRecurring: 'BOOLEAN',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const OFFICIAL_HOLIDAY_SORTABLE = ['createdAt', 'updatedAt', 'name', 'countryCode', 'date', 'endDate'] as const;

/**
 * The order the connection keeps instead of declaring one.
 *
 * The delivered list read fixes an order of its own — the holiday date ascending, which is what makes
 * a list of days read as a calendar — so the connection has nothing to decide here. Declaring no
 * default leaves the array the service returned in the order the service meant it, and a caller that
 * wants another order states one and gets it; the cursor then names the row's own identifier, which
 * is the key that is total without any sort being stated.
 */
const OFFICIAL_HOLIDAY_KEEP_READ_ORDER: readonly ConnectionSortKey[] = [];

/**
 * The official holiday over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `OfficialHolidayService` the `/api/official-holiday`
 * routes call.
 *
 * **The guard chain and the permissions are the controller's, field by field.** The controller
 * carries `TenantPermissionGuard` and `PermissionGuard` on the class with `ALL_ORG_EDIT` and
 * `TIME_OFF_POLICY_EDIT`, and every one of its handlers states a pair of its own. So this class
 * carries the same two guards, the gate below and the class's own pair, and every field states the
 * pair its route states: the two reads the view pair — which replaces the class's edit half rather
 * than keeping it — the filing the add pair, the edit the edit pair and the removal the delete pair.
 * That split is the delivered metadata's and this surface repeats it rather than tidying it away.
 *
 * **The surface is five fields and no more, because the resource serves five routes.** This
 * controller is not a CRUD controller: it inherits no count route and no lifecycle pair, so there is
 * no count field, no withdrawal and no restoration here. A field for any of them would be a
 * capability with no REST route behind it.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('OfficialHoliday')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
export class OfficialHolidayResolver {
	constructor(private readonly officialHolidayService: OfficialHolidayService) {}

	/**
	 * The official holidays of the caller's tenant, earliest first.
	 */
	@Query('officialHolidays')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_POLICY_VIEW)
	async officialHolidays(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OfficialHoliday>> {
		// The read runs with the route's own defaults for an unstated request: no country code, no year
		// and no organization, which is the call the route makes when its query DTO is empty. The
		// connection protocol's `filter` then narrows the rows the service returns — including the
		// calendar-year question, which the protocol's `or` group expresses exactly as the read does.
		const input = {} as IOfficialHolidayFindInput;
		const { items }: IPagination<OfficialHoliday> = await this.officialHolidayService.findAllByFilter(input);

		return buildConnection<OfficialHoliday>({
			rows: items ?? [],
			filterable: OFFICIAL_HOLIDAY_FILTERABLE,
			sortable: OFFICIAL_HOLIDAY_SORTABLE,
			// The read ordered the rows itself; declaring a default here would replace that order.
			defaultSort: OFFICIAL_HOLIDAY_KEEP_READ_ORDER,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One official holiday of the caller's tenant.
	 *
	 * A holiday that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('officialHoliday')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_POLICY_VIEW)
	async officialHoliday(@Args('id', { type: () => ID }) id: Id): Promise<OfficialHoliday | null> {
		try {
			return await this.officialHolidayService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Files a holiday through the same service method the delivered create route calls.
	 */
	@Mutation('createOfficialHoliday')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_ADD)
	async createOfficialHoliday(@Args('input') input: ICreateOfficialHolidayInput): Promise<OfficialHoliday> {
		return await this.officialHolidayService.create(input as unknown as OfficialHoliday);
	}

	/**
	 * Changes a holiday through the same service method the delivered edit route calls.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered
	 * route answers a `DeleteResult | UpdateResult` — a statement about the write — which is not a row
	 * and not what a GraphQL field named `updateOfficialHoliday` may return.
	 */
	@Mutation('updateOfficialHoliday')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	async updateOfficialHoliday(@Args('input') input: IUpdateOfficialHolidayInput): Promise<OfficialHoliday> {
		const { id, ...values } = input;

		await this.officialHolidayService.update(id, values as QueryDeepPartialEntity<OfficialHoliday>);

		return await this.officialHolidayService.findOneByIdString(id);
	}

	/**
	 * Removes a holiday outright — the only removal this resource serves.
	 */
	@Mutation('deleteOfficialHoliday')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_DELETE)
	async deleteOfficialHoliday(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.officialHolidayService.delete(id);

		return true;
	}
}
