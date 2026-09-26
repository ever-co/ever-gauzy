import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
	ContactGroupSource,
	ID,
	IContactGroupMember,
	IContactGroupMemberAddInput,
	IContactGroupMemberFindInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ContactGroupService } from '../contact-group/contact-group.service';
import { ContactGroupEventPublisher } from '../contact-group/contact-group-event.publisher';
import { ContactGroupMember } from './contact-group-member.entity';
import { TypeOrmContactGroupMemberRepository } from './repository/type-orm-contact-group-member.repository';
import { MikroOrmContactGroupMemberRepository } from './repository/mikro-orm-contact-group-member.repository';

/**
 * Explicit group membership: who is in which group, until when, and who put them there.
 *
 * Read the rules of this service as one rule about provenance with three consequences:
 *
 * 1. **One row per pair, and re-adding a lapsed member refreshes the row rather than duplicating it.**
 *    A membership is a fact about a pair of rows and not a log, so a second live row for the same pair
 *    is refused; a party whose membership lapsed is added again by writing the row it already has,
 *    because the unique index does not stop existing at the moment a window closes.
 * 2. **Provenance decides what may be removed.** A hand-written membership is removed by an operator
 *    and never by an evaluation or an import; a rule-written one is replaced wholesale by the segment
 *    materialiser and never by an operator; an imported one is replaced by the next import of the same
 *    source. Every write states its source, and every removal is scoped by one.
 * 3. **The kind of the group decides whether membership may be written at all.** A rule-based group's
 *    membership is computed from its rules and is never materialised, so a hand-written row there is
 *    refused by the group service rather than stored and ignored.
 *
 * Two further rules follow from the schema chapter's invariants: an expired row is treated as **absent**
 * by every read here — the caller has to ask explicitly to see one — and the materialiser writes only
 * `RULE` and `IMPORT` rows, because a materialiser that could write `MANUAL` rows would be a
 * re-evaluation that quietly adopts an operator's work.
 *
 * **The membership write is announced from here rather than from the surfaces that call it.** The REST
 * membership route and the two membership mutations perform the same writes through this service, so
 * announcing here is what keeps a subscriber from being able to tell which protocol wrote a row. The
 * publisher itself is declared by the group module — this module imports that one, so a publisher
 * declared here could not be reached by the group's own writes, while one declared there is reachable
 * from both without closing a cycle.
 */
@Injectable()
export class ContactGroupMemberService extends TenantAwareCrudService<ContactGroupMember> {
	/** The provenances the segment materialiser and the import own. `MANUAL` is never written by them. */
	private static readonly MATERIALISED_SOURCES = [ContactGroupSource.RULE, ContactGroupSource.IMPORT];

