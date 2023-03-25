import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from "typeorm";
import { faker } from '@faker-js/faker';
import { sluggable } from "@gauzy/common";
import { Organization } from "./organization.entity";
import { getOrganizationDummyImage } from "./../core/utils";

@EventSubscriber()
export class OrganizationSubscriber implements EntitySubscriberInterface<Organization> {

    /**
    * Indicates that this subscriber only listen to Organization events.
    */
    listenTo() {
        return Organization;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: Organization, event?: LoadEvent<Organization>): void | Promise<any> {
        if (!entity.imageUrl) {
            entity.imageUrl = getOrganizationDummyImage(entity.name || entity.officialName);
        }
        if (!!entity['image']) {
            entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Organization>) {
        try {
            if (event) {
                const { entity } = event;
                if (entity.name || entity.officialName) {
                    entity.profile_link = sluggable(`${entity.name || entity.officialName}`);
                }
                if (!entity.imageUrl) {
                    entity.imageUrl = getOrganizationDummyImage(entity.name || entity.officialName);
                }
                if (!entity.brandColor) {
                    entity.brandColor = faker.internet.color();
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
}
