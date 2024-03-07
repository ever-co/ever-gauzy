import { EventArgs } from "@mikro-orm/core";
import { EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";
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
     *
     * @param entity
     */
    async afterEntityLoad(entity: Tenant): Promise<void> {
        try {
            await this.processLogo(entity);
        } catch (error) {
            console.error('Error in afterEntityLoad:', error);
        }
    }

    /**
     * Processes the logo for a Tenant entity.
     *
     * @param entity - The Tenant entity to process the logo for.
     * @returns A promise that resolves when the logo processing is complete.
     */
    async processLogo(entity: Tenant): Promise<void> {
        try {
            if (!entity.logo) {
                entity.logo = getTenantLogo(entity.name);
            }
            if (!!entity['image']) {
                entity.logo = entity.image.fullUrl || entity.logo;
            }
        } catch (error) {
            console.error('Error in processing tenant logo:', error);
        }
    }

    /**
     * Handles actions before creating a new entity.
     *
     * @param args - The event arguments.
     * @returns A promise that resolves when the actions are complete.
     */
    async beforeCreate(args: EventArgs<Tenant>): Promise<void> {
        console.log(args);
        await this.processLogo(args.entity);
    }

    /**
     * Called before a Tenant entity is inserted into the database.
     *
     * @param event - The InsertEvent containing information about the entity to be inserted.
     * @returns A void or a promise that resolves when the actions are complete.
     */
    async beforeInsert(event: InsertEvent<Tenant>): Promise<void> {
        try {
            if (event) {
                const { entity } = event;
                await this.processLogo(entity);
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
