import { DataSourceOptions, EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, RemoveEvent } from "typeorm";
import { IScreenshot } from "@gauzy/contracts";
import { Screenshot } from "./screenshot.entity";
import { FileStorage } from "./../../core/file-storage";
import { getConfig } from "@gauzy/config";
import { isJsObject } from "@gauzy/common";

@EventSubscriber()
export class ScreenshotSubscriber implements EntitySubscriberInterface<Screenshot> {

    /**
    * Indicates that this subscriber only listen to Screenshot events.
    */
    listenTo() {
        return Screenshot;
    }

    /**
     * Called before activity entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Screenshot>): void | Promise<any> {
        try {
            if (event) {
                const options: Partial<DataSourceOptions> = event.connection.options || getConfig().dbConnectionOptions;
                if (['sqlite', 'better-sqlite3'].includes(options.type)) {
                    const { entity } = event;
                    try {
                        if (isJsObject(entity.apps)) {
                            entity.apps = JSON.stringify(entity.apps);
                        }
                    } catch (error) {
                        console.log('Before Insert Screenshot Activity Error:', error);
                        entity.apps = JSON.stringify({});
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    async afterLoad(
        entity: Screenshot | Partial<Screenshot>,
        event?: LoadEvent<Screenshot>
    ): Promise<any | void> {
        try {
            if (entity instanceof Screenshot) {
                const { storageProvider, file, thumb } = entity;

                const store = new FileStorage().setProvider(storageProvider);

                // Assuming store.getProviderInstance().url is asynchronous
                const [fullUrl, thumbUrl] = await Promise.all([
                    store.getProviderInstance().url(file),
                    store.getProviderInstance().url(thumb)
                ]);

                entity.fullUrl = fullUrl;
                entity.thumbUrl = thumbUrl;
            }
        } catch (error) {
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
