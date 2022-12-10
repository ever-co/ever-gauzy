import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from "typeorm";
import { OrganizationContact } from "./organization-contact.entity";
import { getDummyImage } from "./../core/utils";

@EventSubscriber()
export class OrganizationContactSubscriber implements EntitySubscriberInterface<OrganizationContact> {
    /**
    * Indicates that this subscriber only listen to OrganizationContact events.
    */
    listenTo() {
        return OrganizationContact;
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: OrganizationContact, event?: LoadEvent<OrganizationContact>): void | Promise<any> {
        if (!entity.imageUrl && entity.name)  {
            entity.imageUrl = getDummyImage(330, 300, (entity.name).charAt(0).toUpperCase());
        }
    }

    /**
     * Called before organization contact is inserted to the database.
     */
    beforeInsert(event: InsertEvent<OrganizationContact>): void | Promise<any> {
        if (event.entity && !event.entity.imageUrl && event.entity.name) {
            event.entity.imageUrl = getDummyImage(330, 300, (event.entity.name).charAt(0).toUpperCase());
        }
    }

    /**
     * Called before organization contact is updated in the database.
     */
    beforeUpdate(event: UpdateEvent<OrganizationContact>): void | Promise<any> {}
}