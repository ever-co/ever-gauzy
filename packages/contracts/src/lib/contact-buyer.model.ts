import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';

/**
 * What a buyer may do inside the company account it belongs to.
 *
 * The role is the membership discriminator and not a capability: it says what kind of member this is,
 * while the approval capability of an approver is the platform permission the staff side already
 * evaluates. The three values are closed on purpose — a membership with an approval axis needs no
 * fourth, and a tenant that wants a different approval shape writes a policy rule instead of a role.
 */
export enum ContactBuyerRole {
	/** Administers the company account: maintains the buyer list, the limits and the approval thresholds of the other buyers. */
	ADMIN = 'ADMIN',
	/** May approve or reject an order a purchaser raised above that purchaser's approval threshold. */
	APPROVER = 'APPROVER',
	/** May place orders on the company account, inside its own per-order and rolling-period limits. */
	PURCHASER = 'PURCHASER',
	/** May read the company account's orders and invoices, and may not place one. */
	VIEWER = 'VIEWER'
}

/**
 * The columns of one company-account membership — the pivot between a company account and one of its
 * buyers.
 *
 * A pivot rather than a second kind of party: a person stays exactly one contact row, and their
 * company relationship is a relation and not a duplicate record. Membership state uses the inherited
 * `isActive` / `deletedAt` columns, so there is no second active flag to keep in step with the first.
 */
export interface IContactBuyer extends IBasePerTenantAndOrganizationEntityModel {
	/** The company account. It is a contact whose `partyKind` is `COMPANY`. */
	companyCustomerId: ID;
	/** The individual buyer. A different contact from the company account, always. */
	buyerCustomerId: ID;
	/** What the buyer may do inside the account. */
	role: ContactBuyerRole;
	/**
	 * The per-order ceiling for this buyer.
	 *
	 * Null means the company's credit facility governs alone. When both are set the effective ceiling is
	 * the **lower** of the two, because a buyer limit narrows what the account allows and never widens
	 * it.
	 */
	spendingLimit?: number;
	/** The ceiling over one rolling period, evaluated as `periodSpent + total <= periodSpendingLimit` when it is set. */
	periodSpendingLimit?: number;
	/** Orders at or above this amount require an approval. Null means the group, channel or organization threshold applies. */
	approvalThreshold?: number;
	/** The day of the month the rolling period restarts. 1–28, so that every month has the day. */
	periodStartDay?: number;
	/** When the buyer was attached to the account. */
	assignedAt?: Date;
	/**
	 * The staff user who invited the buyer, when a member of staff did.
	 *
	 * Released rather than cascaded when the user goes: who invited whom is history, and the membership
	 * outlives the inviter's account.
	 */
	invitedByUserId?: ID;
	/** Tenant-defined extras. */
	metadata?: JsonData;
}

/**
 * What a caller states when a buyer is attached to a company account.
 *
 * The company is named by the caller rather than taken from the buyer: membership is the account's
 * fact, and a create body that named no account would have to guess one from the buyer's other rows —
 * which is exactly the read-then-write the one-active-account rule has to prevent.
 */
export interface IContactBuyerCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The company account the buyer joins. */
	companyCustomerId: ID;
	/** The buyer joining it. */
	buyerCustomerId: ID;
	/** What the buyer may do. Defaults to `PURCHASER`. */
	role?: ContactBuyerRole;
	/** The per-order ceiling for this buyer. */
	spendingLimit?: number;
	/** The ceiling over one rolling period. */
	periodSpendingLimit?: number;
	/** Orders at or above this amount require an approval. */
	approvalThreshold?: number;
	/** The day of the month the rolling period restarts. 1–28. */
	periodStartDay?: number;
	/** When the buyer was attached. Defaults to now. */
	assignedAt?: Date;
	/** The staff user making the invitation, when a member of staff did. */
	invitedByUserId?: ID;
	/** Tenant-defined extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on an existing membership.
 *
 * Neither side of the pivot is among the mutable fields: a membership that could be re-pointed at
 * another buyer or another company would be a way to move purchasing authority without a trace. The
 * supported path is to remove the membership and attach a new one.
 */
export interface IContactBuyerUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** What the buyer may do. */
	role?: ContactBuyerRole;
	/** The per-order ceiling for this buyer. */
	spendingLimit?: number;
	/** The ceiling over one rolling period. */
	periodSpendingLimit?: number;
	/** Orders at or above this amount require an approval. */
	approvalThreshold?: number;
	/** The day of the month the rolling period restarts. 1–28. */
	periodStartDay?: number;
	/** Tenant-defined extras. */
	metadata?: JsonData;
}

/** The fields a caller may narrow a list of company-account memberships by. */
export interface IContactBuyerFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to the buyers of one company account. */
	companyCustomerId?: ID;
	/** Restrict to the memberships of one buyer. */
	buyerCustomerId?: ID;
	/** Restrict to one role. */
	role?: ContactBuyerRole;
}

/**
 * What the service decided about one buyer's authority over one order.
 *
 * Answered as a value rather than as a boolean so that the caller can name the ceiling that refused it
 * — a per-order limit, a rolling-period limit, or a role that may not buy at all — which is what the
 * `BUYER_LIMIT_EXCEEDED` detail is built from.
 */
export interface IContactBuyerAuthority {
	/** The membership that was evaluated. */
	membership: IContactBuyer;
	/** Whether the role may place an order at all: `PURCHASER`, `APPROVER` and `ADMIN` may; `VIEWER` may not. */
	mayPurchase: boolean;
	/** Whether the role may approve an order above a threshold. */
	mayApprove: boolean;
	/** Whether the role administers the account's buyer list and commercial terms. */
	mayAdminister: boolean;
}
