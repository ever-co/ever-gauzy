import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { ICountry } from './country.model';
import { IOrganizationContact } from './organization-contact.model';

/**
 * What kind of thing a row of the address book belongs to.
 *
 * The owner is a **dimension** and not another nullable foreign key. The book started keyed to a buyer
 * only, while two shipped documents already assigned it wider duties it could not perform: a seller's
 * registered and payout addresses reached it only because a seller's contact happened to be an
 * organization contact, and a warehouse — a location with coordinates but no party — had no row at all
 * for the ship-from a carrier label prints. A column per addressable thing (`warehouseId`, `sellerId`,
 * `vendorId`, …) is a column per case, so the owner is stated as a type and an id: the target table is
 * the one this value names, and the price of polymorphism — no foreign key — is paid in the service
 * layer and re-reported by the referential-integrity audit, exactly as the rule and adjustment ledgers
 * pay it.
 */
export enum AddressOwnerType {
	/** The address belongs to an organization contact; `customerId` equals `ownerId`. */
	CONTACT = 'CONTACT',
	/** The address belongs to a stock location — the ship-from on a carrier label. A warehouse is a location, not a party. */
	WAREHOUSE = 'WAREHOUSE',
	/** The address belongs to a marketplace seller. */
	SELLER = 'SELLER',
	/** The address belongs to a supplier — what a purchase order prints as its remit-to. */
	VENDOR = 'VENDOR',
	/** The address belongs to the organization itself (a registered office), not to any party. */
	ORGANIZATION = 'ORGANIZATION'
}

/**
 * One row of the address book: a reusable postal address, owned by a party, a location or the
 * organization itself.
 *
 * **Why the name carries the book.** The contracts package already exports an `IAddress`, and it is a
 * different concept: the five fields a geocoding call exchanges (`country`, `city`, `postcode`,
 * `address`, `address2`), which the existing contact form reads and writes. A postal address row is
 * not that shape widened — it carries a country **code** rather than a country name, `line1`/`line2`
 * rather than `address`/`address2`, an owner dimension, two default booleans and a validation verdict
 * — so merging the two would either force five columns onto `address` that the schema does not give it
 * or require the geocoding interface to relax members its own consumers supply. The two are kept
 * apart, and the delimiter below is the reconciliation: `city` is the one member they share, and it is
 * the same column.
 *
 * **Orders do not read this row for their content.** An order snapshots the address it was placed with
 * into its own immutable copy, so editing or deleting a row here never changes a historical document,
 * and a row referenced by an order may be soft-deleted without a second thought.
 */
export interface IAddressBook extends IBasePerTenantAndOrganizationEntityModel {
	/** Customer-facing nickname ("Home", "Warehouse 2"). */
	label?: string;
	/** The person to address at this location. */
	contactName?: string;
	/** Company name as it should appear on a label or an invoice. */
	company?: string;
	/** First name of the person at this location. */
	firstName?: string;
	/** Last name of the person at this location. */
	lastName?: string;
	/** Telephone number, as entered. */
	phone?: string;
	/** E-mail address, as entered. */
	email?: string;
	/** Street address. Required: an address that names no street names nothing. */
	line1: string;
	/** Second line of the street address — a unit, a floor, a building. */
	line2?: string;
	/** City or locality. Required. */
	city: string;
	/** Free-text province name as entered. */
	province?: string;
	/**
	 * Normalised province/state code, and the member tax and shipping rules match on.
	 *
	 * Kept beside the free-text name rather than replacing it: the name is what a customer typed and
	 * what a label prints, while the code is the comparable form a rate table can be keyed by, and an
	 * address whose province has no code is an ordinary state of affairs rather than an error.
	 */
	provinceCode?: string;
	/** Postal or ZIP code, as entered. */
	postalCode?: string;
	/** ISO 3166-1 alpha-2 country code, upper case. Always present. */
	countryCode: string;
	/**
	 * The country lookup row, when the code was recognised.
	 *
	 * Non-null exactly when `countryCode` matches a row of the country table, which the service
	 * resolves on every write. Null is not a defect: an address may legitimately carry a code the
	 * lookup does not contain, and refusing it would make the platform reject a real destination
	 * because its own reference list is short.
	 */
	countryId?: ID;
	/** The country row `countryId` names. */
	country?: ICountry;
	/** Latitude, when the address was geocoded. */
	latitude?: number;
	/** Longitude, when the address was geocoded. */
	longitude?: number;
	/**
	 * Whether this is the party's default shipping address.
	 *
	 * A **derived mirror**, not the authority: the party's own `defaultShippingAddressId` column is
	 * authoritative and the two are written in one transaction, so a write that disagrees fails with
	 * `ADDRESS_DEFAULT_MISMATCH` rather than leaving two answers to one question. The boolean is
	 * retained because a checkout that expands the party reads it and because it is what the partial
	 * unique index makes enforceable in the database.
	 */
	isDefaultShipping: boolean;
	/** The billing counterpart of the above, on the same terms. */
	isDefaultBilling: boolean;
	/** Whether an address-validation strategy has confirmed this address. */
	isValidated: boolean;
	/** Which validator produced the verdict, when one did (`AddressValidationStrategy`). */
	validationProviderKey?: string;
	/** What kind of thing the address belongs to. */
	ownerType: AddressOwnerType;
	/** The id of the row `ownerType` names. No foreign key: the target table depends on the type. */
	ownerId: ID;
	/**
	 * The buyer this address is scoped to, when it is a party's.
	 *
	 * Null for an anonymous cart address created before the customer registers, and for an address
	 * whose owner is not a party. When it is stated on a `CONTACT` address it must equal `ownerId`,
	 * which is the service check `ADDRESS_OWNER_MISMATCH`.
	 */
	customerId?: ID;
	/** The contact row `customerId` names. */
	customer?: IOrganizationContact;
	/** Tenant extras, including the raw provider response when the address was validated. */
	metadata?: JsonData;
}

