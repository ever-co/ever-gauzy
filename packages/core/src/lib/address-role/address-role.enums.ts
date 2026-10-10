/**
 * What a row of the address book is *for*.
 *
 * An address modelled its role set with exactly two booleans, and shipped requirements already need
 * more: a seller's **registered** and **payout** addresses, a carrier label's **return** destination,
 * a purchase order's **remit-to**. Each of those as another boolean is the boolean-per-case shape that
 * has no end, and the set is genuinely open — an operator will want a pickup address and a
 * registered-office address next.
 *
 * The role set is a **pivot row and not a single-valued `type` column**, deliberately: one address is
 * routinely both the billing and the shipping address, which the two existing booleans express
 * correctly in one row and a single-valued column would regress. Those two booleans are therefore not
 * removed; they become the derived mirror of the `SHIPPING` and `BILLING` rows, written in the same
 * transaction by the same subscriber that maintains the party's two default references.
 *
 * The type carries the `Enum` suffix because the concept already has a class: `address_role` is the
 * table and `AddressRole` is its entity, so the value set follows the platform's own convention for
 * exactly this collision — `TaskStatus` beside `TaskStatusEnum`, `PaymentMethodEnum` beside the
 * payment row — rather than the two sharing one name.
 */
export enum AddressRoleEnum {
	/** Where goods are sent. Its default mirrors `address.isDefaultShipping`. */
	SHIPPING = 'SHIPPING',
	/** Where the invoice goes. Its default mirrors `address.isDefaultBilling`. */
	BILLING = 'BILLING',
	/** The party's registered office, as filed. */
	REGISTERED = 'REGISTERED',
	/** Where money is sent — a seller's payout address. */
	PAYOUT = 'PAYOUT',
	/** Where goods come back to — the destination a return label prints. */
	RETURN = 'RETURN',
	/** Where a supplier is paid — the address a purchase order prints. */
	REMIT_TO = 'REMIT_TO'
}

/**
 * The two roles the address book's own booleans mirror.
 *
 * Declared as data rather than tested for inline, so the mirror rule has one statement and a role added
 * later cannot silently acquire a boolean it should not have.
 */
export const ADDRESS_ROLES_WITH_BOOLEAN_MIRROR: readonly AddressRoleEnum[] = [
	AddressRoleEnum.SHIPPING,
	AddressRoleEnum.BILLING
];
