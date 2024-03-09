import { EventSubscriber } from "typeorm";
import { faker } from '@faker-js/faker';
import { sluggable } from "@gauzy/common";
import { Organization } from "./organization.entity";
import { getOrganizationDummyImage } from "../core/utils";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class OrganizationSubscriber extends BaseEntityEventSubscriber<Organization> {

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
     */
    async afterEntityLoad(entity: Organization): Promise<void> {
        try {
            if (!entity.imageUrl) {
                entity.imageUrl = getOrganizationDummyImage(entity.name || entity.officialName);
            }
            if (!!entity['image']) {
                entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
            }
        } catch (error) {
            console.error('OrganizationSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called before entity is inserted/created to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: Organization): Promise<void> {
        try {
            if (entity) {
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
            console.error('OrganizationSubscriber: An error occurred during the beforeEntityCreate process:', error);
        }
    }
}
