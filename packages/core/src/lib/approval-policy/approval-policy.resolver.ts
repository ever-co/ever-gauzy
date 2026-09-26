import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyService } from './approval-policy.service';
import { ApprovalPolicyCreateCommand, ApprovalPolicyGetCommand, ApprovalPolicyUpdateCommand } from './commands';

/** The members `CreateApprovalPolicyInput` declares in the schema. */
export interface ICreateApprovalPolicyInput {
	name: string;
	description?: string;
	organizationId: Id;
}

/** The members `UpdateApprovalPolicyInput` declares in the schema. */
export interface IUpdateApprovalPolicyInput {
	id: Id;
	name: string;
	description?: string;
	organizationId: Id;
}

/**
 * The fields a policy list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ApprovalPolicyFilter` and
 * `ApprovalPolicySortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * Every member is a column of the policy row, which is why the set is what it is: the delivered read
 * answers the rows the command's own `where` selected and joins only the relations a REST caller names
 * in its query string — which this surface never names — so each member here narrows the rows the
 * connection was handed rather than a collection a reader would have had to load.
 *
 * `approvalType` is the member the folded sub-route is expressed with. The delivered request-approval
 * reader excludes two codes from the whole set; excluding them here is the same condition on the same
 * column, which is why that route is a narrowing of this connection rather than a root field of its
 * own.
 */
const APPROVAL_POLICY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	approvalType: 'STRING',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const APPROVAL_POLICY_SORTABLE = ['id', 'name', 'approvalType', 'createdAt', 'updatedAt', 'deletedAt'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * Neither the delivered list read nor the paginated one states a total order of its own — the query is
 * handed and the rows are taken as they come back — so this is the platform's own: newest first, with
 * the identifier as the last key so that two policies filed in the same millisecond still have one
 * order between them, which is what makes a cursor walk over them total.
 */
const APPROVAL_POLICY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The approval policy over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below dispatches the same command, or calls the same `ApprovalPolicyService`
 * method, that the `/api/approval-policy` routes call.
 *
 * **The class states the permission the controller states on its class**, and every field then states
 * the permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. The asymmetry that leaves behind is the controller's own and is reproduced rather than
 * resolved: the list and the paginated list declare `APPROVAL_POLICY_VIEW` on their handlers, while
 * every route the controller inherits from the CRUD base declares nothing and therefore runs under the
 * class-level `APPROVAL_POLICY_EDIT`. Reading one policy is thus the narrower grant and listing them
 * the wider one — which is why `approvalPolicy`, `approvalPolicyCount`, the two removals and the
 * recovery all carry the edit permission here. A field that stated the view permission because it
 * reads would serve a caller the REST route refuses; widening the matter is a change to make in both
 * places at once, and it is not this delivery's to make.
 *
 * **The delivered `GET /request-approval` route is the list, narrowed.** Its reader selects the
 * policies whose `approvalType` is neither `TIME_OFF` nor `EQUIPMENT_SHARING` — a condition on a column
 * every row of this connection carries — and joins no pivot the list read does not join, so the
 * capability is `approvalPolicies` with `approvalType: { nin: […] }` rather than a second root field
 * that could disagree with it about which policies a request form may offer.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it
 * is appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('ApprovalPolicy')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
export class ApprovalPolicyResolver {
	constructor(
		private readonly approvalPolicyService: ApprovalPolicyService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The policies of the caller's tenant, newest first.
	 *
	 * The read is the one the list route performs, dispatched as the same command: the route binds its
	 * query string into that command's options and this surface has no query string to bind, so the
	 * command runs with the route's own defaults — an empty option object — and the connection protocol
	 * states the narrowing in `filter`, which is applied to the rows the command returns.
	 */
	@Query('approvalPolicies')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_VIEW)
	async approvalPolicies(
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
	): Promise<GraphqlConnection<ApprovalPolicy>> {
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<ApprovalPolicy>;
		const { items }: IPagination<ApprovalPolicy> = await this.commandBus.execute(
			new ApprovalPolicyGetCommand(options)
		);

		return buildConnection<ApprovalPolicy>({
			rows: items ?? [],
			filterable: APPROVAL_POLICY_FILTERABLE,
			sortable: APPROVAL_POLICY_SORTABLE,
			defaultSort: APPROVAL_POLICY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One policy of the caller's tenant.
	 *
	 * A policy that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 *
	 * The edit permission is stated because the route this field mirrors states nothing of its own: it
	 * is inherited from the base controller, so it runs under the class-level edit permission the
	 * controller declares. Reading one policy costing more than listing them is the controller's
	 * decision and this field reproduces it rather than widening a route on one protocol.
	 */
	@Query('approvalPolicy')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	async approvalPolicy(@Args('id', { type: () => ID }) id: Id): Promise<ApprovalPolicy | null> {
		try {
			return await this.approvalPolicyService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many policies the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows. The edit permission is stated for the reason the node query states it.
	 */
	@Query('approvalPolicyCount')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	async approvalPolicyCount(): Promise<number> {
		return await this.approvalPolicyService.countBy();
	}

	/**
	 * Files a policy.
	 *
	 * The write is dispatched as the same command the REST route dispatches, carrying the same body, so
	 * the two surfaces derive the same code for the same label: `approvalType` is derived from the name
	 * inside the handler and is deliberately not an input member, and the tenant is stamped from the
	 * credential rather than stated.
	 */
	@Mutation('createApprovalPolicy')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	async createApprovalPolicy(@Args('input') input: ICreateApprovalPolicyInput): Promise<ApprovalPolicy> {
		return await this.commandBus.execute(new ApprovalPolicyCreateCommand(input));
	}

	/**
	 * Renames a policy.
	 *
	 * The delivered route carries the identifier in the path and the body beside it, and the command it
	 * dispatches holds the two as separate members; this field dispatches the same command with the same
	 * pair. The handler reads the row before it writes, so a policy of another tenant — or one that is
	 * not there — is answered with the miss rather than with a write that recreates it.
	 */
	@Mutation('updateApprovalPolicy')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	async updateApprovalPolicy(@Args('input') input: IUpdateApprovalPolicyInput): Promise<ApprovalPolicy> {
		return await this.commandBus.execute(new ApprovalPolicyUpdateCommand(input.id, input));
	}

	/**
	 * Removes a policy outright.
	 *
	 * The service is the one the REST route calls, and it refuses a caller naming a row of another
	 * tenant rather than reporting a deletion that did not happen; the field answers whether the removal
	 * happened rather than the removed row, because the delivered route answers the store's delete
	 * result.
	 */
	@Mutation('deleteApprovalPolicy')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	async deleteApprovalPolicy(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.approvalPolicyService.delete(id);

		return true;
	}

	/**
	 * Withdraws a policy: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteApprovalPolicy')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	async softDeleteApprovalPolicy(@Args('id', { type: () => ID }) id: Id): Promise<ApprovalPolicy> {
		return await this.approvalPolicyService.softRemove(id);
	}

	/**
	 * Puts a withdrawn policy back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverApprovalPolicy')
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	async recoverApprovalPolicy(@Args('id', { type: () => ID }) id: Id): Promise<ApprovalPolicy> {
		return await this.approvalPolicyService.softRecover(id);
	}
}
