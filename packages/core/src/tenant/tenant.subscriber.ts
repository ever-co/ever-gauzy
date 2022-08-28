import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: Tenant) {
        if (!entity.logo) {
            entity.logo = getTenantLogo(entity.name);
        }
    }

    /**
     * Called before tenant insertion.
     */
    beforeInsert(event: InsertEvent<Tenant>): void | Promise<any> {
        if (event) {
            const { entity } = event;
            if (!entity.logo) {
                entity.logo = getTenantLogo(entity.name);
            }
        }
    }

    /**
     * Called before tenant update.
     */
    beforeUpdate(event: UpdateEvent<Tenant>): void | Promise<any> {
        if (event) {
            const { entity } = event;
            if (!entity.logo) {
                entity.logo = getTenantLogo(entity.name);
            }
        }
    }
}