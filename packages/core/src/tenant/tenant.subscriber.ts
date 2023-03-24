import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from "typeorm";
import { Tenant } from "./tenant.entity";
import { getTenantLogo } from "./../core/utils";

@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface<Tenant> {

    /**
    * Indicates that this subscriber only listen to Organization events.
    */
    listenTo() {
        return Tenant;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: Tenant, event?: LoadEvent<Tenant>): void | Promise<any> {
        try {
            if (!entity.logo) {
                entity.logo = getTenantLogo(entity.name);
            }
            if (!!entity['image']) {
                entity.logo = entity.image.fullUrl || entity.logo;
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Tenant>): void | Promise<any> {
        try {
            if (event) {
                const { entity } = event;
                if (!entity.logo) {
                    entity.logo = getTenantLogo(entity.name);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called before entity is updated in the database.
     *
     * @param event
     */
    beforeUpdate(event: UpdateEvent<Tenant>): void | Promise<any> {
        try {
            if (event) {
                const { entity } = event;
                if (!entity.logo) {
                    entity.logo = getTenantLogo(entity.name);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
}
