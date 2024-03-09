import { EventSubscriber } from "typeorm";
import { OrganizationDocument } from "./organization-document.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class OrganizationDocumentSubscriber extends BaseEntityEventSubscriber<OrganizationDocument> {

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
     */
    async afterEntityLoad(entity: OrganizationDocument): Promise<void> {
        try {
            if (!!entity['document']) {
                entity.documentUrl = entity.document.fullUrl || entity.documentUrl;
            }
        } catch (error) {
            console.error('OrganizationDocumentSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
