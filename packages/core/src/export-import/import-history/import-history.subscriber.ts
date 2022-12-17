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
    afterLoad(entity: ImportHistory, event?: LoadEvent<ImportHistory>): void | Promise<any> {
        try {
            if (entity instanceof ImportHistory) {
                entity.fullUrl = new FileStorage().getProvider().url(entity.path);
            }
        } catch (error) {
            console.log(error);
        }
    }
}