import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { OrganizationDocument } from "./organization-document.entity";

@EventSubscriber()
export class OrganizationDocumentSubscriber implements EntitySubscriberInterface<OrganizationDocument> {

    /**
    * Indicates that this subscriber only listen to OrganizationDocument events.
    */
    listenTo() {
        return OrganizationDocument;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: OrganizationDocument, event?: LoadEvent<OrganizationDocument>): void | Promise<any> {
        try {
            if (!!entity['document']) {
                entity.documentUrl = entity.document.fullUrl || entity.documentUrl;
            }
        } catch (error) {
            console.log(error);
        }
    }
}
