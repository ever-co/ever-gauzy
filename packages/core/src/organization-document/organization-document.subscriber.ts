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
     * Called after an OrganizationDocument entity is loaded from the database. This method updates
     * the entity's document URL if an associated document with a full URL is present.
     *
     * @param entity The OrganizationDocument entity that has been loaded.
     * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
     */
    async afterEntityLoad(entity: OrganizationDocument): Promise<void> {
        try {
            if (entity.document && entity.document.fullUrl) {
                // Use the full URL from the document property if available
                entity.documentUrl = entity.document.fullUrl;
            }
        } catch (error) {
            console.error('OrganizationDocumentSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
