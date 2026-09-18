import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ContactGroupSource, IContactGroup, IContactGroupMember, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupService } from '../contact-group/contact-group.service';
import { ContactGroupMemberService } from './contact-group-member.service';

/**
 * One party joining a group, as the mutation states it.
 */
export interface IContactGroupMemberAddInput {
	contactId: Id;
	expiresAt?: Date;
}

/**
 * The members `AddContactGroupMembersInput` declares in the schema.
 */
export interface IAddContactGroupMembersInput {
	groupId: Id;
	members: IContactGroupMemberAddInput[];
}

/**
 * One party leaving a group, and which of its memberships is meant.
 */
export interface IContactGroupMemberRemoveInput {
	contactId: Id;
	source?: ContactGroupSource;
}

/**
 * The members `RemoveContactGroupMembersInput` declares in the schema.
 */
export interface IRemoveContactGroupMembersInput {
	groupId: Id;
	members: IContactGroupMemberRemoveInput[];
}

/**
 * Group membership over GraphQL.
 *
 * **This resolver is attached to the `ContactGroup` type rather than to the pivot's own**, and that is
 * the module graph being honest rather than a naming choice: a field resolver answers a field of the
 * type it is attached to, and the two fields it answers — `members` and `memberCount` — are fields of a
 * group. The class is declared by the membership module, which imports the group module, so it can
 * reach both services; the group module cannot reach this one without closing a cycle, which is why the
 * membership of a group is not resolved beside the rest of the group's fields.
 *
 * **The mutations are the two operations the delivered service owns**, and they are the same ones the
 * REST membership route performs: `addContactGroupMembers` writes hand-written memberships and refuses
 * a rule-based group, and `removeContactGroupMembers` removes the membership of the stated provenance
 * — an operator removes the hand-written row and never the derived one an evaluation owns.
 *
 * **The membership is never a materialised set.** A rule-based group's membership is computed from its
 * rules, so neither mutation can write one by hand: the addition path is gated inside `addMembers`, which
 * resolves the group and asks whether its kind allows the write, and the removal path opens the same gate
 * here before its first removal — because a removal is not gated by that service method, and a write that
 * half-ran before the refusal would be exactly the materialised membership the rule forbids. Neither
 * path reads the group's kind and decides for itself.
 *
 * **The count is the pivot's answer, not a row count.** A membership whose window has closed is absent
 * to every reader, so counting rows would report members the platform does not have — which is why
 * `memberCount` is the length of the liveness-filtered membership list and not a `COUNT` over the table.
 */
@Resolver('ContactGroup')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
export class ContactGroupMemberResolver {
	constructor(
		private readonly contactGroupMemberService: ContactGroupMemberService,
		private readonly contactGroupService: ContactGroupService
	) {}

	/**
	 * Makes several parties members of a group by hand.
	 */
	@Mutation('addContactGroupMembers')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_EDIT)
	async addContactGroupMembers(
		@Args('input') input: IAddContactGroupMembersInput
	): Promise<IContactGroupMember[]> {
		return this.contactGroupMemberService.addMembers(
			input.groupId,
			(input.members ?? []).map((member) => ({
				customerId: member.contactId,
				expiresAt: member.expiresAt
			}))
		);
	}

	/**
	 * Removes the membership of several parties, each of the provenance the caller states.
	 */
	@Mutation('removeContactGroupMembers')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_EDIT)
	async removeContactGroupMembers(
		@Args('input') input: IRemoveContactGroupMembersInput
	): Promise<IContactGroupMember[]> {
		// The gate is opened once, before the first removal, so a rule-based group refuses the write
		// whatever provenance the body names.
		this.contactGroupService.assertMembershipWritable(await this.contactGroupService.findGroupOrFail(input.groupId));

		const removed: IContactGroupMember[] = [];

		for (const member of input?.members ?? []) {
			removed.push(await this.contactGroupMemberService.removeMember(input.groupId, member.contactId, member.source));
		}

		return removed;
	}

	/**
	 * The live membership of one group, oldest first.
	 *
	 * The group arrives as the parent of the selection, so the field is answered for the row the client
	 * actually selected rather than for an argument it repeated. A group that has been soft-deleted
	 * still answers its membership while the rows are recoverable, which is what makes a removed group's
	 * effect on a price list auditable.
	 */
	@ResolveField('members')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	async members(@Parent() group: IContactGroup): Promise<IContactGroupMember[]> {
		return this.contactGroupMemberService.listMembers(group.id);
	}

	/**
	 * How many parties are live members of one group.
	 */
	@ResolveField('memberCount')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	async memberCount(@Parent() group: IContactGroup): Promise<number> {
		return (await this.contactGroupMemberService.listMembers(group.id)).length;
	}
}
