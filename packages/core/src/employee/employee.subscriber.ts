import { EventSubscriber } from "typeorm";
import { retrieveNameFromEmail, sluggable } from "@gauzy/common";
import { Employee } from "./employee.entity";
import { getUserDummyImage } from "../core/utils";
import { Organization } from "../core/entities/internal";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import {
    MikroOrmEntityManager,
    MultiOrmEntityManager,
    TypeOrmEntityManager
} from "../core/entities/subscribers/entity-event-subscriber.types";

@EventSubscriber()
export class EmployeeSubscriber extends BaseEntityEventSubscriber<Employee> {

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
    async afterEntityLoad(entity: Employee): Promise<void> {
        try {
            // Set fullName from the associated user's name, if available
            if (entity.user) {
                entity.fullName = entity.user.name;
            }

            // Set isDeleted to true if the deletedAt property is present and not null
            if ('deletedAt' in entity) {
                entity.isDeleted = !!entity.deletedAt;
            }

            // Default billRateValue to 0 if it's not set
            if ('billRateValue' in entity) {
                entity.billRateValue = entity.billRateValue || 0;
            }
        } catch (error) {
            // Handle or log the error as needed
            console.error('EmployeeSubscriber: An error occurred during the afterEntityLoad process:', error.message);
        }
    }

    /**
     * Called before entity is inserted/created to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: Employee): Promise<void> {
        try {
            if (entity.user) {
                await this.createSlug(entity);
            }
            // Set a default avatar image if none is provided
            if (!entity.user.imageUrl) {
                entity.user.imageUrl = getUserDummyImage(entity.user);
            }
            // Enable time tracking and set the employee as active if the start work date is provided
            if (entity.startedWorkOn) {
                entity.isTrackingEnabled = true;
                entity.isActive = true;
            }
        } catch (error) {
            console.error('EmployeeSubscriber: An error occurred during the beforeEntityCreate process:', error.message);
        }
    }

    /**
     * Called before entity is updated in the database.
     *
     * @param entity
     */
    async beforeEntityUpdate(entity: Employee): Promise<void> {
        try {
            // Enable time tracking and activate the employee if the start work date is set.
            if (entity.startedWorkOn) {
                entity.isTrackingEnabled = true;
                entity.isActive = true;
            }

            // Disable time tracking and deactivate the employee if the end work date is set.
            if (entity.endWork) {
                entity.isTrackingEnabled = false;
                entity.isActive = false;
            }
        } catch (error) {
            console.error('EmployeeSubscriber: An error occurred during the beforeEntityUpdate process:', error.message);
        }
    }

    /**
     * Called after entity is inserted/created to the database.
     *
     * @param entity
     * @param em
     */
    async afterEntityCreate(entity: Employee, em?: MultiOrmEntityManager): Promise<void> {
        try {
            if (entity) {
                await this.calculateTotalEmployees(entity, em);
            }
        } catch (error) {
            console.error('EmployeeSubscriber: An error occurred during the afterEntityCreate process:', error.message);
        }
    }


    /**
     * Called after entity is removed from the database.
     *
     * @param entity
     * @param em
     */
    async afterEntityDelete(entity: Employee, em?: MultiOrmEntityManager): Promise<void> {
        try {
            if (entity) {
                await this.calculateTotalEmployees(entity, em);
            }
        } catch (error) {
            console.error('EmployeeSubscriber: An error occurred during the afterEntityDelete process:', error);
        }
    }

    /**
     * Creates a slug for an Employee entity based on the associated User's information.
     * The slug is generated using the first and last name, username, or email, in that order of preference.
     *
     * @param {Employee} entity - The Employee entity for which to create the slug.
     * @throws {Error} If neither entity nor entity.user is defined, or if slug creation fails.
     */
    async createSlug(entity: Employee) {
        try {
            if (!entity || !entity.user) {
                console.error("Entity or User object is not defined.");
                return;
            }

            const { firstName, lastName, username, email } = entity.user;

            if (firstName || lastName) {
                // Use first &/or last name to create slug
                entity.profile_link = sluggable(`${firstName || ''} ${lastName || ''}`.trim());
            } else if (username) {
                // Use username to create slug if first & last name not found
                entity.profile_link = sluggable(username);
            } else {
                // Use email to create slug if nothing found
                entity.profile_link = sluggable(retrieveNameFromEmail(email));
            }
        } catch (error) {
            console.error(`EmployeeSubscriber: Error creating slug for entity with id ${entity.id}: `, error);
        }
    }

    /**
     * Calculates and updates the total number of employees for an organization.
     * Handles both TypeORM and MikroORM environments.
     *
     * @param entity The employee entity with organizationId and tenantId.
     * @param em The entity manager, either TypeORM's or MikroORM's.
     */
    async calculateTotalEmployees(entity: Employee, em: MultiOrmEntityManager): Promise<void> {
        try {
            const { organizationId, tenantId } = entity;

            // Handle TypeORM specific logic
            if (em instanceof TypeOrmEntityManager) {
                const totalEmployees = await em.countBy(Employee, { organizationId, tenantId });
                await em.update(Organization, { id: organizationId, tenantId }, { totalEmployees });
            }
            // Handle MikroORM specific logic
            else if (em instanceof MikroOrmEntityManager) {
                const totalEmployees = await em.count(Employee, { organizationId, tenantId });
                await em.nativeUpdate(Organization, { id: organizationId, tenantId }, { totalEmployees });
            }
        } catch (error) {
            console.error('EmployeeSubscriber: Error while updating total employee count of the organization:', error);
        }
    }
}
