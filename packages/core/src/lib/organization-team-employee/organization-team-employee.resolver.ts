import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IOrganizationTeamEmployeeActiveTaskUpdateInput,
	IOrganizationTeamEmployeeFindInput,
	IOrganizationTeamEmployeeUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

/**
 * The members `UpdateOrganizationTeamEmployeeInput` declares in the schema.
 *
 * The identifier is not among them: the delivered route carries it in its path, and the field states
 * it as its own argument, so a payload can never name a different membership than the path.
 */
export interface IUpdateOrganizationTeamEmployeeInput {
	organizationId: Id;
	organizationTeamId: Id;
	activeTaskId?: Id;
	isTrackingEnabled?: boolean;
	order?: number;
}

/** The members `OrganizationTeamEmployeeActiveTaskInput` declares in the schema. */
export interface IOrganizationTeamEmployeeActiveTaskInput {
	organizationId: Id;
	organizationTeamId: Id;
	activeTaskId?: Id;
}

/** The members `OrganizationTeamEmployeeDeleteInput` declares in the schema. */
export interface IOrganizationTeamEmployeeDeleteInput {
	organizationId: Id;
	organizationTeamId: Id;
}

/**
 * The organization team membership over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `OrganizationTeamEmployeeService` method the
 * `/api/organization-team-employee` routes reach, with the same arguments and the same refusals.
 *
 * **This surface is three mutations and no query field at all, and that shape is the delivery.** The
 * delivered controller is a plain controller rather than a resource controller: it declares no list
 * route, no single-row route and no count route, because a membership has no meaning outside the team
 * it belongs to and the roster is read from the team's own surface. The three writes below are the
 * whole of what it serves, so they are the whole of what is declared here — a connection would be a
 * list no delivered route serves, and a second surface with no counterpart to be held to is exactly
 * what the two-protocol rule forbids. The object type the three fields answer with stays reachable in
 * the composed schema because they reference it, so nothing this domain declares is an orphan.
 *
 * **The guard chain and the permissions are the controller's.** The delivered class carries
 * `TenantPermissionGuard` and `PermissionGuard`, and it states `ALL_ORG_EDIT` with `ORG_TEAM_EDIT` as
 * its class permissions; this class states that same chain with `FeatureFlagGuard` appended to it, and
 * those same two class permissions. Every field then states the permissions its own route runs under,
 * read from the route's own declaration rather than restated from the class: the edit keeps the class
 * pair, the active-task edit replaces the second member with `ORG_TEAM_EDIT_ACTIVE_TASK`, and the
 * removal replaces it with `ORG_TEAM_DELETE`. No field is therefore narrower or wider than the route
 * it mirrors.
 *
 * **Two fields answer with the row read back rather than with the update envelope.** The delivered
 * routes answer with the platform's `UpdateResult`, whose one member a caller reads is the number of
 * rows the write reached — a count this schema does not carry as a scalar, and one that says nothing
 * a client acts on, because a write that reached no row is a miss the delivered service raises as
 * such rather than an answer of `0`. Each field performs the same write and then reads the row back
 * through the same find-by-identifier the platform's own read of one row uses.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationTeamEmployee')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
export class OrganizationTeamEmployeeResolver {
	constructor(private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService) {}

	/**
	 * Edits a membership: the position of the member in the roster, whether the tracker records that
	 * member's time for the team, and the task the member is working on.
	 *
	 * The write is the one the delivered route performs, with the same path identifier and the same
	 * body, and it reads the row before it writes: a membership of another tenant, in another
	 * organization or in another team is answered with the refusal the delivered service raises rather
	 * than with a write under an identifier the caller does not own.
	 *
	 * The answer is the row read back rather than the update envelope the delivered route answers with;
	 * see the class comment for why the count that envelope carries is not a member here.
	 */
	@Mutation('updateOrganizationTeamEmployee')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	async updateOrganizationTeamEmployee(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IUpdateOrganizationTeamEmployeeInput
	): Promise<OrganizationTeamEmployee> {
		await this.organizationTeamEmployeeService.update(id, input as unknown as IOrganizationTeamEmployeeUpdateInput);

		return await this.organizationTeamEmployeeService.findOneByIdString(id);
	}

	/**
	 * Moves a member onto a different task.
	 *
	 * The write is the delivered method's own, with the same body, and that method is also where the
	 * right to change a member is decided: a caller holding the selected-employee permission may move
	 * any member the scope names, a manager of the team may move any of its members, and everyone else
	 * may move only themselves. None of that is restated here — the field reaches the same method the
	 * route reaches and is refused by the same rules, with the refusal the same service raises.
	 *
	 * The answer is the row read back, for the reason the edit above states.
	 */
	@Mutation('updateOrganizationTeamEmployeeActiveTask')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK)
	async updateOrganizationTeamEmployeeActiveTask(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IOrganizationTeamEmployeeActiveTaskInput
	): Promise<OrganizationTeamEmployee> {
		await this.organizationTeamEmployeeService.updateActiveTask(
			id,
			input as unknown as IOrganizationTeamEmployeeActiveTaskUpdateInput
		);

		return await this.organizationTeamEmployeeService.findOneByIdString(id);
	}

	/**
	 * Removes a membership.
	 *
	 * The tasks the member held in this team are unassigned before the row goes, and the employee's own
	 * record is untouched: what is removed is the fact that this employee is on this team. The removal
	 * reaches a membership of the caller's own tenant, in the organization and the team the options
	 * name, which is the scope the delivered service builds its criteria from — the identifier alone
	 * does not name a row, and a membership of another scope is not reached.
	 *
	 * The answer is the fact of the removal. The delivered route answers with the deletion result,
	 * whose one member a caller reads is that the row is gone — the number of rows it reached — and a
	 * boolean is that fact in a scalar this schema declares. A membership that is not there is the miss
	 * the delivered service raises rather than a `false` answered from here, so a caller never has to
	 * tell "nothing was removed" from "the removal did not happen".
	 */
	@Mutation('deleteOrganizationTeamEmployee')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_DELETE)
	async deleteOrganizationTeamEmployee(
		@Args('id', { type: () => ID }) id: Id,
		@Args('options') options: IOrganizationTeamEmployeeDeleteInput
	): Promise<boolean> {
		await this.organizationTeamEmployeeService.deleteTeamMember(
			id,
			options as unknown as IOrganizationTeamEmployeeFindInput
		);

		return true;
	}
}
