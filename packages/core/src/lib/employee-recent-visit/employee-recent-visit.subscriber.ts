import { EventSubscriber } from "typeorm";
import { isBetterSqlite3, isSqlite } from "@gauzy/config";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { MultiOrmEntityManager } from "../core/entities/subscribers/entity-event-subscriber.types";
import { EmployeeRecentVisit } from "./employee-recent-visit.entity";

@EventSubscriber()
export class EmployeeRecentVisitSubscriber extends BaseEntityEventSubscriber<EmployeeRecentVisit> {
    /**
     * Indicates that this subscriber only listen to EmployeeRecentVisit events.
     */
    listenTo() {
        return EmployeeRecentVisit;
    }

    /**
     * Serializes the data property to a JSON string for SQLite databases.
     *
     * @param entity The EmployeeRecentVisit entity that is about to be serialized.
     * @returns {Promise<void>} A promise that resolves when the serialization is complete.
     */
    private async serializeDataForSQLite(entity: EmployeeRecentVisit): Promise<void> {
        try {
            // Check if the database is SQLite
            if (isSqlite() || isBetterSqlite3()) {
                // serialize the `data` field if it's an object
                if (typeof entity.data === 'object') {
                    entity.data = JSON.stringify(entity.data);
                }
            }
        } catch (error) {
            // Log the error and reset the data to an empty object if JSON parsing fails
            console.error('Error stringify data:', error);
            entity.data = '{}';
        }
    }

    /**
     * Called before an EmployeeRecentVisit entity is inserted or created in the database.
     * This method prepares the entity for insertion, particularly by serializing the data property to a JSON string
     * for SQLite databases.
     *
     * @param entity The EmployeeRecentVisit entity that is about to be created.
     * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
     */
    async beforeEntityCreate(entity: EmployeeRecentVisit): Promise<void> {
        await this.serializeDataForSQLite(entity);
    }

    /**
     * Called before an EmployeeRecentVisit entity is updated in the database.
     * This method prepares the entity for update, particularly by serializing the data property to a JSON string
     * for SQLite databases.
     *
     * @param entity The EmployeeRecentVisit entity that is about to be updated.
     * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
     */
    async beforeEntityUpdate(entity: EmployeeRecentVisit, em?: MultiOrmEntityManager): Promise<void> {
        await this.serializeDataForSQLite(entity);
    }

    /**
     * Handles the parsing of JSON data after the EmployeeRecentVisit entity is loaded from the database.
     * This function ensures that if the database is SQLite, the `data` field, stored as a JSON string,
     * is parsed back into a JavaScript object.
     *
     * @param entity The EmployeeRecentVisit entity that has been loaded from the database.
     * @param em The optional EntityManager instance, if provided.
     * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
     */
    async afterEntityLoad(entity: EmployeeRecentVisit, em?: MultiOrmEntityManager): Promise<void> {
        try {
            // Check if the database is SQLite
            if (isSqlite() || isBetterSqlite3()) {
                // Parse the `data` field if it's a string
                if (entity.data && typeof entity.data === 'string') {
                    entity.data = JSON.parse(entity.data);
                }
            }
        } catch (error) {
            // Log the error and reset the data to an empty object if JSON parsing fails
            console.error('Error parsing JSON data:', error);
            entity.data = {};
        }
    }
}
