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
    * Called before entity removal.
    */
     afterRemove(event: RemoveEvent<Screenshot>) {
        if (event.entityId) {
            console.log(`BEFORE SCREENSHOT ENTITY WITH ID ${event.entityId} REMOVED`);
            (async () => {
                const screenshot: IScreenshot = event.entity;
                const instance = await new FileStorage().getProvider().getInstance();
                if (screenshot.file) {
                    instance.deleteFile(screenshot.file);
                }
                if (screenshot.thumb) {
                    instance.deleteFile(screenshot.thumb);
                }
            })();
        }
    }
}