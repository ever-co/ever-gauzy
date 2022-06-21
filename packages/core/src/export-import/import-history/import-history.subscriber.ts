import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: ImportHistory | Partial<ImportHistory>) {
        if (entity instanceof ImportHistory) {
            entity.fullUrl = new FileStorage().getProvider().url(entity.path);
        }
	}
}