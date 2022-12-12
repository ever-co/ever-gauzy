import { EntitySubscriberInterface, EventSubscriber, LoadEvent, RemoveEvent } from "typeorm";
import { IScreenshot } from "@gauzy/contracts";
import { Screenshot } from "./screenshot.entity";
import { FileStorage } from "./../../core/file-storage";

@EventSubscriber()
export class ScreenshotSubscriber implements EntitySubscriberInterface<Screenshot> {

    /**
    * Indicates that this subscriber only listen to Screenshot events.
    */
    listenTo() {
        return Screenshot;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: Screenshot | Partial<Screenshot>, event?: LoadEvent<Screenshot>): void | Promise<any> {
        try {
            if (entity instanceof Screenshot) {
                const { storageProvider } = entity;
                const store = new FileStorage().setProvider(storageProvider);
                entity.fullUrl = store.getProviderInstance().url(entity.file);
                entity.thumbUrl = store.getProviderInstance().url(entity.thumb);
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called after entity is removed from the database.
     *
     * @param event
     */
    async afterRemove(event: RemoveEvent<Screenshot>):  Promise<any | void> {
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