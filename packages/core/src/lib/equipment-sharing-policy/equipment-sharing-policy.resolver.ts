import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';

/** The members `CreateEquipmentSharingPolicyInput` declares in the schema. */
export interface ICreateEquipmentSharingPolicyInput {
	name: string;
	description?: string;
	organizationId: Id;
}

/**
 * The members `UpdateEquipmentSharingPolicyInput` declares in the schema.
 *
 * The delivered create and the delivered edit bind the same DTO, so this input carries the same members
 * as the one above — with the identifier stated beside them — and the difference between the two is the
 * one the routes themselves have: only the create runs a validation pipe, and the edit writes the
 * columns the body states rather than replacing the row, so the name is required there and optional
 * here.
 */
export interface IUpdateEquipmentSharingPolicyInput extends Partial<ICreateEquipmentSharingPolicyInput> {
	id: Id;
	organizationId: Id;
}

/**
 * The fields a policy list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EquipmentSharingPolicyFilter` and
 * `EquipmentSharingPolicySortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every member is a column of the row, which is why the set is what it is: the connection narrows the
 * rows the delivered read returned. The periods filed under a policy are not filterable, because the
 * delivered list read is handed no relations and a condition on that collection could only ever match
 * the empty set. `deletedAt` is absent because the delivered list read answers live rows only, and the
 * tenant is absent because the read applies it from the credential rather than from the caller.
 */
const EQUIPMENT_SHARING_POLICY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EQUIPMENT_SHARING_POLICY_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store the criterion its query DTO
 * carried and takes the rows as they come back — so this is a decision the connection has to make rather
 * than one it reproduces. The name is what a vocabulary is scanned by, so the policies stand in it; the
 * identifier follows, because a vocabulary may hold two policies a tenant named alike and the last key
 * is what makes the order total and a cursor walk over it stable.
 */