	constructor(
		readonly typeOrmContactGroupMemberRepository: TypeOrmContactGroupMemberRepository,
		readonly mikroOrmContactGroupMemberRepository: MikroOrmContactGroupMemberRepository,
		/**
		 * The group service, for the two questions a membership write cannot answer on its own: does the
		 * group exist inside the caller's scope, and does its kind allow a hand-written membership? The
		 * dependency runs one way — the group service never reads membership — so no cycle is created.
		 */
		private readonly contactGroupService: ContactGroupService,
		/**
		 * The domain's announcement path, reached through the group module for the reason the class note
		 * states. A required collaborator: a membership write that stopped announcing would leave the
		 * subscription silently describing a membership the platform no longer has.
		 */
		private readonly contactGroupEventPublisher: ContactGroupEventPublisher
	) {
		super(typeOrmContactGroupMemberRepository, mikroOrmContactGroupMemberRepository);
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
	 * Makes a party a member of a group, by hand.
	 *
	 * @param groupId The group to join.
	 * @param input The party and, when the membership is temporary, the instant it lapses.
	 * @returns The stored membership.
	 * @throws BadRequestException `CONTACT_GROUP_MEMBER_INVALID` when the group is rule-based, when the
	 * window has already closed, or when the pair already has a live membership.
	 * @throws NotFoundException `CONTACT_GROUP_NOT_FOUND` when the group is not in the caller's scope.
	 */
	async addMember(groupId: ID, input: IContactGroupMemberAddInput): Promise<IContactGroupMember> {
		const group = await this.contactGroupService.findGroupOrFail(groupId);

		this.contactGroupService.assertMembershipWritable(group);

		const member = await this.writeMember(groupId, input, ContactGroupSource.MANUAL);

		await this.contactGroupEventPublisher.membersAssigned(group, [member.customerId], ContactGroupSource.MANUAL);

		return member;
	}

	/**
	 * Makes several parties members of a group in one call, which is what the membership endpoint's
	 * `add[]` is.
	 *
	 * The whole list is validated before any of it is written, so a list that names a party twice or that
	 * names one who is already a live member is refused as a whole rather than half-applied: a caller that
	 * receives a refusal must not be left guessing which half of its request took effect.
	 *
	 * @param groupId The group to join.
	 * @param inputs The parties and their optional windows.
	 * @returns The stored memberships, in the order they were stated.
	 * @throws BadRequestException `CONTACT_GROUP_MEMBER_INVALID` for a rule-based group, a closed window,
	 * a party named twice or a pair that is already a live member.
	 * @throws NotFoundException `CONTACT_GROUP_NOT_FOUND` when the group is not in the caller's scope.
	 */
	async addMembers(groupId: ID, inputs: readonly IContactGroupMemberAddInput[]): Promise<IContactGroupMember[]> {
		const group = await this.contactGroupService.findGroupOrFail(groupId);

		this.contactGroupService.assertMembershipWritable(group);

		const list = inputs ?? [];
		const named = new Set<string>();

		for (const input of list) {
			if (!input?.customerId) {
				throw new BadRequestException(
					`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: a membership is stated with the contact that joins, and none was presented.`
				);
			}

			const key = String(input.customerId);

			if (named.has(key)) {
				throw new BadRequestException(
					`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: contact '${key}' is named twice in one membership write.`
				);
			}

			named.add(key);

			if (input.expiresAt) {
				this.assertWindowOpen(input.expiresAt);
			}

			const live = await this.findLiveMember(input.customerId, groupId);

			if (live) {
				throw new BadRequestException(
					`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: contact '${key}' already holds a live ${live.source} membership of group '${groupId}', and a pair holds one membership.`
				);
			}
		}

		const members: IContactGroupMember[] = [];

		for (const input of list) {
			members.push(await this.writeMember(groupId, input, ContactGroupSource.MANUAL));
		}

		// One fact for the whole write, carrying the parties it named: the catalogue states the event as
		// `customerIds[]` with a single `source`, and a stream that fired once per party would make a
		// bulk import a broadcast. The list was validated as a whole before any of it was written, so
		// either every membership here was granted or the announcement never runs.
		await this.contactGroupEventPublisher.membersAssigned(
			group,
			members.map((member) => member.customerId),
			ContactGroupSource.MANUAL
		);

		return members;
	}

	/**
	 * Removes a membership, scoped to the provenance the caller owns.
	 *
	 * An operator removes the hand-written membership and never the derived one: a segment's membership
	 * is the evaluation's to replace, and an import's is the next import's. Asking for a provenance
	 * explicitly is how the caller says which of the two it meant.
	 *
	 * @param groupId The group the membership is in.
	 * @param customerId The party whose membership is removed.
	 * @param source Which membership row is meant. Defaults to the hand-written one.
	 * @returns The removed membership.
	 * @throws NotFoundException `CONTACT_GROUP_MEMBER_NOT_FOUND` when no live row of that provenance exists.
	 */
	async removeMember(
		groupId: ID,
		customerId: ID,
		source: ContactGroupSource = ContactGroupSource.MANUAL
	): Promise<IContactGroupMember> {
		const existing = await this.findMembership(customerId, groupId, source);

		if (!existing) {
			throw new NotFoundException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_NOT_FOUND}: no ${source} membership of group '${groupId}' exists for contact '${customerId}'.`
			);
		}

		// The group is resolved before the removal, so the announcement below can name the group the
		// membership left without a read that could fail after the row is already gone.
		const group = await this.contactGroupService.findGroupOrFail(groupId);

		await this.softDelete(existing.id);

		await this.contactGroupEventPublisher.membersUnassigned(group, [existing.customerId], source);

		return existing;
	}

	/**
	 * Writes the membership rows of one derived provenance, replacing whatever that provenance held.
	 *
	 * This is the segment materialiser's and the import's entry point, and it is why the provenance
	 * column exists: only rows of the stated source are touched, so a re-evaluation never removes a
	 * membership an operator created by hand, and an import never removes a rule's derived membership.
	 * A party already holding a live row of that source is left alone; a party that lost it is added; a
	 * row of that source whose party is no longer named is removed.
	 *
	 * `MANUAL` is refused here rather than silently accepted: a materialiser that could write
	 * hand-written memberships would be adopting an operator's work as its own, and the next run would
	 * then be entitled to delete it.
	 *
	 * @param groupId The group whose derived membership is replaced.
	 * @param source Which provenance is being written. `RULE` or `IMPORT`.
	 * @param customerIds The parties that provenance now says are members.
	 * @param expiresAt The window the written rows carry, when the caller is writing a temporary set.
	 * @returns The memberships the provenance now holds.
	 * @throws BadRequestException `CONTACT_GROUP_MEMBER_INVALID` for the `MANUAL` source.
	 * @throws NotFoundException when the group is not in the caller's scope.
	 */
	async replaceMembersOfSource(
		groupId: ID,
		source: ContactGroupSource,
		customerIds: readonly ID[],
		expiresAt?: Date
	): Promise<IContactGroupMember[]> {
		if (!ContactGroupMemberService.MATERIALISED_SOURCES.includes(source)) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: '${source}' is not a provenance a materialised write owns; a hand-written membership is written and removed by an operator.`
			);
		}

