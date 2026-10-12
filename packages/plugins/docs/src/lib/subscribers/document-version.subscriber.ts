import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '@gauzy/core';
import { DocumentVersion } from '../entities/document-version.entity';

/**
 * Owns the SQLite JSON round-trip for `DocumentVersion` snapshot rows.
 *
 * NOTE on the debounced PAGE snapshot capture: the platform subscriber abstraction
 * (`BaseEntityEventSubscriber.beforeEntityUpdate`) receives only the incoming payload — not the
 * loaded database entity — so the pre-update content needed for a snapshot is not available here.
 * The debounced capture (default window 10 minutes, env `GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES`)
 * therefore lives in `DocumentVersionService.captureSnapshotIfNeeded(...)`, invoked from the one
 * code path that changes PAGE content (`UpdateDocumentContentCommand`) and from version restore.
 */
@EventSubscriber()
export class DocumentVersionSubscriber extends BaseEntityEventSubscriber<DocumentVersion> {
	private readonly logger = new Logger('DocumentVersionSubscriber');

	/**
	 * Indicates that this subscriber only listens to DocumentVersion events.
	 */
	listenTo() {
		return DocumentVersion;
	}

	/**
	 * Serializes JSON fields for SQLite databases.
	 *
	 * @param entity The DocumentVersion entity that is about to be persisted.
	 */
	private async serializeJsonFieldsForSQLite(entity: DocumentVersion): Promise<void> {
		if (isSqlite() || isBetterSqlite3()) {
			// Serialize the `contentJson` field if it's an object
			if (entity.contentJson && typeof entity.contentJson === 'object') {
				try {
					entity.contentJson = JSON.stringify(entity.contentJson) as any;
				} catch (error) {
					this.logger.error('Error serializing contentJson:', (error as Error).message);
				}
			}
		}
	}

	/**
	 * Called before a DocumentVersion entity is inserted.
	 */
	async beforeEntityCreate(entity: DocumentVersion): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Called before a DocumentVersion entity is updated.
	 */
	async beforeEntityUpdate(entity: DocumentVersion): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Handles parsing of JSON data after the entity is loaded.
	 */
	async afterEntityLoad(entity: DocumentVersion): Promise<void> {
		if (isSqlite() || isBetterSqlite3()) {
			// Parse the `contentJson` field if it's a string
			if (entity.contentJson && typeof entity.contentJson === 'string') {
				try {
					entity.contentJson = JSON.parse(entity.contentJson);
				} catch (error) {
					this.logger.warn('contentJson is not valid JSON:', (error as Error).message);
				}
			}
		}
	}
}
