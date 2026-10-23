/**
 * The vocabularies the kernel extensions of the platform's own tables introduce.
 *
 * The columns these enums type are added to tables **core already owns** — `product`,
 * `product_category`, `product_variant`, `warehouse`, `currency`, `organization_contact`,
 * `tenant_setting`, `payment`, `organization_vendor`, `invoice` — so the vocabulary that types them
 * has to be readable by core without a plugin present. A definition that lived in the package whose
 * capability first writes it would make the core entity depend on an optional package, and an
 * installation that never installed that package would not be able to map its own table.
 *
 * Two of the value sets are deliberately the same vocabulary a capability package declares for its
 * own tables (`ProductStatus`, `WarehouseType`): the string values are identical, so a row written by
 * either side is understood by both, and this file is the copy the kernel-side column is typed with.
 * `MoneySymbolPosition` and `RoundingMode` are *not* duplicated here — they already live in the
 * platform contract package, and the money layer consumes exactly those two.
 *
 * The columns these enums type — and every other column this extension set adds — are declared
 * **optional** on the entities, even where the database column is `NOT NULL DEFAULT …`. The reason is
 * structural rather than stylistic: the contract package is a separate package that cannot reference a
 * vocabulary owned by core, so an interface that does not declare a member the entity requires stops
 * being assignable to the entity, and every CRUD controller — whose return type is the interface —
 * stops compiling. Nullability is stated where the database reads it: in the column decorator and in
 * the migration.
 */

/**
 * Lifecycle gate of a product or a product category.
 *
 * A draft is never listed whatever a channel publication says; an archived row is retained for
 * history and for the orders that already reference it. It is a separate statement from `enabled`,
 * which is a coarse on/off switch: a product that is not yet enabled and a product that is no longer
 * sold are different states and have to be distinguishable.
 */
export enum ProductStatus {
	/** Not ready to sell. Never listed on any channel. */
	DRAFT = 'DRAFT',
	/** Sellable where published; the catalogue lists it when `enabled` is also true. */
	ACTIVE = 'ACTIVE',
	/** Retained for history and for existing orders; never listed and never newly orderable. */
	ARCHIVED = 'ARCHIVED'
}

/**
 * What kind of stock location a warehouse is.
 *
 * It decides which locations the allocation strategy may pick and whether the stock held there is own
 * stock or a supplier's.
 */
export enum WarehouseType {
	/** Own stock at a distribution or storage facility. */
	WAREHOUSE = 'WAREHOUSE',
	/** Own stock at a retail location; usually also a pickup location. */
	STORE = 'STORE',
	/** Stock held by a logistics partner on our behalf. */
	THIRD_PARTY = 'THIRD_PARTY',
	/** Stock that ships from the supplier directly; the level is informational. */
	DROPSHIP = 'DROPSHIP',
	/** An aggregation or accounting location that never ships and holds no physical stock. */
	VIRTUAL = 'VIRTUAL'
}

/**
 * The scope a setting row is addressed at, and the resolution order is
 * `CHANNEL` → `ORGANIZATION` → `TENANT` → the compiled default.
 */
export enum SettingScope {
	/** The setting applies to every organization in the tenant; `channelId` must be null. */
	TENANT = 'TENANT',
	/** The setting applies to one organization; `channelId` must be null. */
	ORGANIZATION = 'ORGANIZATION',
	/** The setting applies to one channel; `channelId` must be set. */
	CHANNEL = 'CHANNEL'
}

/**
 * The lifecycle state of one money movement — what happened to *this* charge.
 *
 * It is derived from the row's own four amounts and its capture and refund rows and is never set
 * directly by a caller; the order-level paid state is a different question with its own column.
 */
export enum PaymentStatusDetail {
	/** Authorised, nothing captured. */
	AUTHORIZED = 'AUTHORIZED',
	/** Some of the authorised amount is captured. */
	PARTIALLY_CAPTURED = 'PARTIALLY_CAPTURED',
	/** Fully captured. */
	CAPTURED = 'CAPTURED',
	/** Captured, and part of the captured amount is refunded. */
	PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
	/** Fully refunded. */
	REFUNDED = 'REFUNDED',
	/** The authorisation was released before any capture. */
	CANCELED = 'CANCELED',
	/** The payment failed at the provider. */
	FAILED = 'FAILED'
}

/**
 * The commercial lifecycle of a party — customer, client, lead and seller contact alike.
 */
export enum ContactStatus {
	/** Known only from an order, a cart or an import: no credential and no verified identity. */
	GUEST = 'GUEST',
	/** A registered, verified contact. */
	ACTIVE = 'ACTIVE',
	/** Denied checkout and login; the profile and the order history are retained. */
	BLOCKED = 'BLOCKED',
	/** Retained for history, excluded from segmentation and from marketing. */
	ARCHIVED = 'ARCHIVED'
}

/**
 * Whether a party is a natural person or a legal entity.
 *
 * Every B2B reader branches on it, and before the column existed it was *inferred* from the presence
 * of buyer children plus the emptiness of the shared contact's fiscal fields — which meant removing a
 * company's last buyer silently turned it into an individual while its credit facility stayed on the
 * row.
 */
export enum PartyKind {
	/** A natural person. */
	INDIVIDUAL = 'INDIVIDUAL',
	/** A legal entity, which is what a company account and its buyer list require. */
	COMPANY = 'COMPANY'
}

/**
 * Which quantity a supplier's bill is matched against.
 *
 * It is the buy-side counterpart of the sales invoicing policy and deliberately a separate column:
 * buy and sell policies are independent processes that a tenant sets differently for the same
 * variant. Null means the effective term comes from the vendor product term, or from
 * `requiresShipping` when no term exists.
 */
export enum PurchaseBillingPolicy {
	/** A supplier's bill is matched against the ordered quantity. */
	ON_ORDERED = 'ON_ORDERED',
	/** A supplier's bill is matched against the received quantity. */
	ON_RECEIVED = 'ON_RECEIVED'
}
