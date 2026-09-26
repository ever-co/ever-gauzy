import { BaseEvent } from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { Collection } from '../collection/collection.entity';
import { ProductChannel } from '../product-channel/product-channel.entity';

/**
 * Raised when a collection is created, changed or moved.
 *
 * The event carries the collection's identity and its slug rather than the whole row: a subscriber
 * that needs the row reads it through the service, so an event never becomes a second, staler copy of
 * a record that has moved on by the time it is handled.
 */
export class CollectionChangedEvent extends BaseEvent {
	/**
	 * @param collectionId The collection that changed.
	 * @param slug The collection's slug, which is what a cached listing is invalidated by.
	 * @param organizationId The organization the collection belongs to.
	 */
	constructor(
		public readonly collectionId: ID,
		public readonly slug: string,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param collection The collection that changed.
	 * @returns The event describing it.
	 */
	static from(collection: Collection): CollectionChangedEvent {
		return new CollectionChangedEvent(collection.id, collection.slug, collection.organizationId);
	}
}

/**
 * Raised when a product becomes published on a channel.
 *
 * The pair is the identity, because publication is per channel and "the product changed" would not say
 * which listing a subscriber has to refresh.
 */
export class ProductPublishedEvent extends BaseEvent {
	/**
	 * @param productId The published product.
	 * @param channelId The channel it went live on.
	 * @param organizationId The organization the product belongs to.
	 */
	constructor(
		public readonly productId: ID,
		public readonly channelId: ID,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param publication The publication row that became active.
	 * @returns The event describing it.
	 */
	static from(publication: ProductChannel): ProductPublishedEvent {
		return new ProductPublishedEvent(
			publication.productId,
			publication.channelId,
			publication.organizationId
		);
	}
}

/**
 * Raised when a product is withdrawn from a channel.
 */
export class ProductUnpublishedEvent extends BaseEvent {
	/**
	 * @param productId The withdrawn product.
	 * @param channelId The channel it was withdrawn from.
	 * @param organizationId The organization the product belongs to.
	 */
	constructor(
		public readonly productId: ID,
		public readonly channelId: ID,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param publication The publication row that was withdrawn.
	 * @returns The event describing it.
	 */
	static from(publication: ProductChannel): ProductUnpublishedEvent {
		return new ProductUnpublishedEvent(
			publication.productId,
			publication.channelId,
			publication.organizationId
		);
	}
}
