import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from './base-entity-event.subscriber';
import { MultiOrmEntityManager } from './entity-event-subscriber.types';
import { TenantOrganizationBaseEntity } from '../tenant-organization-base.entity';
import { TenantBaseEntity } from '../tenant-base.entity';

/**
 *
 */
@EventSubscriber()
export class TenantOrganizationBaseEntityEventSubscriber<Entity = any> extends BaseEntityEventSubscriber<Entity> {
    /**
     * Event subscriber to handle pre-creation logic for entities.
     * @param entity - The entity being created.
     * @param em - Optional entity manager, in case additional queries are needed.
     */
    async beforeEntityCreate(
        entity: Entity,
        em?: MultiOrmEntityManager
    ): Promise<void> {
        try {
            if (entity instanceof TenantBaseEntity) {
                // Set the tenant based on tenantId if not already set
                if (entity['tenantId'] && !entity['tenant']) {
                    // Directly set the tenant based on tenantId
                    entity['tenant'] = { id: entity['tenantId'] };
                }
                // If entity is also TenantOrganizationBaseEntity, set the organization
                if (entity instanceof TenantOrganizationBaseEntity) {
                    // Only proceed if the entity has organizationId and lacks an organization
                    if (entity['organizationId'] && !entity['organization']) {
                        // Directly set the organization based on organizationId
                        entity['organization'] = { id: entity['organizationId'] };
                    }
                }
            }
        } catch (error) {
            console.error('TenantOrganizationBaseEntityEventSubscriber: An error occurred during the beforeEntityCreate process:', error.message);
        }
    }
}
