import { EventSubscriber } from "typeorm"; // deepscan-disable-line
import { FileStorageProviderEnum } from "@gauzy/contracts";
import { Report } from "./report.entity";
import { FileStorage } from "./../core/file-storage";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class ReportSubscriber extends BaseEntityEventSubscriber<Report> {

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
    async afterEntityLoad(entity: Report): Promise<void> {
        try {
            if (entity.image) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.imageUrl = await store.getProviderInstance().url(entity.image);
            }
        } catch (error) {
            console.error('ReportSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