		await this.contactGroupService.findGroupOrFail(groupId);

		if (expiresAt) {
			this.assertWindowOpen(expiresAt);
		}

		const held = await this.find({
			where: { groupId, source, ...this.scope }
		} as never);
		const wanted = (customerIds ?? []).map((id) => String(id));
		const stored: IContactGroupMember[] = [];

		for (const id of customerIds ?? []) {
			const existing = (held as ContactGroupMember[]).find(
				(member) => String(member.customerId) === String(id) && !this.hasLapsed(member)
			);

			stored.push(
				existing
					? existing
					: await this.writeMember(groupId, { customerId: id, expiresAt }, source, true)
			);
		}

		for (const member of held as ContactGroupMember[]) {
			if (wanted.includes(String(member.customerId)) && !this.hasLapsed(member)) {
				continue;
			}

			// The provenance no longer names this party, or its window has closed: the row is removed
			// softly, because the history of who was in the segment is the operator's evidence.
			await this.softDelete(member.id);
		}

		return stored;
	}

	/**
	 * Lists the memberships of one group.
	 *
	 * @param groupId The group.
	 * @param filter Optional narrowing by provenance and by whether lapsed rows are included.
	 * @returns The memberships, oldest first.
	 */
	async listMembers(
		groupId: ID,
		filter: IContactGroupMemberFindInput = {}
	): Promise<IContactGroupMember[]> {
		const members: ContactGroupMember[] = await this.find({
			where: {
				groupId,
				...(filter.source ? { source: filter.source } : {}),
				...this.scope
			},
			order: { assignedAt: 'ASC' }
		} as never);

		return filter.includeExpired ? members : members.filter((member) => !this.hasLapsed(member));
	}

	/**
	 * The groups a party is a live member of.
	 *
	 * This is the read the pricing context and the segment evaluator perform once per request, which is
	 * why it answers ids and why a lapsed membership is filtered out rather than reported.
	 *
	 * @param customerId The party.
	 * @param at The instant membership is evaluated at. Defaults to now, and is stated so a replay of a
	 * historical order resolves the groups that were in force when it was placed.
	 * @returns The group ids, in no particular order.
	 */
	async listGroupIdsOfCustomer(customerId: ID, at: Date = new Date()): Promise<ID[]> {
		const members: ContactGroupMember[] = await this.find({
			where: { customerId, ...this.scope }
		} as never);

		return members.filter((member) => !this.hasLapsed(member, at)).map((member) => member.groupId);
	}

	/**
	 * Whether a party is a live member of a group.
	 *
	 * @param customerId The party.
	 * @param groupId The group.
	 * @param at The instant membership is evaluated at. Defaults to now.
	 * @returns True when a row exists whose window contains that instant.
	 */
	async isMember(customerId: ID, groupId: ID, at: Date = new Date()): Promise<boolean> {
		const members: ContactGroupMember[] = await this.find({
			where: { customerId, groupId, ...this.scope }
		} as never);

		return (members ?? []).some((member) => !this.hasLapsed(member, at));
	}

	/**
	 * Whether a membership's window has passed.
	 *
	 * The one place the reading of `expiresAt` lives, so that "an expired row counts as absent" is a
	 * property of this service rather than of each caller's comparison. A row with no expiry never
	 * lapses.
	 *
	 * @param member The membership.
	 * @param at The instant to compare against. Defaults to now.
	 * @returns True when the row is lapsed at that instant.
	 */
	hasLapsed(member: IContactGroupMember, at: Date = new Date()): boolean {
		return Boolean(member?.expiresAt) && new Date(member.expiresAt as Date).getTime() <= at.getTime();
	}

	/**
	 * Removes every membership whose window has closed, which is the nightly sweep's entry point.
	 *
	 * The rows are soft-deleted rather than hard-deleted: a retention job owns hard deletes, and "this
	 * party was in this segment until Tuesday" is an answer the platform should keep.
	 *
	 * @param at The instant the sweep runs at. Defaults to now.
	 * @returns The memberships that were removed.
	 */
	async removeExpired(at: Date = new Date()): Promise<IContactGroupMember[]> {
		const members: ContactGroupMember[] = await this.find({ where: { ...this.scope } } as never);
		const lapsed = (members ?? []).filter((member) => this.hasLapsed(member, at));

		for (const member of lapsed) {
			await this.softDelete(member.id);
		}

		return lapsed;
	}

	/**
	 * Reads one membership of the caller's organization, answering null when there is none.
	 *
	 * @param customerId The party.
	 * @param groupId The group.
	 * @param source Which provenance is meant. Defaults to the hand-written one.
	 * @returns The membership, or null.
	 */
	async findMembership(
		customerId: ID,
		groupId: ID,
		source: ContactGroupSource = ContactGroupSource.MANUAL
	): Promise<IContactGroupMember | null> {
		const members: ContactGroupMember[] = await this.find({
			where: { customerId, groupId, source, ...this.scope }
		} as never);

		return members.length ? members[0] : null;
	}

	/**
	 * Writes one membership row, refreshing the row a party already has when its window has closed.
	 *
	 * One live row per pair, whichever provenance wrote it: a membership is a fact about a pair and not a
	 * log, so a second live row for the same pair is the defect the unique index carries. A materialised
	 * write treats a live row of its own provenance as already done — it is replacing a set, not adding to
	 * one — and a live row of another provenance as that provenance's, which it neither rewrites nor
	 * duplicates.
	 *
	 * @param groupId The group.
	 * @param input The party and its optional window.
	 * @param source The provenance being written.
	 * @param replace Whether a live row the provenance already holds is accepted as the answer (true for a
	 * materialised write) or refused as a duplicate (false for a hand-written add).
	 * @returns The stored membership.
	 * @throws BadRequestException `CONTACT_GROUP_MEMBER_INVALID` for a closed window or a duplicate pair.
	 */
	private async writeMember(
		groupId: ID,
		input: IContactGroupMemberAddInput,
		source: ContactGroupSource,
		replace = false
	): Promise<IContactGroupMember> {
		if (!input?.customerId) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: a membership is stated with the contact that joins, and none was presented.`
			);
		}

		if (input.expiresAt) {
			this.assertWindowOpen(input.expiresAt);
		}

		const live = await this.findLiveMember(input.customerId, groupId);

		if (live) {
			if (replace) {
				// The provenance already names this party, or another provenance owns the pair and this
				// write does not: either way there is nothing to write.
				return live;
			}

			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: contact '${input.customerId}' already holds a live ${live.source} membership of group '${groupId}', and a pair holds one membership.`
			);
		}

		const assignedAt = new Date();
		const lapsed = await this.findMembership(input.customerId, groupId, source);

		if (lapsed) {
			// A lapsed row of this provenance is refreshed rather than duplicated: the pair holds one row,
			// and the unique index does not stop applying when a window closes.
			await this.update(lapsed.id, {
				assignedAt,
				expiresAt: input.expiresAt ?? null
			} as never);

			return this.findOneMember(lapsed.id);
		}

		return this.create({
			customerId: input.customerId,
			groupId,
			assignedAt,
			...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
			source,
			...this.scope
		} as never);
	}

	/**
	 * The live membership of a pair, whichever provenance wrote it.
	 *
	 * @param customerId The party.
	 * @param groupId The group.
	 * @returns The live membership, or null.
	 */
	private async findLiveMember(customerId: ID, groupId: ID): Promise<IContactGroupMember | null> {
		const members: ContactGroupMember[] = await this.find({
			where: { customerId, groupId, ...this.scope }
		} as never);

		return (members ?? []).find((member) => !this.hasLapsed(member)) ?? null;
	}

	/**
	 * Re-reads one membership by id inside the caller's scope.
	 *
	 * @param id The membership id.
	 * @returns The membership.
	 * @throws NotFoundException `CONTACT_GROUP_MEMBER_NOT_FOUND` when it is not in the caller's scope.
	 */
	private async findOneMember(id: ID): Promise<IContactGroupMember> {
		const members: ContactGroupMember[] = await this.find({ where: { id, ...this.scope } } as never);

		if (!members.length) {
			throw new NotFoundException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_NOT_FOUND}: membership '${id}' could not be found.`
			);
		}

		return members[0];
	}

	/**
	 * Refuses a window that has already closed.
	 *
	 * A membership granted until yesterday is not a membership: writing it would create a row that every
	 * reader immediately treats as absent, and the caller would be told it had granted something.
	 *
	 * @param expiresAt The instant the caller stated.
	 * @throws BadRequestException `CONTACT_GROUP_MEMBER_INVALID`.
	 */
	private assertWindowOpen(expiresAt: Date): void {
		const instant = new Date(expiresAt);

		if (Number.isNaN(instant.getTime()) || instant.getTime() <= Date.now()) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_GROUP_MEMBER_INVALID}: a membership that lapses at '${String(
					expiresAt
				)}' has already lapsed, and an expired membership grants nothing.`
			);
		}
	}
}
