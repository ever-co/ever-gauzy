import { AnalyticsInterface } from '@jitsu/js';
import { Logger } from '@nestjs/common';
import {
	EntityMetadata,
	EventSubscriber,
	InsertEvent,
	RemoveEvent,
	UpdateEvent,
	getMetadataArgsStorage
} from 'typeorm';
import * as chalk from 'chalk';
import { BaseEntityEventSubscriber, ExportEntityClass, redactForExport } from '@gauzy/core';
import { environment } from '@gauzy/config';
import { createJitsu } from './jitsu-helper';
import {
	BoundedEventQueue,
	DEFAULT_JITSU_MAX_CONCURRENT_EVENTS,
	DEFAULT_JITSU_MAX_QUEUED_EVENTS,
	readCountEnv
} from './jitsu-event-queue';

// Extract configuration values from environment
const { jitsu } = environment;

/** What `afterUpdate` receives: a MikroORM `EventArgs` or a TypeORM `UpdateEvent`. */
type AfterUpdateEvent = Parameters<BaseEntityEventSubscriber['afterUpdate']>[0];

/* Global Entity Subscriber - Listens to all entity inserts updates and removal then sends to Jitsu */
@EventSubscriber()
export class JitsuEventsSubscriber extends BaseEntityEventSubscriber {
	private readonly logger = new Logger(JitsuEventsSubscriber.name);
	private readonly jitsuAnalytics: AnalyticsInterface;

	/**
	 * Entity events on their way to Jitsu, sent a few at a time (`JITSU_MAX_CONCURRENT_EVENTS`, default 4)
	 * with a bounded backlog (`JITSU_MAX_QUEUED_EVENTS`, default 1000). See {@link BoundedEventQueue}.
	 */
	private readonly events = new BoundedEventQueue<{ event: string; properties: Record<string, any> }>(
		({ event, properties }) => this.analyticsTrack(event, properties),
		{
			concurrency: readCountEnv('JITSU_MAX_CONCURRENT_EVENTS', DEFAULT_JITSU_MAX_CONCURRENT_EVENTS),
			maxQueued: readCountEnv('JITSU_MAX_QUEUED_EVENTS', DEFAULT_JITSU_MAX_QUEUED_EVENTS),
			onDropped: (dropped) =>
				this.logger.warn(`Dropped ${dropped} entity event(s): more were written than Jitsu could be sent.`)
		}
	);

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = false;

	/**
	 * The entity class of each TypeORM event row. A query builder write (`repository.update(id, { code })`)
	 * hands its hooks the plain values it sets, and nothing else in them says which entity they belong to.
	 */
	private readonly eventRowClasses = new WeakMap<object, ExportEntityClass>();

	/** The entity class each relation property points to, per entity class; `null` for a class that is not an entity. */
	private readonly entityRelations = new Map<unknown, Map<string, ExportEntityClass> | null>();

	constructor() {
		super();
		try {
			// Destructure configuration properties
			const { serverHost, serverWriteKey, debug, echoEvents } = jitsu;

			// Ensure required configuration properties are present
			if (!serverHost || !serverWriteKey) {
				console.error(chalk.yellow('Jitsu Analytics initialization failed at JitsuEventsSubscriber: Missing host or writeKey.'));
				return;
			}

			const jitsuConfig = { host: serverHost, writeKey: serverWriteKey, debug, echoEvents };

			if (this.logEnabled) {
				this.logger.log('JITSU Configuration:', chalk.magenta(JSON.stringify(jitsuConfig)));
			}

			// Initialize Jitsu Analytics with the configuration
			this.jitsuAnalytics = createJitsu(jitsuConfig);
		} catch (error) {
			console.error(chalk.red(`Jitsu Analytics initialization error: ${error.message}`));
		}
	}

	afterInsert(event: InsertEvent<unknown>): Promise<void> {
		this.rememberRowClass(event.entity, event.metadata);
		return super.afterInsert(event);
	}

	afterUpdate(event: AfterUpdateEvent): Promise<void> {
		this.rememberRowClass(event.entity, (event as UpdateEvent<unknown>).metadata);
		return super.afterUpdate(event);
	}

	afterRemove(event: RemoveEvent<unknown>): Promise<void> {
		this.rememberRowClass(event.entity, event.metadata);
		return super.afterRemove(event);
	}

