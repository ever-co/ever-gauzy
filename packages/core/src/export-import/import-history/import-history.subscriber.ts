import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { FileStorage } from "./../../core/file-storage";
import { ImportHistory } from "./import-history.entity";

@EventSubscriber()
export class ImportHistorySubscriber implements EntitySubscriberInterface<ImportHistory> {

    /**
    * Indicates that this subscriber only listen to ImportHistory events.
    */
    listenTo() {
        return ImportHistory;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    async afterLoad(
        entity: ImportHistory,
        event?: LoadEvent<ImportHistory>
    ): Promise<any | void> {
        try {
            if (entity instanceof ImportHistory) {
                const provider = new FileStorage().getProvider();
                entity.fullUrl = await provider.url(entity.path);
            }
        } catch (error) {
            console.error('Error in afterLoad:', error);
        }
    }
}
