import { AnalyticsInterface } from '@jitsu/js';
import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import * as chalk from 'chalk';
import { BaseEntityEventSubscriber } from '@gauzy/core';
import { environment } from '@gauzy/config';
import { createJitsu } from './jitsu-helper';

// Extract configuration values from environment
const { jitsu } = environment;

/* Global Entity Subscriber - Listens to all entity inserts updates and removal then sends to Jitsu */
@EventSubscriber()
export class JitsuEventsSubscriber extends BaseEntityEventSubscriber {
	private readonly logger = new Logger(JitsuEventsSubscriber.name);
	private readonly jitsuAnalytics: AnalyticsInterface;

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = false;

	constructor() {
		super();
		try {
			// Destructure configuration properties
			const { serverHost, serverWriteKey, debug, echoEvents } = jitsu;

			// Ensure required configuration properties are present
			if (!serverHost || !serverWriteKey) {
				console.error(chalk.yellow('Jitsu Analytics initialization failed: Missing host or writeKey.'));
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

			// Track an event with Jitsu Analytics
			// NOTE: we do not await before we want to track events asynchronously
			this.analyticsTrack('afterEntityCreate', { data: { ...entity } });
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

			// Track the updation event with Jitsu Analytics asynchronously
			this.analyticsTrack('afterEntityUpdate', { data: { entity } });
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

			// Track the deletion event with Jitsu Analytics asynchronously
			this.analyticsTrack('afterEntityDelete', { data: { entity } });
		} catch (error) {
			console.error('JitsuEventsSubscriber: Error during the afterEntityDelete process:', error);
		}
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
}
