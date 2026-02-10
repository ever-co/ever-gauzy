import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '@gauzy/core';
import { HelpCenterArticle } from './help-center-article.entity';

@EventSubscriber()
export class HelpCenterArticleSubscriber extends BaseEntityEventSubscriber<HelpCenterArticle> {
	/**
	 * Indicates that this subscriber only listens to HelpCenterArticle events.
	 */
	listenTo() {
		return HelpCenterArticle;
	}

	/**
	 * Serializes JSON fields for SQLite databases.
	 *
	 * @param entity The HelpCenterArticle entity that is about to be serialized.
	 */
	private async serializeJsonFieldsForSQLite(entity: HelpCenterArticle): Promise<void> {
		if (isSqlite() || isBetterSqlite3()) {
			// Serialize the `descriptionJson` field if it's an object
			if (entity.descriptionJson && typeof entity.descriptionJson === 'object') {
				try {
					entity.descriptionJson = JSON.stringify(entity.descriptionJson) as any;
				} catch (error) {
					console.error('HelpCenterArticleSubscriber: Error serializing descriptionJson:', error.message);
				}
			}
		}
	}

	/**
	 * Called before a HelpCenterArticle entity is inserted.
	 */
	async beforeEntityCreate(entity: HelpCenterArticle): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Called before a HelpCenterArticle entity is updated.
	 */
	async beforeEntityUpdate(entity: HelpCenterArticle): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Handles parsing of JSON data after entity is loaded.
	 */
	async afterEntityLoad(entity: HelpCenterArticle): Promise<void> {
		if (isSqlite() || isBetterSqlite3()) {
			// Parse the `descriptionJson` field if it's a string
			if (entity.descriptionJson && typeof entity.descriptionJson === 'string') {
				try {
					entity.descriptionJson = JSON.parse(entity.descriptionJson);
				} catch (error) {
					console.warn('HelpCenterArticleSubscriber: descriptionJson is not valid JSON:', error.message);
				}
			}
		}
	}
}
