import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { DecimalString, ID as Id, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { Equipment } from './equipment.entity';
import { EquipmentService } from './equipment.service';

/** The members `CreateEquipmentInput` declares in the schema. */
export interface ICreateEquipmentInput {
	name: string;
	type?: string;
	imageId?: Id;
	serialNumber?: string;
	manufacturedYear?: DecimalString;
	initialCost?: DecimalString;
	maxSharePeriod?: DecimalString;
	autoApproveShare?: boolean;
	currency: string;
	organizationId: Id;
	tagIds?: Id[];
}

/**
 * The members `UpdateEquipmentInput` declares in the schema.
 *
 * The delivered edit body is the create body with the identifier added — `UpdateEquipmentDTO` extends
 * `CreateEquipmentDTO` unchanged — so the two inputs declare the same members and the identifier is
 * the only difference between them.
 */
export interface IUpdateEquipmentInput extends ICreateEquipmentInput {
	id: Id;
}

/**
 * The fields an equipment list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EquipmentFilter` and `EquipmentSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row the delivered list read answers, because the connection narrows
 * the rows the service returned. The three numeric columns are `DECIMAL` rather than `NUMBER` because
 * the columns are `numeric`: `initialCost` is money and an amount compared as a floating-point number
 * is an amount that selects the wrong rows, and the year and the period are stored at a scale a whole
 * number cannot hold. The relations are in neither list: `image`, `equipmentSharings` and `tags` are
 * joined only when a REST caller names them in `relations`, and this surface has no spelling for that,
 * so a condition on one would be evaluated against a row that carries none of it and would select
 * nothing at all. `deletedAt` is absent because the delivered list read answers live rows only. The
 * tenant is absent because the read applies it from the credential; the organization is present,
 * because the delivered list route hands its own criterion through and a caller may narrow to one
 * organization of its tenant.
 */
const EQUIPMENT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	type: 'STRING',
	serialNumber: 'STRING',
	manufacturedYear: 'DECIMAL',
	initialCost: 'DECIMAL',
	currency: 'STRING',
	maxSharePeriod: 'DECIMAL',
	autoApproveShare: 'BOOLEAN',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EQUIPMENT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'type',
	'manufacturedYear',
	'initialCost'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store the criterion its query
 * string carried and takes the rows as they come back — so this is a decision the connection has to
 * make rather than one it reproduces. It is the order a stock list is read in: the name ascending,
 * because that is how an asset is found among the organization's others. The creation instant and then
 * the identifier follow it, because two assets may share a name and the last key is what makes the
 * order total and a cursor walk over it stable.
 */
const EQUIPMENT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The equipment of an organization over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `EquipmentService` method the `/api/equipment` route behind it
 * calls, with the same payload. The create and the edit reach that service rather than dispatching a
 * command because the routes do — there is no command for either — and the two of them reach the same
 * method, which is the platform's own upsert.
 *
 * **The guard chain and the permission are the controller's.** The controller guards its class with
 * `TenantPermissionGuard` alone and states no permission on the class or on any handler, so this
 * resolver carries that one guard and no field states a permission. That is not an omission: a field
 * that stated a grant the route does not ask for would narrow REST below GraphQL, and an empty
 * `@Permissions()` would restate the same absence as though it were a decision this surface had made.
 * What decides who reaches these rows is the same on both protocols — the guard chain above and the
 * tenant the service applies from the credential.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's own, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here
 * because the value has to agree with the catalogue's `code` and nothing checks one string against
 * another: a literal that drifted names a code no catalogue row carries, which the guard resolves as
 * disabled, so every field below would answer `Cannot query field <name>` for every caller with
 * nothing red anywhere. One statement on the class is what puts every field behind it — the guard reads
 * the metadata with `getAllAndOverride` over the handler and then the class — and its effect is the
 * REST one in this protocol's vocabulary: a tenant that switched the capability off is answered
 * `Cannot query field <name>`, the same refusal a disabled capability's routes answer with a 404.
 *
 * **The amounts are the row's own.** Nothing here rescales, rounds or reformats one: the numeric
 * columns are read through the platform's numeric transformer and the values travel as they were read,
 * and an amount is written as the exact decimal the schema states it as, so an asset recorded over this
 * protocol carries the digits it was given rather than a binary fraction that approximates them. The
 * arithmetic over them is the platform's money layer's, and no field here performs any.
 *
 * This resolver is declared by `EquipmentModule`, beside the service it calls, so the GraphQL host can
 * scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('Equipment')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EquipmentResolver {
	constructor(private readonly equipmentService: EquipmentService) {}

	/**
	 * The equipment of the caller's tenant, in name order.
	 *
	 * The reader takes the query DTO the list route binds its query string to. This surface has no
	 * query string to bind: the connection protocol states the same narrowing in `filter`, which is
	 * applied to the rows the service returns, so the read runs with the route's own defaults — no
	 * `where` and no `relations`.
	 */
	@Query('equipments')
	async equipments(
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
	): Promise<GraphqlConnection<Equipment>> {
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<Equipment>;
		const { items }: IPagination<Equipment> = await this.equipmentService.findAll(options);

		return buildConnection<Equipment>({
			rows: items ?? [],
			filterable: EQUIPMENT_FILTERABLE,
			sortable: EQUIPMENT_SORTABLE,
			defaultSort: EQUIPMENT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One asset of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary. The route's own `data` query string can name relations to load; this
	 * surface has no query string to bind, so the read states none and runs with the route's own
	 * default — which is what the object type's own members are the columns of.
	 */
	@Query('equipment')
	async equipment(@Args('id', { type: () => ID }) id: Id): Promise<Equipment | null> {
		try {
			return await this.equipmentService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many assets the caller's tenant tracks.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument
	 * of that shape, so the field states no narrowing of its own. The tenant is applied to the criterion
	 * by the service, from the credential rather than from the caller.
	 */
	@Query('equipmentCount')
	async equipmentCount(): Promise<number> {
		return await this.equipmentService.countBy();
	}

	/**
	 * Files an asset.
	 *
	 * The same service call the REST create route makes, with the same payload: the members the caller
	 * states, the facets as the identifiers the pivot row is written from, and the asset as the
	 * identifier the foreign key holds. The tenant is stamped by the service from the credential and is
	 * never a member the caller can choose.
	 */
	@Mutation('createEquipment')
	async createEquipment(@Args('input') input: ICreateEquipmentInput): Promise<Equipment> {
		return await this.equipmentService.create(this.writePayload(input) as unknown as Equipment);
	}

	/**
	 * Changes an asset that exists.
	 *
	 * The delivered edit spreads the body beside the identifier the route reads from the path and hands
	 * the result to the same save the create uses, so the field states one identifier and leaves neither
	 * reading undefined. Its answer is that save's answer — the row — and because the save merges what it
	 * is given onto the row the store holds, a member the caller omits is left as it is.
	 */
	@Mutation('updateEquipment')
	async updateEquipment(@Args('input') input: IUpdateEquipmentInput): Promise<Equipment> {
		const { id, ...values } = input;

		return await this.equipmentService.create({ ...this.writePayload(values), id } as unknown as Equipment);
	}

	/**
	 * Removes an asset outright.
	 *
	 * The same service method the inherited removal route calls. The delivered store answers its own
	 * delete result — a statement about the write, `{ affected }` — which is not a row and not what a
	 * field named `deleteEquipment` may return; the field answers the one fact the removal establishes,
	 * that it ran.
	 */
	@Mutation('deleteEquipment')
	async deleteEquipment(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.equipmentService.delete(id);

		return true;
	}

	/**
	 * Withdraws an asset without removing the row.
	 *
	 * No permission is stated on the field beyond what the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level declaration — none — is the whole of its scope. The delivered route
	 * passes the service the empty option list that leaves, so the field states none either.
	 */
	@Mutation('softDeleteEquipment')
	async softDeleteEquipment(@Args('id', { type: () => ID }) id: Id): Promise<Equipment> {
		return await this.equipmentService.softRemove(id);
	}

	/**
	 * Puts a withdrawn asset back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverEquipment')
	async recoverEquipment(@Args('id', { type: () => ID }) id: Id): Promise<Equipment> {
		return await this.equipmentService.softRecover(id);
	}

	/**
	 * The payload the delivered write stores.
	 *
	 * The asset and the facets are handed over as the identifiers the row and the pivot are written
	 * from, never as related rows: the delivered write persists a foreign key and a pair of identifiers.
	 * The tenant is deliberately not among the members the caller states, because the service stamps the
	 * caller's own tenant onto the row and refuses a row that belongs to another one. No amount is
	 * touched here: the exact decimal the caller stated is the value the write receives.
	 */
	private writePayload(
		input: Omit<ICreateEquipmentInput, 'id'> | IUpdateEquipmentInput
	): Partial<Equipment> {
		const { tagIds, imageId, ...values } = input;

		return {
			...values,
			...(imageId ? { image: { id: imageId } } : {}),
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
		} as unknown as Partial<Equipment>;
	}
}
