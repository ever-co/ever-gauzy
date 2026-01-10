import { EventSubscriber } from "typeorm";
import { isBetterSqlite3, isSqlite } from "@gauzy/config";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { MultiOrmEntityManager } from "../core/entities/subscribers/entity-event-subscriber.types";
import { SharedEntity } from "./shared-entity.entity";

@EventSubscriber()
export class SharedEntitySubscriber extends BaseEntityEventSubscriber<SharedEntity> {
    /**
     * Indicates that this subscriber only listen to SharedEntity events.
     */
    listenTo() {
        return SharedEntity;
    }

    /**
     * Serializes the shareRules and sharedOptions properties to a JSON string for SQLite databases.
     *
     * @param entity The SharedEntity entity that is about to be serialized.
     * @returns {Promise<void>} A promise that resolves when the serialization is complete.
     */
    private async serializeShareRulesAndSharedOptionsForSQLite(entity: SharedEntity): Promise<void> {
        try {
            // Check if the database is SQLite
            if (isSqlite() || isBetterSqlite3()) {
                // serialize the `shareRules` field if it's an object
                if (typeof entity.shareRules === 'object') {
                    entity.shareRules = JSON.stringify(entity.shareRules);
                }

                // serialize the `sharedOptions` field if it's an object
                if (typeof entity.sharedOptions === 'object') {
                    entity.sharedOptions = JSON.stringify(entity.sharedOptions);
                }
            }
        } catch (error) {
            // Log the error and reset the sharedOptions to an empty object if JSON parsing fails
            console.error('Error stringify sharedOptions:', error);
            entity.shareRules = JSON.stringify({ fields: [] });
            entity.sharedOptions = '{}';
        }
    }

    /**
     * Called before a SharedEntity entity is inserted or created in the database.
     * This method prepares the entity for insertion, particularly by serializing the shareRules and sharedOptions properties to a JSON string
     * for SQLite databases.
     *
     * @param entity The SharedEntity entity that is about to be created.
     * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
     */
    async beforeEntityCreate(entity: SharedEntity): Promise<void> {
        await this.serializeShareRulesAndSharedOptionsForSQLite(entity);
    }

    /**
     * Called before a SharedEntity entity is updated in the database.
     * This method prepares the entity for update, particularly by serializing the shareRules and sharedOptions properties to a JSON string
     * for SQLite databases.
     *
     * @param entity The SharedEntity entity that is about to be updated.
     * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
     */
    async beforeEntityUpdate(entity: SharedEntity, em?: MultiOrmEntityManager): Promise<void> {
        await this.serializeShareRulesAndSharedOptionsForSQLite(entity);
    }

    /**
     * Handles the parsing of JSON data after the SharedEntity entity is loaded from the database.
     * This function ensures that if the database is SQLite, the `shareRules` and `sharedOptions` fields, stored as a JSON string,
     * are parsed back into a JavaScript object.
     *
     * @param entity The SharedEntity entity that has been loaded from the database.
     * @param em The optional EntityManager instance, if provided.
     * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
     */
    async afterEntityLoad(entity: SharedEntity, em?: MultiOrmEntityManager): Promise<void> {
        try {
            // Check if the database is SQLite
            if (isSqlite() || isBetterSqlite3()) {
                // Parse the `shareRules` field if it's a string
                if (entity.shareRules && typeof entity.shareRules === 'string') {
                    entity.shareRules = JSON.parse(entity.shareRules);
                }

                // Parse the `sharedOptions` field if it's a string
                if (entity.sharedOptions && typeof entity.sharedOptions === 'string') {
                    entity.sharedOptions = JSON.parse(entity.sharedOptions);
                }
            }
        } catch (error) {
            // Log the error and reset the shareRules and sharedOptions to an empty object if JSON parsing fails
            console.error('Error parsing JSON data:', error);
            entity.shareRules = { fields: [], relations: {} };
            entity.sharedOptions = {};
        }
    }
}
