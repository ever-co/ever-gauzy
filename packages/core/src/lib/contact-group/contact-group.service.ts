import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
	ContactGroupType,
	ID,
	IContactGroup,
	IContactGroupCreateInput,
	IContactGroupFindInput,
	IContactGroupUpdateInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ContactGroup } from './contact-group.entity';
import { TypeOrmContactGroupRepository } from './repository/type-orm-contact-group.repository';
import { MikroOrmContactGroupRepository } from './repository/mikro-orm-contact-group.repository';

/**
 * The groups a tenant segments its parties into, and the rules that govern them.
 *
 * Read the rules of this service as one rule about identity and three about the kind:
 *
 * 1. **A code is unique per organization among live rows.** It is what an integration maps its own
 *    segment vocabulary onto and what a rule names, so a second live row carrying it would make a price
 *    list resolve to whichever row the planner reached first. The partial index carries the rule and
 *    this service states it, because a violation has to be a named refusal rather than a driver error.
 * 2. **The code is trimmed, and a blank one is refused.** Whitespace is not a key: an integration that
 *    sent `" WHOLESALE "` and one that sent `"WHOLESALE"` mean the same group, and storing both would
 *    make the uniqueness rule true of the table and false of the tenant's intent. Two codes that differ
 *    only in **case** are the same group for the same reason, and for one more: the supported dialects
 *    do not agree about it — the default collation of one of them compares case-insensitively and the
 *    other does not — so the service compares case-insensitively on every dialect and the rule means
 *    one thing everywhere. The code is stored as the caller wrote it, because it is also a label an
 *    operator reads.
 * 3. **A system group is neither deletable nor re-codable.** The platform names those groups in its own
 *    logic — "guests" is the example the schema gives — and a tenant that could delete or re-code one
 *    would break a rule it cannot see. The flag itself is immutable in both directions: a caller cannot
 *    promote its own group to undeletable either.
 * 4. **Membership is written where the kind says it is.** A `STATIC` group's membership is its
 *    `contact_group_member` rows and they may be hand-written, imported and revoked; a `RULE_BASED`
 *    group's membership is computed from its rules and is never materialised, so a hand-written
 *    membership there is refused rather than stored and ignored — see
 *    {@link assertMembershipWritable}, which is the check the membership service calls on every write.
 *    Turning a static group into a segment is allowed, and refused while hand-written members exist:
 *    leaving them behind would be exactly the stale materialised membership the rule forbids.
 *
 * A group is deleted softly and never hard-deleted: a price list, a promotion and a rule may all name
 * it, and the rows that do keep working while it is recoverable.
 */
@Injectable()
export class ContactGroupService extends TenantAwareCrudService<ContactGroup> {
	/**
	 * Members a change may not silently rewrite, each with the operation that owns it. A body that
	 * states one is refused rather than ignored, because a caller that believes it made a group
	 * undeletable has a bug it would otherwise never see.
	 */
	private static readonly IMMUTABLE_MEMBERS = ['isSystem'];

