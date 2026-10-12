import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventConsumerKind, EventConsumerOrdering, IEventConsumer, IEventConsumerContext, IEventEnvelope } from '@gauzy/contracts';
import { EventConsumerRegistry } from '@gauzy/core';
import { SEARCH_INDEX_DEFINITIONS } from './definitions';
import { SearchIndexRegistry } from './registry/search-index.registry';
import { SearchIndexerService } from './services/search-indexer.service';

/**
 * The consumer that keeps the index in step with the platform.
 *
 * It is a consumer rather than a listener for one reason: a delivery is recorded per `(event,
 * consumer)` before the work is done, so redelivery is free of charge. The consumer needs no
 * bookkeeping of its own — a redelivered event re-reads the same source row and writes the same
 * document, which the index's own key turns into an update rather than a duplicate.
 *
 * The events it wants are derived from the declarations rather than listed by hand. One declaration
 * per searchable entity produces three names — `<entity>.created`, `.updated`, `.deleted` — so a
 * package that registers a declaration is indexed from the moment it is loaded, and nobody has to
 * remember to add the event name here. The list is computed at bootstrap, after the declarations are
 * registered, because that is the first moment it is complete.
 *
 * Ordering is `reorderable`: a document is built from the source row as it is at the moment the event
 * is consumed, never from the event's payload, so applying two updates out of order leaves the row's
 * current state in the index either way. Strict ordering would trade a real guarantee for a queue
 * stall, and the guarantee it would buy is not the one this projection needs.
 */
@Injectable()
export class SearchIndexConsumer implements IEventConsumer, OnApplicationBootstrap {
	/** The consumer key, namespaced by what it maintains rather than by the package that ships it. */
	readonly key = 'search-index';

	readonly kind = EventConsumerKind.SUBSCRIBER;

	readonly ordering = EventConsumerOrdering.REORDERABLE;

	/** Enough attempts to ride out a database blip, few enough that a broken declaration is visible. */
	readonly maxAttempts = 8;

	private readonly logger = new Logger(SearchIndexConsumer.name);

	constructor(
		private readonly consumerRegistry: EventConsumerRegistry,
		private readonly indexer: SearchIndexerService,
		private readonly indexRegistry: SearchIndexRegistry
	) {}

	/**
	 * The event names this consumer wants, one triple per registered entity per spelling of its name.
	 *
	 * It is a getter rather than a field, and it reads the registry rather than a list captured at
	 * construction, because a declaration registered after this class was built still has to be
	 * indexed: the delivery registry asks a consumer what it handles at the moment it has an event to
	 * fan out, so a declaration that arrives later is served without anything being re-registered.
	 *
	 * **The match is exact, so every spelling has to be declared.** `EventConsumerRegistry.consumersFor`
	 * selects with `events.includes(eventName)` — no normalisation, no pattern. A declaration names its
	 * entity by the table it lives in (`product_variant`), while the producers on this branch name an
	 * event after the domain noun in whichever form that package writes it: `seller.created`,
	 * `productVariant.updated`, `PRODUCT_VARIANT.deleted`. A consumer that declared only the table
	 * spelling would be registered, would report a healthy event list, and would never once be invoked
	 * — which is indistinguishable from a dispatcher that is not running. The four spellings are
	 * derived from the entity key rather than listed, so a new declaration is covered by all of them
	 * without anybody remembering to add one.
	 */
	get events(): string[] {
		const names = new Set<string>();

		for (const entity of this.indexRegistry.registeredEntities()) {
			for (const spelling of spellingsOf(entity)) {
				for (const action of ['created', 'updated', 'deleted']) {
					names.add(`${spelling}.${action}`);
				}
			}
		}

		return Array.from(names);
	}

	/**
	 * Registers the shipped declarations and then this consumer.
	 *
	 * The order matters and is the reason both steps are here: a consumer that declared its events
	 * before the declarations were registered would claim none, and would be indistinguishable from a
	 * consumer with nothing to do.
	 */
	onApplicationBootstrap(): void {
		try {
			this.indexRegistry.registerShipped(SEARCH_INDEX_DEFINITIONS);
			this.consumerRegistry.register(this);
		} catch (error) {
			// A consumer that cannot be registered leaves the index stale, not the platform broken; the
			// failure is logged with the reason rather than swallowed.
			this.logger.error(`The search index consumer could not be registered: ${describe(error)}`);
		}
	}

	/**
	 * Applies one delivered event to the index.
	 *
	 * What the dispatcher owes this consumer is narrow and worth stating, because the index is only as
	 * fresh as the delivery: the envelope must carry `aggregate.type` and `aggregate.id` (the type is
	 * how the entity is resolved and the id is the row that is re-read), and `tenantId` /
	 * `organizationId` where the source row has them — the document is written into the scope the
	 * envelope names, not into the scope of whichever thread happens to be running. A failure here is
	 * thrown rather than swallowed so that the delivery record marks the attempt failed and the event
	 * is redelivered; a redelivery costs one re-read and one idempotent write of the same document,
	 * which is the whole reason this is a consumer rather than a listener.
	 *
	 * @param event The event envelope.
	 * @param context The delivery context; the runner records the outcome, so nothing is written here.
	 */
	async handle(event: IEventEnvelope, context?: IEventConsumerContext): Promise<void> {
		void context;

		const outcome = await this.indexer.handleEvent(event);

		if (!outcome) {
			// The event named an aggregate nothing indexes, or carried no id. It is a successful
			// delivery — there is nothing to do — but it is logged, because a consumer that quietly does
			// nothing for every event it receives looks exactly like a dispatcher that is not running.
			this.logger.debug(
				`The event "${event?.name}" named the aggregate "${event?.aggregate?.type}", which no index ` +
					'declaration describes, so the index was not changed.'
			);

			return;
		}

		if (outcome.indexed > 0 || outcome.removed > 0 || outcome.skipped > 0) {
			this.logger.debug(
				`The "${outcome.entity}" index was updated by "${event.name}": ` +
					`${outcome.indexed} written, ${outcome.removed} removed, ${outcome.skipped} skipped.`
			);
		}
	}
}

/**
 * The spellings one entity key is written in across the platform's event producers.
 *
 * `product_variant` is also written `productVariant`, `product-variant` and `PRODUCT_VARIANT`
 * depending on which package emits the event and whether the name came from the table, the class or
 * the outbox row's aggregate type. The set is derived rather than listed, and it is a set, so a
 * single-word entity such as `invoice` contributes one spelling and not four.
 *
 * @param entity The entity key, as a declaration states it.
 * @returns The spellings, without duplicates.
 */
function spellingsOf(entity: string): string[] {
	const key = String(entity ?? '').trim();

	if (!key) {
		return [];
	}

	const words = key.split('_').filter(Boolean);
	const camel = words
		.map((word, index) => (index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
		.join('');

	return Array.from(new Set([key, camel, words.join('-'), key.toUpperCase()]));
}

/**
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
