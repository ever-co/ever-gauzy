import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { FileStorageProviderEnum } from "@gauzy/contracts";
import { Report } from "./report.entity";
import { FileStorage } from "./../core/file-storage";

@EventSubscriber()
export class ReportSubscriber implements EntitySubscriberInterface<Report> {

    /**
    * Indicates that this subscriber only listen to Report events.
    */
    listenTo() {
        return Report;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     */
    async afterLoad(
        entity: Report,
        event?: LoadEvent<Report>
    ): Promise<any | void> {
        try {
            if (entity.image) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.imageUrl = await store.getProviderInstance().url(entity.image);
            }
        } catch (error) {
            console.error('Error in afterLoad:', error);
        }
    }
}
