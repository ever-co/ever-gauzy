import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '@gauzy/core';
import { HelpCenterArticleVersion } from './help-center-article-version.entity';

@EventSubscriber()
export class HelpCenterArticleVersionSubscriber extends BaseEntityEventSubscriber<HelpCenterArticleVersion> {
	/**
	 * Indicates that this subscriber only listens to HelpCenterArticleVersion events.
	 */
	listenTo() {
		return HelpCenterArticleVersion;
	}

	/**
	 * Serializes JSON fields for SQLite databases.
	 *
	 * @param entity The HelpCenterArticleVersion entity that is about to be serialized.
	 */
	private async serializeJsonFieldsForSQLite(entity: HelpCenterArticleVersion): Promise<void> {
		if (isSqlite() || isBetterSqlite3()) {
			// Serialize the `descriptionJson` field if it's an object
			if (entity.descriptionJson && typeof entity.descriptionJson === 'object') {
				try {
					entity.descriptionJson = JSON.stringify(entity.descriptionJson) as any;
				} catch (error) {
					console.error('HelpCenterArticleVersionSubscriber: Error serializing descriptionJson:', error.message);
				}
			}
		}
	}

	/**
	 * Called before a HelpCenterArticleVersion entity is inserted.
	 */
	async beforeEntityCreate(entity: HelpCenterArticleVersion): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Called before a HelpCenterArticleVersion entity is updated.
	 */
	async beforeEntityUpdate(entity: HelpCenterArticleVersion): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Handles parsing of JSON data after entity is loaded.
	 */
	async afterEntityLoad(entity: HelpCenterArticleVersion): Promise<void> {
		if (isSqlite() || isBetterSqlite3()) {
			// Parse the `descriptionJson` field if it's a string
			if (entity.descriptionJson && typeof entity.descriptionJson === 'string') {
				try {
					entity.descriptionJson = JSON.parse(entity.descriptionJson);
				} catch (error) {
					console.warn('HelpCenterArticleVersionSubscriber: descriptionJson is not valid JSON:', error.message);
				}
			}
		}
	}
}
