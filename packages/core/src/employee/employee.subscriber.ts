import {
    EntityManager,
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    LoadEvent,
    RemoveEvent,
    UpdateEvent
} from "typeorm";
import { retrieveNameFromEmail, sluggable } from "@gauzy/common";
import { Employee } from "./employee.entity";
import { getUserDummyImage } from "./../core/utils";
import { Organization } from "./../core/entities/internal";

@EventSubscriber()
export class EmployeeSubscriber implements EntitySubscriberInterface<Employee> {

    /**
    * Indicates that this subscriber only listen to Employee events.
    */
    listenTo() {
        return Employee;
    }

    /**
     * Called after an Employee entity is loaded from the database.
     *
     * @param entity - The loaded Employee entity.
     * @param event - The LoadEvent associated with the entity loading.
     */
    afterLoad(entity: Employee, event?: LoadEvent<Employee>): void | Promise<any> {
        try {
            // Set fullName based on user name if available
            if (entity.user) {
                entity.fullName = entity.user.name;
            }

            // Set isDeleted based on the presence of deletedAt property
            if ('deletedAt' in entity) {
                entity.isDeleted = !!entity.deletedAt;
            }

            // Ensure billRateValue is initialized to 0 if not set
            if ('billRateValue' in entity) {
                entity.billRateValue = entity.billRateValue || 0;
            }
        } catch (error) {
            // Handle or log the error as needed
            console.log("Error in afterLoad:", error.message);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Employee>): void | Promise<any> {
        try {
            if (event.entity) {
                const { entity } = event;
                /**
                 * Use a dummy image avatar if no image is uploaded for any of the employee
                 */
                if (entity.user) {
                    if (!entity.user.imageUrl) {
                        entity.user.imageUrl = getUserDummyImage(entity.user)
                    }
                    this.createSlug(entity);
                }
                /**
                 * If Date when started work filled then enabled time tracking functionality for the employee.
                 */
                if (entity.startedWorkOn) {
                    entity.isTrackingEnabled = true;
                    entity.isActive = true;
                    entity.endWork = entity.endWork ? entity.endWork : null;
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
    beforeUpdate(event: UpdateEvent<Employee>): void | Promise<any> {
        try {
            if (event.entity) {
                const { entity } = event;
                /**
                 * If Date when started work filled then enabled time tracking functionality for the employee.
                 */
                if (entity.startedWorkOn) {
                    entity.isTrackingEnabled = true;
                    entity.isActive = true;
                    entity.endWork = entity.endWork ? entity.endWork : null;
                }
                /**
                * If Date when ended work filled then disable time tracking functionality for the employee.
                */
                if (entity.endWork) {
                    entity.isTrackingEnabled = false;
                    entity.isActive = false;
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called after entity is inserted to the database.
     *
     * @param event
     */
    async afterInsert(event: InsertEvent<Employee>): Promise<any | void> {
        if (event.entity) {
            const { entity } = event;
            await this.calculateTotalEmployees(entity, event.manager);
        }
    }

    /**
     * Called after entity is removed from the database.
     *
     * @param event
     */
    async afterRemove(event: RemoveEvent<Employee>): Promise<any | void> {
        if (event.entity) {
            const { entity } = event;
            await this.calculateTotalEmployees(entity, event.manager);
        }
    }

    /**
     * Generate employee public profile slug
     *
     * @param entity
     */
    createSlug(entity: Employee) {
        try {
            if (!entity || !entity.user) {
                console.error("Entity or User object is not defined.");
                return;
            }

            const { user } = entity;

            if (user.firstName || user.lastName) { // Use first &/or last name to create slug
                entity.profile_link = sluggable(`${user.firstName || ''} ${user.lastName || ''}`.trim());
            } else if (user.username) { // Use username to create slug if first & last name not found
                entity.profile_link = sluggable(user.username);
            } else { // Use email to create slug if nothing found
                entity.profile_link = sluggable(retrieveNameFromEmail(user.email));
            }
        } catch (error) {
            console.error(`Error creating slug for entity with id ${entity.id}: `, error);
        }
    }

    /**
     * Handler request for count total employee
     *
     * @param entity
     * @param manager
     */
    async calculateTotalEmployees(entity: Employee, manager: EntityManager) {
        try {
            const { organizationId, tenantId } = entity;
            const count = await manager.countBy(Employee, {
                organizationId,
                tenantId
            });
            await manager.update(Organization, { id: organizationId, tenantId }, {
                totalEmployees: count
            });
        } catch (error) {
            console.log('error while updating total employee of the organization', error);
        }
    }
}
