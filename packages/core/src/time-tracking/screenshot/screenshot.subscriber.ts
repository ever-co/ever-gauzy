import {
    DataSourceOptions,
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    LoadEvent,
    RemoveEvent,
    UpdateEvent
} from "typeorm";
import { IScreenshot } from "@gauzy/contracts";
import { getConfig } from "@gauzy/config";
import { isJsObject } from "@gauzy/common";
import { Screenshot } from "./screenshot.entity";
import { FileStorage } from "./../../core/file-storage";
import { isSqliteDB } from "./../../core/utils";

@EventSubscriber()
export class ScreenshotSubscriber implements EntitySubscriberInterface<Screenshot> {

    /**
    * Indicates that this subscriber only listen to Screenshot events.
    */
    listenTo() {
        return Screenshot;
    }

    /**
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Screenshot>): void | Promise<any> {
        try {
            if (event) {
                const options: Partial<DataSourceOptions> = event.connection.options || getConfig().dbConnectionOptions;
                const { entity } = event;

                // Check if the database type is SQLite or better-sqlite3
                if (isSqliteDB(options.type)) {
                    try {
                        if (isJsObject(entity.apps)) {
                            entity.apps = JSON.stringify(entity.apps);
                        }
                    } catch (error) {
                        // Handle the error appropriately, set a default value or take another action.
                        entity.apps = JSON.stringify({});
                    }
                }
            }
        } catch (error) {
            console.error('Error in beforeInsert event:', error);
        }
    }

    /**
     * Called before a Screenshot entity is updated in the database.
     *
     * @param event The update event.
     */
    beforeUpdate(event: UpdateEvent<Screenshot>): void | Promise<any> {
        try {
            if (event) {
                const options: Partial<DataSourceOptions> = event.connection.options || getConfig().dbConnectionOptions;
                const { entity } = event;

                // Check if the database type is SQLite or better-sqlite3
                if (isSqliteDB(options.type)) {
                    try {
                        if (isJsObject(entity.apps)) {
                            entity.apps = JSON.stringify(entity.apps);
                        }
                    } catch (error) {
                        // Handle the error appropriately, set a default value or take another action.
                        entity.apps = JSON.stringify({});
                    }
                }
            }
        } catch (error) {
            console.error('Error in beforeUpdate event:', error);
        }
    }

    /**
     * Called after the entity is loaded from the database.
     *
     * @param entity The loaded Screenshot entity.
     * @param event The LoadEvent.
     */
    async afterLoad(entity: Screenshot | Partial<Screenshot>, event?: LoadEvent<Screenshot>): Promise<any | void> {
        try {
            const options: Partial<DataSourceOptions> = event.connection.options || getConfig().dbConnectionOptions;

            // Check if the entity is an instance of Screenshot
            if (entity instanceof Screenshot) {
                const { storageProvider, file, thumb, apps } = entity;

                const store = new FileStorage().setProvider(storageProvider);

                // Assuming store.getProviderInstance().url is asynchronous
                const [fullUrl, thumbUrl] = await Promise.all([
                    store.getProviderInstance().url(file),
                    store.getProviderInstance().url(thumb)
                ]);

                // Assign the retrieved URLs to the entity properties
                entity.fullUrl = fullUrl;
                entity.thumbUrl = thumbUrl;

                // Check if the database type is SQLite or better-sqlite3
                if (['sqlite', 'better-sqlite3'].includes(options.type)) {
                    // Check if 'apps' is a string and parse it as JSON
                    if (typeof apps === 'string') {
                        try {
                            entity.apps = JSON.parse(apps);
                        } catch (error) {
                            // Handle the error by logging and setting a default value
                            entity.apps = []; // Set a default value, adjust based on your requirements
                        }
                    }
                }
            }
        } catch (error) {
            // Handle any unexpected errors during the afterLoad process
            console.error('Error in afterLoad:', error);
        }
    }

    /**
     * Called after entity is removed from the database.
     *
     * @param event
     */
    async afterRemove(event: RemoveEvent<Screenshot>): Promise<any | void> {
        try {
            if (event.entityId) {
                console.log(`BEFORE SCREENSHOT ENTITY WITH ID ${event.entityId} REMOVED`);
                const entity: IScreenshot = event.entity;
                const { storageProvider } = entity;

                const instance = new FileStorage().setProvider(storageProvider).getProviderInstance();
                console.log({ instance });
                if (entity.file) {
                    await instance.deleteFile(entity.file);
                }
                if (entity.thumb) {
                    await instance.deleteFile(entity.thumb);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
}
