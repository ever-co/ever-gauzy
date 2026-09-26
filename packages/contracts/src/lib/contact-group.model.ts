import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';

/**
 * What kind of membership a contact group has.
 *
 * Static and rule-based segmentation live in one concept, because both are "a set of contacts that
 * prices and promotions can target". The kind is not a label: it decides who may write a membership
 * row — a `STATIC` group's membership is its `contact_group_member` rows and they are written by hand,
 * by import or by the contact itself; a `RULE_BASED` group's membership is computed by the segment
 * strategy from the group's `rule` rows and is **never materialised**, so that it cannot go stale.
 */
export enum ContactGroupType {
	/** Membership is exactly the live `contact_group_member` rows of this group. */
	STATIC = 'STATIC',
	/** Membership is computed from the group's rules on every evaluation and is never written down. */
	RULE_BASED = 'RULE_BASED'
}

/**
 * The columns of one contact group — a named set of parties that prices, promotions, shipping and
 * payment eligibility can target.
 *
 * The row is deliberately small: the commercial terms it grants are a reference to a price list and a
 * group-wide discount, and its membership lives in the pivot. Everything else a tenant wants to hang
 * off a group that nothing filters on belongs in `metadata`.
 */
export interface IContactGroup extends IBasePerTenantAndOrganizationEntityModel {
	/** The display name of the group, as an operator reads it. */
	name: string;
	/** The stable key an integration addresses the group by. Unique per organization among live rows. */
	code: string;
	/** What the group is for, in the tenant's own words. */
	description?: string;
	/** Whether membership is explicit or computed. */
	type: ContactGroupType;
	/**
	 * The price list granted to every member of this group.
	 *
	 * A plain identifier rather than a relation object: the price list belongs to the pricing
	 * capability, whose table is created by its own migration set, so the group carries the queryable
	 * column and the reference's constraint is created where its target exists.
	 */
	priceListId?: ID;
	/**
	 * The group-wide discount, as a **fraction** and not as a percentage: `0.1` is ten per cent.
	 *
	 * Applied by the promotion engine when no price list wins, which is why it is a column here and not
	 * a key of `metadata`: a value a resolution branches on cannot live in a document nothing filters.
	 */
	discountPercent?: number;
	/**
	 * A group the platform maintains, which an operator may not delete and whose code may not change.
	 *
	 * The value is not stated by a create body: a caller that could promote its own group to
	 * undeletable would be deciding a platform matter, so the flag is written by the platform's own
	 * seeding path and is immutable afterwards.
	 */
	isSystem: boolean;
	/** Tenant-defined extras (a display colour, an external segment id) that nothing filters on. */
	metadata?: JsonData;
}

/**
 * What a caller may state when a contact group is created.
 *
 * `isSystem` is deliberately absent — see {@link IContactGroup.isSystem}.
 */
export interface IContactGroupCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The display name of the group. */
	name: string;
	/** The stable key the group is addressed by. Required, and unique per organization. */
	code: string;
	/** What the group is for. */
	description?: string;
	/** Whether membership is explicit or computed. Defaults to `STATIC`. */
	type?: ContactGroupType;
	/** The price list granted to the group's members. */
	priceListId?: ID;
	/** The group-wide discount as a fraction (`0.1` is ten per cent). */
	discountPercent?: number;
	/** Tenant-defined extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on an existing contact group.
 *
 * The kind is among the mutable fields, because a tenant that outgrows a hand-kept list turns it into
 * a rule-based segment. The service refuses that particular change while hand-written membership rows
 * exist, for the reason the schema chapter states: a rule-based group's membership is computed and
 * never materialised, so leaving materialised rows behind would be the stale state the rule forbids.
 */
export interface IContactGroupUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** The display name of the group. */
	name?: string;
	/** The stable key the group is addressed by. Refused on a system group. */
	code?: string;
	/** What the group is for. */
	description?: string;
	/** Whether membership becomes explicit or computed. */
	type?: ContactGroupType;
	/** The price list granted to the group's members. */
	priceListId?: ID;
	/** The group-wide discount as a fraction. */
	discountPercent?: number;
	/** Tenant-defined extras. */
	metadata?: JsonData;
}

/** The fields a caller may narrow a list of contact groups by. */
export interface IContactGroupFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to one kind of membership. */
	type?: ContactGroupType;
	/** Restrict to the groups that grant one price list. */
	priceListId?: ID;
	/** Restrict to the groups the platform maintains, or to the ones it does not. */
	isSystem?: boolean;
	/** Restrict to the groups whose code, name or description contains this text. */
	search?: string;
}