/**
 * What a caller may state when an address is recorded.
 *
 * The validation verdict is deliberately absent. `isValidated` and `validationProviderKey` are written
 * by the validation strategy — the operation that actually asks a provider — and a create or a
 * descriptive update that states one is refused rather than silently ignored, because a caller that
 * believes it validated an address would otherwise never see that it did not.
 */
export interface IAddressBookCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Customer-facing nickname. */
	label?: string;
	/** The person to address at this location. */
	contactName?: string;
	/** Company name. */
	company?: string;
	/** First name of the person at this location. */
	firstName?: string;
	/** Last name of the person at this location. */
	lastName?: string;
	/** Telephone number. */
	phone?: string;
	/** E-mail address. */
	email?: string;
	/** Street address. Required. */
	line1: string;
	/** Second line of the street address. */
	line2?: string;
	/** City or locality. Required. */
	city: string;
	/** Free-text province name. */
	province?: string;
	/** Normalised province/state code. */
	provinceCode?: string;
	/** Postal or ZIP code. */
	postalCode?: string;
	/** ISO 3166-1 alpha-2 country code. Required; normalised to upper case by the service. */
	countryCode: string;
	/** The country lookup row, when the caller already resolved one. */
	countryId?: ID;
	/** Latitude, when the caller geocoded the address. */
	latitude?: number;
	/** Longitude, when the caller geocoded the address. */
	longitude?: number;
	/** Whether this becomes the party's default shipping address. Defaults to false. */
	isDefaultShipping?: boolean;
	/** Whether this becomes the party's default billing address. Defaults to false. */
	isDefaultBilling?: boolean;
	/** What kind of thing the address belongs to. Defaults to `CONTACT`. */
	ownerType?: AddressOwnerType;
	/** The id of the row `ownerType` names. Required. */
	ownerId: ID;
	/** The buyer this address is scoped to, when it is a party's. */
	customerId?: ID;
	/** Tenant extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on an existing address.
 *
 * Every member is optional and the owner pair is included deliberately: an address legitimately moves
 * from one warehouse to another, or from a warehouse to the organization itself, and the service
 * re-runs the owner-consistency check and the default rule on the new owner's book when it does.
 */
export interface IAddressBookUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Customer-facing nickname. */
	label?: string;
	/** The person to address at this location. */
	contactName?: string;
	/** Company name. */
	company?: string;
	/** First name of the person at this location. */
	firstName?: string;
	/** Last name of the person at this location. */
	lastName?: string;
	/** Telephone number. */
	phone?: string;
	/** E-mail address. */
	email?: string;
	/** Street address. */
	line1?: string;
	/** Second line of the street address. */
	line2?: string;
	/** City or locality. */
	city?: string;
	/** Free-text province name. */
	province?: string;
	/** Normalised province/state code. */
	provinceCode?: string;
	/** Postal or ZIP code. */
	postalCode?: string;
	/** ISO 3166-1 alpha-2 country code; normalised to upper case by the service. */
	countryCode?: string;
	/** The country lookup row, when the caller resolved one. */
	countryId?: ID;
	/** Latitude. */
	latitude?: number;
	/** Longitude. */
	longitude?: number;
	/** Whether this becomes the party's default shipping address. */
	isDefaultShipping?: boolean;
	/** Whether this becomes the party's default billing address. */
	isDefaultBilling?: boolean;
	/** What kind of thing the address belongs to. */
	ownerType?: AddressOwnerType;
	/** The id of the row `ownerType` names. */
	ownerId?: ID;
	/** The buyer this address is scoped to, when it is a party's. */
	customerId?: ID;
	/** Tenant extras. */
	metadata?: JsonData;
}

/** The fields a caller may filter a list of addresses by. */
export interface IAddressBookFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to one party's book. */
	customerId?: ID;
	/** Restrict to one country code. */
	countryCode?: string;
	/** Restrict to the addresses of one kind of owner. */
	ownerType?: AddressOwnerType;
	/** Restrict to one owner row. */
	ownerId?: ID;
	/** Restrict to the default shipping address. */
	isDefaultShipping?: boolean;
	/** Restrict to the default billing address. */
	isDefaultBilling?: boolean;
	/** Restrict to addresses a validation strategy has confirmed. */
	isValidated?: boolean;
}