	/**
	 * This method is called after an entity has been created and inserted into the database.
	 * It can be used to perform additional operations or processing on the newly persisted entity.
	 *
	 * @param entity The entity that has just been created and inserted.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for additional database operations if necessary.
	 * @returns {Promise<void>} A promise that resolves when the post-creation processing is complete.
	 */
	async afterEntityCreate(entity: any): Promise<void> {
		try {
			if (this.logEnabled) {
				this.logger.log(`AFTER ENTITY INSERTED: `, JSON.stringify(entity));
			}

			// Queued, not sent here: see `events`.
			if (this.jitsuAnalytics) {
				this.enqueueTrack('afterEntityCreate', () => ({ data: { ...this.redactRow(entity, true) } }));
			}
		} catch (error) {
			// Error handling logic
			console.error('JitsuEventsSubscriber: Error during the afterEntityCreate process:', error);
		}
	}

	/**
	 * This method is called after an entity has been updated in the database.
	 * It can be used to perform additional operations or processing on the entity following its update.
	 *
	 * @param entity The entity that has just been updated.
	 * @returns {Promise<void>} A promise that resolves when the post-update processing is complete.
	 */
	async afterEntityUpdate(entity: any): Promise<void> {
		try {
			// Log the entity update if logging is enabled
			if (this.logEnabled) {
				this.logger.log(`AFTER ENTITY UPDATED: `, JSON.stringify(entity));
			}

			// Queued, not sent here: see `events`.
			if (this.jitsuAnalytics) {
				this.enqueueTrack('afterEntityUpdate', () => ({ data: { entity: this.redactRow(entity) } }));
			}
		} catch (error) {
			// Error handling logic
			console.error('JitsuEventsSubscriber: Error during the afterEntityUpdate process:', error);
		}
	}

	/**
	 * Called after an entity is deleted from the database. This method logs the deletion and
	 * tracks it with Jitsu Analytics.
	 *
	 * @param entity The entity that has just been deleted.
	 * @param em An optional entity manager for any additional database operations, if needed.
	 * @returns {Promise<void>} A promise that resolves when the post-deletion processing is complete.
	 */
	async afterEntityDelete(entity: any): Promise<void> {
		try {
			// Log the entity removal if logging is enabled
			if (this.logEnabled) {
				this.logger.log('AFTER ENTITY REMOVED:', JSON.stringify(entity));
			}

			// Queued, not sent here: see `events`.
			if (this.jitsuAnalytics) {
				this.enqueueTrack('afterEntityDelete', () => ({ data: { entity: this.redactRow(entity) } }));
			}
		} catch (error) {
			console.error('JitsuEventsSubscriber: Error during the afterEntityDelete process:', error);
		}
	}

	/**
	 * Queues an entity event for Jitsu. `properties` runs only when the event is kept, and runs at once, so
	 * the row is copied (and redacted) as it is now and not at all when the queue is full.
	 *
	 * @returns whether the event was queued.
	 */
	enqueueTrack(event: string, properties: () => Record<string, any>): boolean {
		// A JSON copy, as the analytics core used to take the moment `track` was called: the event now waits
		// in the queue, and the redacted copy still shares nested values (JSON columns, arrays) with the row,
		// so a later write to the row would otherwise change what is sent for this one.
		return this.events.offer(() => ({ event, properties: JSON.parse(JSON.stringify(properties())) }));
	}

	/**
	 * Track an analytics event using Jitsu Analytics.
	 *
	 * @param event The name of the event to track.
	 * @param properties Optional properties to include with the event tracking.
	 * @returns {Promise<void>} A promise that resolves when the tracking is complete.
	 */
	async analyticsTrack(event: string, properties?: Record<string, any> | null): Promise<void> {
		if (!this.jitsuAnalytics) {
			return;
		}

		try {
			if (this.logEnabled) {
				this.logger.log(
					`Before Jitsu Tracking Entity Events: ${event}`,
					chalk.magenta(JSON.stringify(properties))
				);
			}

			// Track the event
			const tracked = await this.trackEvent(event, properties);

			if (this.logEnabled) {
				this.logger.log(`After Jitsu Tracked Entity Events`, chalk.blue(JSON.stringify(tracked)));
			}
		} catch (error) {
			this.logger.error(`Error while Jitsu tracking event. Unable to track event: ${error.message}`);
		}
	}

	/**
	 * Track an event with optional properties.
	 * @param event The name of the event to track.
	 * @param properties Additional data or properties associated with the event.
	 * @returns A Promise that resolves when the event is tracked.
	 */
	async trackEvent(event: string, properties?: Record<string, any> | null): Promise<any> {
		return await this.jitsuAnalytics.track(event, properties);
	}

