import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IContactGroupMember, IContactGroupMemberFindInput, ID, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupService } from '../contact-group/contact-group.service';
import { ContactGroupMemberService } from './contact-group-member.service';
import { ContactGroupMemberQueryDTO, ReplaceGroupMembersDTO } from './dto';

/**
 * The live membership of one group, as this controller answers it.
 *
 * The pivot's rows plus the count, which is the shape the endpoint table's membership row names. The
 * count is carried rather than left to the client to take the length of the list, because it is the
 * same number whether the caller asked for a page of memberships or for all of them.
 */
export interface IContactGroupMembership {
	/** The live memberships, oldest first. */
	readonly members: IContactGroupMember[];
	/** How many parties are live members of the group. */
	readonly memberCount: number;
}

/**
 * Group membership over REST.
 *
 * **The membership is a child of the group, so its routes hang off the group's path** — the same
 * convention §7.5a uses for an address's roles. They are served by *this* domain rather than by the
 * group controller, and that is a module fact rather than a preference: the membership module imports
 * the group module, so the group's controller cannot reach the pivot's service without closing a
 * module cycle, while this controller can reach both.
 *
 * **`assertMembershipWritable` is the gate, and this class calls it rather than asking what kind of
 * group it holds.** The rule is that a rule-based group's membership is computed from its rules and is
 * never materialised, so a hand-written row in one is refused — and the refusal belongs to the group
 * service, which is the only place that knows what the kinds mean. The gate is opened once, before
 * either half of a write, so a body that only removes memberships is refused on a rule-based group
 * exactly as one that adds them is; a controller that tested `group.type` itself would be a second,
 * drifting statement of the rule.
 *
 * **The write is a patch, not a replacement set.** The delivered service offers `addMembers` and
 * `removeMember`, and the endpoint table's `add[]` / `remove[]` is exactly those two: the removals are
 * applied first so that changing a member's window is one call, and the whole addition list is
 * validated before any of it is written, so a refused body leaves the group exactly as it was. A
 * *replacement* set would need a service operation that does not exist, and composing one here out of
 * reads and writes would be a set operation with no transaction behind it — the half-applied state the
 * channel's region replacement exists to avoid.
 *
 * **What the membership read answers is the pivot's live rows only.** A membership whose window has
 * closed is absent to every reader, so it is absent here; `includeExpired` is the administrative
 * spelling that shows what the cleanup job has not yet removed. The count follows the same rule, which
 * is why it is taken from the liveness-filtered list rather than from a row count.
 */
@ApiTags('ContactGroupMember')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
@Controller('/contact-groups')
export class ContactGroupMemberController {
	constructor(
		private readonly contactGroupMemberService: ContactGroupMemberService,
		private readonly contactGroupService: ContactGroupService
	) {}

	/**
	 * Lists the live membership of one group.
	 *
	 * @param id The group to read.
	 * @param query The narrowing and the page to read.
	 * @returns The group's memberships and the count of them.
	 */
	@ApiOperation({ summary: "List a group's members" })
	@ApiResponse({ status: HttpStatus.OK, description: 'Members retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_GROUP_NOT_FOUND, CONTACT_GROUP_MEMBER_NOT_FOUND' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	@Get(':id/members')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Param('id', UUIDValidationPipe) id: ID, @Query() query?: ContactGroupMemberQueryDTO): Promise<IContactGroupMembership> {
		// The group is resolved first so that a miss is the group's own code rather than an empty page:
		// a caller that named a group which does not exist must not be told the group is empty.
		await this.contactGroupService.findGroupOrFail(id);

		const members = await this.contactGroupMemberService.listMembers(id, this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);

		// The count is the live membership, not the page: a membership whose window has closed is absent
		// to every reader, and it is absent from this number for the same reason.
		return { members: paginateRows(members, take, skip).items, memberCount: members.length };
	}

	/**
	 * Patches the membership of one group, as the endpoint table describes it.
	 *
	 * @param id The group whose membership changes.
	 * @param entity The parties joining and the parties leaving.
	 * @returns The group's membership afterwards, and the count of it.
	 */
	@ApiOperation({ summary: "Add and remove a group's members" })
	@ApiResponse({ status: HttpStatus.OK, description: 'Membership updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'CONTACT_GROUP_MEMBER_INVALID' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_GROUP_NOT_FOUND, CONTACT_GROUP_MEMBER_NOT_FOUND' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id/members')
	@UseValidationPipe({ transform: true, whitelist: true })
	async replace(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: ReplaceGroupMembersDTO): Promise<IContactGroupMembership> {
		// The gate, opened once for both halves of the write: the rule that a rule-based group's
		// membership is computed and never materialised is the group service's, and this class asks it
		// rather than reading the group's kind itself.
		this.contactGroupService.assertMembershipWritable(await this.contactGroupService.findGroupOrFail(id));

		for (const member of entity?.remove ?? []) {
			await this.contactGroupMemberService.removeMember(id, member.contactId, member.source);
		}

		if ((entity?.add ?? []).length > 0) {
			await this.contactGroupMemberService.addMembers(
				id,
				(entity?.add ?? []).map((member) => ({ customerId: member.contactId, expiresAt: member.expiresAt }))
			);
		}

		const members = await this.contactGroupMemberService.listMembers(id);

		return { members, memberCount: members.length };
	}

	/**
	 * The narrowing members of the list query, from whichever spelling stated them.
	 *
	 * `includeExpired` is kept when it is stated and only when it is stated: the service's own default
	 * is "live memberships only", which is the answer every other reader of the pivot gets, and a
	 * route that wrote `false` explicitly would be stating the same thing twice.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: ContactGroupMemberQueryDTO): IContactGroupMemberFindInput {
		const stated: IContactGroupMemberFindInput = {};
		const source = query?.source ?? query?.filter?.source;

		if (source !== undefined && source !== null) {
			stated.source = source;
		}

		const includeExpired = query?.includeExpired ?? query?.filter?.includeExpired;

		if (includeExpired !== undefined && includeExpired !== null) {
			stated.includeExpired = includeExpired;
		}

		return stated;
	}
}
