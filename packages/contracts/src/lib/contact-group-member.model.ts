import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IContactGroup } from './contact-group.model';

/**
 * How one membership row came to exist.
 *
 * The value is recorded on every row because it decides what may remove it: a hand-written membership
 * is never removed by an evaluation or by an import, and a rule-written one may be replaced wholesale
 * by the next evaluation of the segment. Without the column, a nightly re-evaluation would be entitled
 * to delete a membership an operator created by hand.
 */
export enum ContactGroupSource {
	/** Written by an operator. Never removed by the segment materialiser or by an import. */
	MANUAL = 'MANUAL',
	/** Written by the segment materialiser for a rule-based group; may be replaced wholesale by the next evaluation. */
	RULE = 'RULE',
	/** Written by a bulk import; removed or superseded by a later import of the same source. */
	IMPORT = 'IMPORT'
}

/**
 * The columns of one explicit group membership — the pivot between a party and a group.
 *
 * A pivot rather than a column on the party: a contact belongs to any number of groups, and the
 * membership carries facts of its own (when it was granted, when it lapses, and who wrote it). The row
 * has no meaning without either peer, which is why both references cascade.
 */
export interface IContactGroupMember extends IBasePerTenantAndOrganizationEntityModel {
	/** The party that is a member. */
	customerId: ID;
	/** The group the party belongs to. */
	groupId: ID;
	/** The group row `groupId` names. */
	group?: IContactGroup;
	/** When the membership was granted. */
	assignedAt: Date;
	/**
	 * When the membership lapses, for a temporary one (a trial tier).
	 *
	 * Null means it does not lapse. An expired row is treated as **absent** by every reader — the
	 * segment evaluator, the pricing context and the membership list — even before the cleanup job
	 * removes it, so a lapsed membership never grants anything.
	 */
	expiresAt?: Date;
	/** Who wrote the row, which is also what may remove it. */
	source: ContactGroupSource;
}

/**
 * What a caller states when it makes a party a member of a group.
 *
 * `source` is not stated here on purpose: a hand-written membership is `MANUAL`, and the two derived
 * kinds are written by their own operations — the segment materialiser and the import — so a create
 * body that claimed one of them would be claiming somebody else's provenance.
 */
export interface IContactGroupMemberAddInput {
	/** The party to make a member. */
	customerId: ID;
	/** When the membership lapses. Omitted means it does not lapse. Must be in the future when stated. */
	expiresAt?: Date;
}

/**
 * What a caller states when it removes a membership.
 *
 * The source is part of the request because removal is scoped by provenance: an operator removing a
 * membership removes the hand-written one, and never the derived row an evaluation owns.
 */
export interface IContactGroupMemberRemoveInput {
	/** The party whose membership is removed. */
	customerId: ID;
	/** Which membership row is meant. Defaults to the hand-written one. */
	source?: ContactGroupSource;
}

/** The fields a caller may narrow a list of memberships by. */
export interface IContactGroupMemberFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to the members of one group. */
	groupId?: ID;
	/** Restrict to the memberships of one party. */
	customerId?: ID;
	/** Restrict to one provenance. */
	source?: ContactGroupSource;
	/**
	 * Include rows whose window has passed. Off by default, because an expired membership is absent as
	 * far as every reader is concerned; an administrative listing turns it on to see what the cleanup
	 * job has not removed yet.
	 */
	includeExpired?: boolean;
}