const EQUIPMENT_SHARING_POLICY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The vocabulary a sharing period is filed under, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `EquipmentSharingPolicyService` method the
 * `/api/equipment-sharing-policy` route behind it calls, with the same payload.
 *
 * **The guard chain and the permission are the controller's, field by field.** The class carries what
 * the controller class carries — both guards, and the class-level pair — and every field then states the
 * pair its own route runs under, so a field is never narrower or wider than the route it mirrors. The
 * count, the node read and the two lifecycle moves are inherited from the CRUD base without a
 * permission of their own, so they run under the controller's class-level pair, and the fields state
 * that same pair rather than stating nothing. Only the two reads state the view pair, because only their
 * routes do, and only the create states the add permission, because it is the one write whose route
 * holds it.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused as
 * a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here because
 * the value has to agree with the catalogue's `code` and nothing checks one string against another: a
 * literal that drifted names a code no catalogue row carries, which the guard resolves as disabled, so
 * every field below would answer `Cannot query field <name>` for every caller with nothing red anywhere.
 * One statement on the class is what puts every field behind it — the guard reads the metadata with
 * `getAllAndOverride` over the handler and then the class — and its effect is the REST one in this
 * protocol's vocabulary: a tenant that switched the capability off is answered `Cannot query field
 * <name>`, the same refusal a disabled capability's routes answer with a 404.
 *
 * This resolver is declared by `EquipmentSharingPolicyModule`, beside the service it calls, so the
 * GraphQL host can scan that module for it — a resolver injects services, and a module is what reaches
 * them.
 */
@Resolver('EquipmentSharingPolicy')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
export class EquipmentSharingPolicyResolver {
	constructor(private readonly equipmentSharingPolicyService: EquipmentSharingPolicyService) {}

	/**
	 * The sharing policies of the caller's organization, in name order.
	 *
	 * The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
	 * question, so the surface states it once: a second root field for the paginated spelling would be a
	 * second surface that could disagree with this one, and the connection's own `limit`/`offset`
	 * already are the page it performs.
	 */
	@Query('equipmentSharingPolicies')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW)
	async equipmentSharingPolicies(
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
	): Promise<GraphqlConnection<EquipmentSharingPolicy>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults.
		const { items }: IPagination<EquipmentSharingPolicy> =
			await this.equipmentSharingPolicyService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<EquipmentSharingPolicy>);

		return buildConnection<EquipmentSharingPolicy>({
			rows: items ?? [],
			filterable: EQUIPMENT_SHARING_POLICY_FILTERABLE,
			sortable: EQUIPMENT_SHARING_POLICY_SORTABLE,
			defaultSort: EQUIPMENT_SHARING_POLICY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One policy of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('equipmentSharingPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	async equipmentSharingPolicy(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EquipmentSharingPolicy | null> {
		try {
			return await this.equipmentSharingPolicyService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many policies the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument
	 * of that shape, so the field states no narrowing of its own. The tenant is applied to the criterion
	 * by the service, from the credential rather than from the caller.
	 */
	@Query('equipmentSharingPolicyCount')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	async equipmentSharingPolicyCount(): Promise<number> {
		return await this.equipmentSharingPolicyService.countBy();
	}

	/**
	 * Files a policy.
	 *
	 * The same service call the REST create route makes, with the same payload: the name the route
	 * validates, the note beside it and the organization the row is filed under. The tenant is stamped by
	 * the service from the credential and is never stated by the caller.
	 */
	@Mutation('createEquipmentSharingPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD)
	async createEquipmentSharingPolicy(
		@Args('input') input: ICreateEquipmentSharingPolicyInput
	): Promise<EquipmentSharingPolicy> {
		return await this.equipmentSharingPolicyService.create(
			input as unknown as EquipmentSharingPolicy
		);
	}

	/**
	 * Changes a policy that exists.
	 *
	 * The same service method the REST edit route calls, and it reads the row before it writes: a policy
	 * of another tenant, or one that is not there, is answered with the miss rather than with a write
	 * against a row the caller does not own. The identifier is the criterion and is not repeated in the
	 * payload, which is the shape the route itself has — `:id` names the row and the body carries what
	 * changes, and the delivered write updates the stated columns and leaves the rest as they are.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not a
	 * row and not what a field named `updateEquipmentSharingPolicy` may return.
	 */
	@Mutation('updateEquipmentSharingPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	async updateEquipmentSharingPolicy(
		@Args('input') input: IUpdateEquipmentSharingPolicyInput
	): Promise<EquipmentSharingPolicy> {
		const { id, ...values } = input;

		await this.equipmentSharingPolicyService.update(
			id,
			values as unknown as QueryDeepPartialEntity<EquipmentSharingPolicy>
		);

		return await this.equipmentSharingPolicyService.findOneByIdString(id);
	}

	/**
	 * Removes a policy outright.
	 *
	 * The same service method the inherited removal route calls. The delivered store answers its own
	 * delete result — a statement about the write, `{ affected }` — which is not a row and not what a
	 * field named `deleteEquipmentSharingPolicy` may return; the field answers the one fact the removal
	 * establishes, that it ran. A policy a sharing period still points at is the store's own constraint to
	 * refuse, and this field does not pre-empt it.
	 */
	@Mutation('deleteEquipmentSharingPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	async deleteEquipmentSharingPolicy(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.equipmentSharingPolicyService.delete(id);

		return true;
	}

	/**
	 * Withdraws a policy without removing the row.
	 *
	 * No permission is stated on the field beyond the pair the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * class-level pair is the whole of its scope.
	 */
	@Mutation('softDeleteEquipmentSharingPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	async softDeleteEquipmentSharingPolicy(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EquipmentSharingPolicy> {
		return await this.equipmentSharingPolicyService.softRemove(id);
	}

	/**
	 * Puts a withdrawn policy back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverEquipmentSharingPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	async recoverEquipmentSharingPolicy(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EquipmentSharingPolicy> {
		return await this.equipmentSharingPolicyService.softRecover(id);
	}
}
