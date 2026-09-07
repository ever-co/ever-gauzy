import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber, FileStorage } from '@gauzy/core';
import { Document } from '../entities/document.entity';

@EventSubscriber()
export class DocumentSubscriber extends BaseEntityEventSubscriber<Document> {
	private readonly logger = new Logger('DocumentSubscriber');

	/**
	 * Indicates that this subscriber only listens to Document events.
	 */
	listenTo() {
		return Document;
	}

	/**
	 * Serializes the `json`-shorthand columns for SQLite databases, where they are plain text.
	 *
	 * @param entity The Document entity that is about to be persisted.
	 */
	private async serializeJsonFieldsForSQLite(entity: Document): Promise<void> {
		if (isSqlite() || isBetterSqlite3()) {
			// Serialize the `contentJson` field if it's an object
			if (entity.contentJson && typeof entity.contentJson === 'object') {
				try {
					entity.contentJson = JSON.stringify(entity.contentJson) as any;
				} catch (error) {
					this.logger.error('Error serializing contentJson:', (error as Error).message);
				}
			}

			// Serialize the `metadata` field if it's an object
			if (entity.metadata && typeof entity.metadata === 'object') {
				try {
					entity.metadata = JSON.stringify(entity.metadata) as any;
				} catch (error) {
					this.logger.error('Error serializing metadata:', (error as Error).message);
				}
			}
		}
	}

	/**
	 * Called before a Document entity is inserted.
	 */
	async beforeEntityCreate(entity: Document): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Called before a Document entity is updated.
	 */
	async beforeEntityUpdate(entity: Document): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Called after a Document entity is loaded from the database:
	 * - parses the `json`-shorthand columns back into objects on SQLite;
	 * - resolves the virtual `fileUrl`/`thumbUrl` from the storage provider
	 *   (signed URL where the provider supports it). Errors degrade to `null`, never throw.
	 *
	 * @param entity The Document entity that was loaded.
	 */
	async afterEntityLoad(entity: Document): Promise<void> {
		if (!(entity instanceof Document)) {
			return; // Exit if the entity is not a Document instance
		}

		this.parseJsonFieldsForSQLite(entity);
		await this.resolveVirtualUrls(entity);
	}

	/**
	 * Parses the `json`-shorthand columns back into objects on SQLite, where they are stored as
	 * plain text by `serializeJsonFieldsForSQLite`. Invalid JSON is left as-is (warn only) —
	 * a malformed cache must never fail an entity load.
	 *
	 * @param entity The Document entity that was loaded.
	 */
	private parseJsonFieldsForSQLite(entity: Document): void {
		if (!isSqlite() && !isBetterSqlite3()) {
			return;
		}

		// Parse the `contentJson` field if it's a string
		if (entity.contentJson && typeof entity.contentJson === 'string') {
			try {
				entity.contentJson = JSON.parse(entity.contentJson);
			} catch (error) {
				this.logger.warn('contentJson is not valid JSON:', (error as Error).message);
			}
		}

		// Parse the `metadata` field if it's a string
		if (entity.metadata && typeof entity.metadata === 'string') {
			try {
				entity.metadata = JSON.parse(entity.metadata);
			} catch (error) {
				this.logger.warn('metadata is not valid JSON:', (error as Error).message);
			}
		}
	}

	/**
	 * Resolves the virtual `fileUrl`/`thumbUrl` from the storage provider (signed URL where the
	 * provider supports it), for FILE documents only. Errors degrade to `null`, never throw.
	 *
	 * @param entity The Document entity that was loaded.
	 */
	private async resolveVirtualUrls(entity: Document): Promise<void> {
		try {
			const { storageProvider, storageKey, thumbKey } = entity;
			if (storageProvider && storageKey) {
				const provider = new FileStorage().setProvider(storageProvider).getProviderInstance();
				entity.fileUrl = await provider.url(storageKey);

				if (thumbKey) {
					entity.thumbUrl = await provider.url(thumbKey);
				}
			}
		} catch (error) {
			this.logger.error('Error resolving file URLs during afterEntityLoad:', (error as Error).message);
			entity.fileUrl = null;
			entity.thumbUrl = null;
		}
	}
}