	/**
	 * Identify a user with optional user traits.
	 * @param id The user identifier, such as a user ID or an object representing user information.
	 * @param traits User traits or properties to associate with the user.
	 * @returns A Promise that resolves when the user is identified.
	 */
	async identify(id: string | object, traits?: Record<string, any> | null): Promise<any> {
		return await this.jitsuAnalytics.identify(id, traits);
	}

	/**
	 * Group users into a specific segment or organization.
	 * @param id The identifier for the group, such as a group ID or an object representing group information.
	 * @param traits Additional data or traits associated with the group.
	 * @returns A Promise that resolves when the users are grouped.
	 */
	async group(id: string | object, traits?: Record<string, any> | null): Promise<any> {
		return await this.jitsuAnalytics.group(id, traits);
	}

	private rememberRowClass(row: unknown, metadata?: EntityMetadata): void {
		if (row && typeof row === 'object' && typeof metadata?.target === 'function') {
			this.eventRowClasses.set(row, metadata.target as ExportEntityClass);
		}
	}

	/**
	 * Copies an event row with the columns marked `@ExportRedacted` masked, the way a CSV export masks them,
	 * in the row and in the relations loaded on it. The row itself is left as it is: the ORM, the caller and
	 * the other subscribers still hold it.
	 *
	 * @param row - The entity, or the plain values a query builder wrote.
	 * @param ownProperties - Copy the row's own properties, as spreading it does, rather than its `toJSON()`.
	 */
	private redactRow(row: object, ownProperties = false): Record<string, unknown> {
		const rowClass = this.eventRowClasses.get(row);
		return this.redactValue(row, rowClass, ownProperties, new WeakMap()) as Record<string, unknown>;
	}

	/**
	 * Masks one value of an event the way {@link redactRow} does, keeping the shape `JSON.stringify` gives it.
	 *
	 * @param value - A row, a relation, or any value inside one.
	 * @param entityClass - The entity class `value` belongs to when the value does not say it itself: a plain
	 * query builder row, a relation serialized by `toJSON()`, the items of a relation.
	 * @param ownProperties - See {@link redactRow}.
	 * @param copies - The copies made so far, so a cycle between relations stays a cycle instead of recursing forever.
	 */
	private redactValue(
		value: unknown,
		entityClass: ExportEntityClass | undefined,
		ownProperties: boolean,
		copies: WeakMap<object, unknown>
	): unknown {
		if (!value || typeof value !== 'object' || value instanceof Date) {
			return value;
		}
		if (copies.has(value)) {
			return copies.get(value);
		}
		if (Array.isArray(value)) {
			const items: unknown[] = [];
			copies.set(value, items);
			for (const item of value) {
				items.push(this.redactValue(item, entityClass, false, copies));
			}
			return items;
		}

		const type = Object.getPrototypeOf(value)?.constructor;
		const rowClass = this.getEntityRelations(type) ? (type as ExportEntityClass) : entityClass;

		// JSON.stringify sends what toJSON() returns (a MikroORM entity or collection), so that is what gets masked.
		if (!ownProperties && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
			const json = this.redactValue((value as { toJSON(): unknown }).toJSON(), rowClass, true, copies);
			copies.set(value, json);
			return json;
		}
		if (!rowClass) {
			return value;
		}

		const row = redactForExport(rowClass, value);
		copies.set(value, row);
		const relations = this.getEntityRelations(rowClass);
		for (const [property, nested] of Object.entries(row)) {
			row[property] = this.redactValue(nested, relations?.get(property), false, copies);
		}
		return row;
	}

	/**
	 * The entity class each relation of `type` points to, by property name. Read from the TypeORM
	 * decorators, which every entity registers under both ORMs, so it needs no entity manager.
	 *
	 * @returns `null` when `type` is not an entity class.
	 */
	private getEntityRelations(type: unknown): Map<string, ExportEntityClass> | null {
		if (typeof type !== 'function') {
			return null;
		}
		let relations = this.entityRelations.get(type);
		if (relations === undefined) {
			relations = null;
			const storage = getMetadataArgsStorage();
			if (storage.filterTables(type).length > 0) {
				const ancestors: ExportEntityClass[] = [];
				for (let cursor: unknown = type; typeof cursor === 'function'; cursor = Object.getPrototypeOf(cursor)) {
					ancestors.push(cursor as ExportEntityClass);
				}
				relations = new Map();
				for (const relation of storage.filterRelations(ancestors)) {
					const target = typeof relation.type === 'function' ? (relation.type as () => unknown)() : undefined;
					if (typeof target === 'function') {
						relations.set(relation.propertyName, target as ExportEntityClass);
					}
				}
			}
			this.entityRelations.set(type, relations);
		}
		return relations;
	}
}
