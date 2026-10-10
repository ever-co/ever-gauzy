/**
 * Vocabularies the catalog plugin owns.
 *
 * They live beside the tables that store them rather than in the platform contract package, because
 * a value set belongs to the capability that defines it: the catalogue is the only writer of a
 * publication state, a collection type or a relation type, and a second capability that needs to read
 * one imports it from here rather than declaring a look-alike of its own.
 */

import { ID } from '@gauzy/contracts';

/**
 * Lifecycle gate of a product or a product category.
 *
 * The three values are deliberately the same as `PublicationStatus` so that a single navigation
 * filter can express "show me everything that is live" without a translation table.
 */
export enum ProductStatus {
	/** Not ready to sell. Never listed on any channel, whatever a channel publication says. */
	DRAFT = 'DRAFT',
	/** Sellable where published. */
	ACTIVE = 'ACTIVE',
	/** Retained for history and for existing orders; never listed and never newly orderable. */
	ARCHIVED = 'ARCHIVED'
}

/**
 * Publication state of a row on one channel.
 *
 * It is a separate vocabulary from `ProductStatus` because it answers a different question: the
 * product's own lifecycle is organization-wide, while this one is per channel and is the gate the
 * listing query applies for the channel it is serving.
 */
export enum PublicationStatus {
	/** Not published to this channel. The row exists so the intended publication is on record. */
	DRAFT = 'DRAFT',
	/** Published to this channel; `publishedAt` is stamped on the first transition into this value. */
	ACTIVE = 'ACTIVE',
	/** Withdrawn from this channel; `unpublishedAt` is stamped and the row is retained. */
	ARCHIVED = 'ARCHIVED'
}

/**
 * How a collection decides its membership.
 */
export enum CollectionType {
	/** Membership is exactly the pivot rows, in the order they declare. */
	MANUAL = 'MANUAL',
	/** Membership is computed at read time from the collection's rules; no pivot rows exist. */
	RULE_BASED = 'RULE_BASED',
	/** The union of both; a manual row wins on position and can pin an item the rules would exclude. */
	HYBRID = 'HYBRID'
}

/**
 * The commercial intent of a product-to-product link.
 *
 * Relations are directed: an upsell from one product to another does not create a relation back.
 */
export enum ProductRelationType {
	/** A peer relation with no commercial intent stated. */
	RELATED = 'RELATED',
	/** A higher-value alternative to the source product. */
	UPSELL = 'UPSELL',
	/** A complementary product commonly bought with the source. */
	CROSS_SELL = 'CROSS_SELL',
	/** An optional add-on for the source product. */
	ACCESSORY = 'ACCESSORY',
	/** A consumable or replacement part for the source product. */
	SPARE_PART = 'SPARE_PART'
}

/**
 * One catalogue item as a caller that does not own the catalogue reads it.
 *
 * A domain that references a product or a variant by identifier — a right granted over one, a plan
 * that delivers one — needs to be able to say what the identifier names, and the catalogue is the
 * only package that knows. The two members below are what such a caller asks for; the service that
 * answers returns the catalogue's own row beside them, so a caller reading the object over the
 * platform's GraphQL surface finds the fields the catalogue's own types declare rather than a
 * reduced projection of them.
 *
 * `sku` is carried because a caller may ask for it, and is reported as absent: nothing in this
 * catalogue stores a stock-keeping unit. The operator's own reference for a variant is its
 * `internalReference`, and the product's operator-facing identity is its `code`.
 */
export interface ICatalogItem {
	/** The product or variant. */
	readonly id: ID;
	/**
	 * The product's name, in the language the caller asked for. A variant has no name of its own:
	 * nothing in the catalogue names one, so this member is absent for a variant.
	 */
	readonly name?: string;
	/** Reported as absent: no stock-keeping unit is recorded for a product or a variant. */
	readonly sku?: string;
}
