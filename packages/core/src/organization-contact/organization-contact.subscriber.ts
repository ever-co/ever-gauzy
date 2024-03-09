import { EventSubscriber } from "typeorm";
import { OrganizationContact } from "./organization-contact.entity";
import { getDummyImage } from "./../core/utils";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class OrganizationContactSubscriber extends BaseEntityEventSubscriber<OrganizationContact> {
    /**
    * Indicates that this subscriber only listen to OrganizationContact events.
    */
    listenTo() {
        return OrganizationContact;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     */
    async afterEntityLoad(entity: OrganizationContact): Promise<void> {
        try {
            if (!!entity['image']) {
                entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
            }
            if (!entity.imageUrl && entity.name) {
                entity.imageUrl = getDummyImage(330, 300, (entity.name).charAt(0).toUpperCase());
            }
        } catch (error) {
            console.error('OrganizationContactSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called before entity is inserted/created to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: OrganizationContact): Promise<void> {
        try {
            if (!entity.imageUrl && entity.name) {
                entity.imageUrl = getDummyImage(330, 300, (entity.name).charAt(0).toUpperCase());
            }
        } catch (error) {
            console.error('OrganizationContactSubscriber: An error occurred during the beforeEntityCreate process:', error);
        }
    }
}