	constructor(
		readonly typeOrmContactGroupRepository: TypeOrmContactGroupRepository,
		readonly mikroOrmContactGroupRepository: MikroOrmContactGroupRepository
	) {
		super(typeOrmContactGroupRepository, mikroOrmContactGroupRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Creates a group an operator maintains.
	 *
	 * @param input The group as the caller states it.
	 * @returns The stored group.
	 * @throws BadRequestException `CONTACT_GROUP_INVALID` when no code is stated, and
	 * `CONTACT_GROUP_CODE_TAKEN` when the code is already used by a live group of this organization.
	 */
	async createGroup(input: IContactGroupCreateInput): Promise<IContactGroup> {
		const code = this.normaliseCode(input?.code);

		await this.assertCodeAvailable(code);

		return this.create({
			...(input ?? {}),
			code,
			name: String(input?.name ?? '').trim(),
			type: input?.type ?? ContactGroupType.STATIC,
			discountPercent: this.assertDiscount(input?.discountPercent),
			// Stated rather than left to the column's default: a group written through a path that
			// ignores defaults would otherwise carry no statement about who maintains it.
			isSystem: false,
			...this.scope
		} as never);
	}

	/**
	 * Creates a group the platform maintains.
	 *
	 * The separate entry point is what makes {@link IContactGroup.isSystem} meaningful: the flag is
	 * written here and nowhere else, so no request body can produce it. It exists for the platform's own
	 * seeding, which is the only caller that is entitled to name a group an operator may not remove.
	 *
	 * @param input The group as the platform states it.
	 * @returns The stored group, flagged as a system group.
	 * @throws BadRequestException as {@link createGroup}.
	 */
	async createSystemGroup(input: IContactGroupCreateInput): Promise<IContactGroup> {
		const code = this.normaliseCode(input?.code);

		await this.assertCodeAvailable(code);

		return this.create({
			...(input ?? {}),
			code,
			name: String(input?.name ?? '').trim(),
			type: input?.type ?? ContactGroupType.STATIC,
			discountPercent: this.assertDiscount(input?.discountPercent),
			isSystem: true,
			...this.scope
		} as never);
	}

	/**
	 * Loads a group that belongs to the caller's organization.
	 *
	 * @param id The group id.
	 * @returns The group.
	 * @throws NotFoundException `CONTACT_GROUP_NOT_FOUND` when it does not exist inside the caller's scope.
	 */
	async findGroupOrFail(id: ID): Promise<IContactGroup> {
		const group = await this.findGroup(id);

		if (!group) {
			throw new NotFoundException(`${ApiErrorCode.CONTACT_GROUP_NOT_FOUND}: contact group '${id}' could not be found.`);
		}

		return group;
	}

	/**
	 * Reads one group of the caller's organization, answering null when there is none.
	 *
	 * The answering form exists because a caller resolving a group it was handed — a price resolution, a
	 * segment evaluation — treats the miss as an ordinary fact, while {@link findGroupOrFail} is for a
	 * caller that must honour the identifier it was given.
	 *
	 * @param id The group id.
	 * @returns The group, or null.
	 */
	async findGroup(id: ID): Promise<IContactGroup | null> {
		const groups: ContactGroup[] = await this.find({ where: { id, ...this.scope } } as never);

		return groups.length ? groups[0] : null;
	}

	/**
	 * Resolves a group by the code an integration or a rule addresses it by.
	 *
	 * The exact form is asked for first, because it is the form the index serves and the form every row
	 * this service wrote holds. A caller that capitalised the code differently pays one read of the
	 * organization's groups, which is bounded by configuration — see the class note on casing.
	 *
	 * @param code The group's code, in any casing or padding.
	 * @returns The group, or null.
	 */
	async findGroupByCode(code: string): Promise<IContactGroup | null> {
		const normalised = this.normaliseCode(code);
		const exact: ContactGroup[] = await this.find({ where: { code: normalised, ...this.scope } } as never);

		if (exact.length) {
			return exact[0];
		}

		const groups: ContactGroup[] = await this.find({ where: { ...this.scope } } as never);
		const key = ContactGroupService.codeKey(normalised);

		return groups.find((group) => ContactGroupService.codeKey(group.code) === key) ?? null;
	}

	/**
	 * Lists the groups of the caller's organization.
	 *
	 * @param filter Optional narrowing by kind, price list, maintenance or free text.
	 * @returns The groups, newest first.
	 */
	async listGroups(filter: IContactGroupFindInput = {}): Promise<IContactGroup[]> {
		const groups: ContactGroup[] = await this.find({
			where: {
				...(filter.type ? { type: filter.type } : {}),
				...(filter.priceListId ? { priceListId: filter.priceListId } : {}),
				...(filter.isSystem !== undefined ? { isSystem: filter.isSystem } : {}),
				...this.scope
			},
			order: { createdAt: 'DESC' }
		} as never);

		const search = filter.search ? filter.search.trim().toLowerCase() : '';

		if (!search) {
			return groups;
		}

		// The free-text narrowing is applied here rather than in the query on purpose: a `LIKE` over
		// three columns is spelled three different ways across the supported dialects, and a group list
		// is bounded by configuration, so it is read whole and filtered in the service.
		return groups.filter((group) =>
			[group.name, group.code, group.description]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(search))
		);
	}

	/**
	 * Changes a group's descriptive facts.
	 *
	 * The code is refused on a system group, because the platform's own logic addresses those groups by
	 * code; the maintenance flag is refused on every group, because it is the platform's statement and
	 * not an operator's. Turning a static group into a rule-based one is allowed, and refused while
	 * hand-written member rows exist: a rule-based group's membership is computed and never
	 * materialised, so keeping the hand-written rows would leave exactly the stale membership the
	 * segmentation rule forbids. The caller supplies that count, because membership is read through the
	 * membership service and this service does not import it — see the class note on the pivot.
	 *
	 * @param id The group to change.
	 * @param input The facts to change.
	 * @param manualMemberCount How many hand-written member rows the group currently has, when the
	 * caller has resolved them. Absent means "not resolved", and the change is allowed.
	 * @returns The stored group.
	 * @throws BadRequestException `CONTACT_GROUP_SYSTEM` when the code of a system group is changed or
	 * the maintenance flag is touched, `CONTACT_GROUP_CODE_TAKEN` when the new code is in use, and
	 * `CONTACT_GROUP_MEMBER_INVALID` when a hand-written membership would be left behind by a change of
	 * kind.
	 * @throws NotFoundException when the group is not in the caller's scope.
	 */
	async updateGroup(id: ID, input: IContactGroupUpdateInput, manualMemberCount = 0): Promise<IContactGroup> {
		const group = await this.findGroupOrFail(id);
		const stated = (input ?? {}) as unknown as Record<string, unknown>;

		for (const member of ContactGroupService.IMMUTABLE_MEMBERS) {
			if (stated[member] !== undefined && stated[member] !== null) {
				throw new BadRequestException(
					`${ApiErrorCode.CONTACT_GROUP_SYSTEM}: '${member}' is what the platform states about a group, and it is not written by a request.`
				);
			}
		}

		let code: string | undefined;

		if (input.code !== undefined && input.code !== null) {
			code = this.normaliseCode(input.code);

			if (group.isSystem && ContactGroupService.codeKey(code) !== ContactGroupService.codeKey(group.code)) {
				throw new BadRequestException(
					`${ApiErrorCode.CONTACT_GROUP_SYSTEM}: '${group.code}' is a group the platform maintains, and its code is what the platform addresses it by.`
				);
			}

			if (ContactGroupService.codeKey(code) !== ContactGroupService.codeKey(group.code)) {
				await this.assertCodeAvailable(code, group.id);
			}
		}

		if (input.type === ContactGroupType.RULE_BASED && group.type !== ContactGroupType.RULE_BASED && manualMemberCount > 0) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: a rule-based group's membership is computed and never materialised, and this group still holds ${manualMemberCount} hand-written member(s).`
			);
		}

