import { EntitySubscriberInterface, EventSubscriber, RemoveEvent } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: Screenshot | Partial<Screenshot>) {
        if (entity instanceof Screenshot) {
            const { storageProvider } = entity;
            const store = new FileStorage().setProvider(storageProvider);
            entity.fullUrl = store.getProviderInstance().url(entity.file);
            entity.thumbUrl = store.getProviderInstance().url(entity.thumb);
        }
	}

    /**
    * Called before entity removal.
    */
    afterRemove(event: RemoveEvent<Screenshot>) {
        if (event.entityId) {
            console.log(`BEFORE SCREENSHOT ENTITY WITH ID ${event.entityId} REMOVED`);
            (async () => {
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
            })();
        }
    }
}