import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: Report) {
        if (entity.image) {
            const store = new FileStorage()
            store.setProvider(FileStorageProviderEnum.LOCAL);
			entity.imageUrl = store.getProviderInstance().url(entity.image);
		}
    }
}