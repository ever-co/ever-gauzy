import { EventSubscriber } from "typeorm";
import { FileStorage } from "./../../core/file-storage";
import { BaseEntityEventSubscriber } from "../../core/entities/subscribers/base-entity-event.subscriber";
import { ImportHistory } from "./import-history.entity";

@EventSubscriber()
export class ImportHistorySubscriber extends BaseEntityEventSubscriber<ImportHistory> {

    /**
    * Indicates that this subscriber only listen to ImportHistory events.
    */
    listenTo() {
        return ImportHistory;
    }

    /**
     * Called after an ImportHistory entity is loaded from the database. This method updates
     * the entity by setting the full URL using the FileStorage provider based on the entity's path.
     *
     * @param entity The ImportHistory entity that has been loaded.
     * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
     */
    async afterEntityLoad(entity: ImportHistory): Promise<void> {
        try {
            if (entity instanceof ImportHistory) {
                const provider = new FileStorage().getProvider();
                // Ensure that the entity has a valid path before attempting to generate the URL
                if (entity.path) {
                    entity.fullUrl = await provider.url(entity.path);
                }
            }
        } catch (error) {
            console.error('ImportHistorySubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
