import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import * as faker from 'faker';
import { Organization } from "./organization.entity";
import { generateSlug, getOrganizationDummyImage } from "core/utils";

@EventSubscriber()
export class OrganizationSubscriber implements EntitySubscriberInterface<Organization> {

    /**
    * Indicates that this subscriber only listen to Organization events.
    */
    listenTo() {
        return Organization;
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: Organization) {
        if (!entity.brandColor) {
            entity.brandColor = faker.internet.color();
        }
    }

    /**
     * Called before employee insertion.
     */
     beforeInsert(event: InsertEvent<Organization>) {
        if (event) {
            const { entity } = event;
            if(entity.name || entity.officialName) {
                entity.profile_link = generateSlug(`${entity.name || entity.officialName}`);
            }
 
            if (!entity.imageUrl) {
                entity.imageUrl = getOrganizationDummyImage(entity.name || entity.officialName);
            }
        }
    }
}