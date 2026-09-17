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
	 * The event names this consumer wants, one triple per registered entity.
	 *
	 * It is a getter rather than a field, and it reads the registry rather than a list captured at
	 * construction, because a declaration registered after this class was built still has to be
	 * indexed: the delivery registry asks a consumer what it handles at the moment it has an event to
	 * fan out, so a declaration that arrives later is served without anything being re-registered.
	 */
	get events(): string[] {
		return this.indexRegistry
			.registeredEntities()
			.flatMap((entity) => [`${entity}.created`, `${entity}.updated`, `${entity}.deleted`]);
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
	 * @param event The event envelope.
	 * @param context The delivery context; the runner records the outcome, so nothing is written here.
	 */
	async handle(event: IEventEnvelope, context?: IEventConsumerContext): Promise<void> {
		void context;

		const outcome = await this.indexer.handleEvent(event);

		if (!outcome) {
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
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
