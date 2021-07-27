import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
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
    * Called before organization contact insertion.
    */
    beforeInsert(event: InsertEvent<OrganizationContact>) {
        if (event.entity && !event.entity.imageUrl) {
            event.entity.imageUrl = getDummyImage(330, 300, (event.entity.name).charAt(0).toUpperCase());
        }
    }
}