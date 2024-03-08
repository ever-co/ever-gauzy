import { EventSubscriber } from "typeorm";
import { getTenantLogo } from "../core/utils";
import { Tenant } from "./tenant.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class TenantSubscriber extends BaseEntityEventSubscriber<Tenant> {

    /**
    * Indicates that this subscriber only listen to Organization events.
    */
    listenTo() {
        return Tenant;
    }

    /**
     * Executes after a Tenant entity is loaded. It updates the entity's logo
     * using `updateTenantLogo`. Errors during this process are logged.
     *
     * @param entity The loaded Tenant entity.
     * @returns {Promise<void>}
     */
    async afterEntityLoad(entity: Tenant): Promise<void> {
        try {
            await this.updateTenantLogo(entity);
        } catch (error) {
            console.error('Error in afterEntityLoad:', error);
        }
    }

    /**
     * Invoked before creating a new Tenant entity. It sets or updates the logo
     * through `updateTenantLogo`. Errors are logged for troubleshooting.
     *
     * @param entity The Tenant entity to be created.
     */
    async beforeEntityCreate(entity: Tenant) {
        try {
            await this.updateTenantLogo(entity);
        } catch (error) {
            console.error('Error in beforeEntityCreate:', error);
        }
    }

    /**
     *
     * @param entity
     */
    async beforeEntityUpdate(entity: Tenant): Promise<void> {
        try {
            await this.updateTenantLogo(entity);
        } catch (error) {
            console.error('Error in beforeEntityUpdate:', error);
        }
    }

    /**
     * Updates the logo for a Tenant entity.
     *
     * @param entity - The Tenant entity for which the logo is to be updated.
     * @returns A promise that resolves when the logo update is complete.
     */
    async updateTenantLogo(entity: Tenant): Promise<void> {
        try {
            if (!entity.logo) {
                entity.logo = getTenantLogo(entity.name);
            }
            if (!!entity['image']) {
                entity.logo = entity.image.fullUrl || entity.logo;
            }
        } catch (error) {
            console.error('Error in updating tenant logo:', error);
        }
    }
}