		await this.update(id, {
			...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
			...(code !== undefined ? { code } : {}),
			...(input.description !== undefined ? { description: input.description } : {}),
			...(input.type !== undefined ? { type: input.type } : {}),
			...(input.priceListId !== undefined ? { priceListId: input.priceListId } : {}),
			...(input.discountPercent !== undefined
				? { discountPercent: this.assertDiscount(input.discountPercent) }
				: {}),
			...(input.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findGroupOrFail(id);
	}

	/**
	 * Soft-deletes a group, which is the only removal path there is.
	 *
	 * A hard delete is never offered: a price list, a promotion and a rule may all name this group, and
	 * the rows that do must keep working while it is recoverable. A group the platform maintains is not
	 * removable at all.
	 *
	 * @param id The group to soft-delete.
	 * @returns The stored group, soft-deleted.
	 * @throws BadRequestException `CONTACT_GROUP_SYSTEM` when the group is one the platform maintains.
	 * @throws NotFoundException when the group is not in the caller's scope.
	 */
	async removeGroup(id: ID): Promise<IContactGroup> {
		const group = await this.findGroupOrFail(id);

		if (group.isSystem) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_SYSTEM}: '${group.code}' is a group the platform maintains, and it is not deletable.`
			);
		}

		await this.softDelete(id);

		return this.findGroupOrFail(id);
	}

	/**
	 * Refuses a membership write this group's kind does not allow.
	 *
	 * The two kinds answer membership differently and only one of them writes it down. A hand-written
	 * row in a `RULE_BASED` group would be materialised membership that the next evaluation does not
	 * know about and cannot replace wholesale, which is the stale state the segmentation rule exists to
	 * prevent — so the write is refused here, at the only door it could come through, rather than stored
	 * and ignored.
	 *
	 * @param group The group a membership is being written to.
	 * @throws BadRequestException `CONTACT_GROUP_MEMBER_INVALID` for a hand-written membership of a
	 * rule-based group.
	 */
	assertMembershipWritable(group: IContactGroup): void {
		if (group?.type === ContactGroupType.RULE_BASED) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: '${group.code}' is rule-based, and its membership is computed from its rules rather than written.`
			);
		}
	}

	/**
	 * Trims a code and refuses a blank one.
	 *
	 * @param code The code as the caller stated it.
	 * @returns The stored form.
	 * @throws BadRequestException `CONTACT_GROUP_INVALID` when nothing but whitespace was stated.
	 */
	private normaliseCode(code?: string): string {
		const normalised = String(code ?? '').trim();

		if (!normalised) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_INVALID}: a group is stated with the code it will be addressed by, and none was presented.`
			);
		}

		return normalised;
	}

	/**
	 * Validates the group-wide discount, which is a fraction and not a percentage.
	 *
	 * @param discount The discount as the caller stated it.
	 * @returns The discount, or undefined when none was stated.
	 * @throws BadRequestException `CONTACT_GROUP_INVALID` when it is not a fraction between 0 and 1.
	 */
	private assertDiscount(discount?: number): number | undefined {
		if (discount === undefined || discount === null) {
			return undefined;
		}

		if (typeof discount !== 'number' || Number.isNaN(discount) || discount < 0 || discount > 1) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_INVALID}: a group discount is a fraction between 0 and 1 (0.1 is ten per cent), and '${String(
					discount
				)}' is not one.`
			);
		}

		return discount;
	}

	/**
	 * Refuses a code another live group of this organization already holds, in any casing.
	 *
	 * The read is organization-scoped because that is the scope the index carries: two organizations of
	 * one tenant may each keep a `WHOLESALE` group, and their price lists resolve inside their own
	 * organization. The comparison is case-insensitive because the dialects disagree about case and a
	 * rule that holds on one of them and not the others is not a rule — see the class note.
	 *
	 * @param code The normalised code.
	 * @param exceptId The group being written, excluded from the probe.
	 * @throws BadRequestException `CONTACT_GROUP_CODE_TAKEN`.
	 */
	private async assertCodeAvailable(code: string, exceptId?: ID): Promise<void> {
		const key = ContactGroupService.codeKey(code);
		// The exact form first — the index serves it — and the organization's groups only when it missed.
		const exact: ContactGroup[] = await this.find({ where: { code, ...this.scope } } as never);
		const candidates = exact.length ? exact : ((await this.find({ where: { ...this.scope } } as never)) as ContactGroup[]);
		const taken = (candidates ?? []).filter(
			(group) =>
				ContactGroupService.codeKey(group.code) === key && (!exceptId || String(group.id) !== String(exceptId))
		);

		if (taken.length) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_CODE_TAKEN}: '${code}' is already used by a group of this organization, and a code addresses one group.`
			);
		}
	}

	/**
	 * The form two codes are compared in: trimmed and case-folded.
	 *
	 * @param code The code as it is stored or as a caller wrote it.
	 * @returns The comparable key.
	 */
	private static codeKey(code: string): string {
		return String(code ?? '').trim().toLowerCase();
	}
}
