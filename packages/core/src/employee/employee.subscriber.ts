import {
    EntityManager,
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    RemoveEvent,
    UpdateEvent
} from "typeorm";
import { retrieveNameFromEmail } from "@gauzy/common";
import { Employee } from "./employee.entity";
import { generateSlug, getUserDummyImage } from "./../core/utils";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: Employee) {
        if (entity.user) {
            entity.fullName = entity.user.name;
        }
        entity.isDeleted = !!entity.deletedAt;
    }

    /**
     * Called before employee insertion.
     */
    beforeInsert(event: InsertEvent<Employee>) {
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
            }
        }
    }

    /**
     * Called before employee update.
     */
    beforeUpdate(event: UpdateEvent<Employee>): void | Promise<any> {
        if (event.entity) {
            const { entity } = event;
            /**
             * If Date when started work filled then enabled time tracking functionality for the employee.
             */
            if (entity.startedWorkOn) {
                entity.isTrackingEnabled = true;
                entity.isActive = true;
            }
            /**
            * If Date when ended work filled then disable time tracking functionality for the employee.
            */
            if (entity.endWork) {
                entity.isTrackingEnabled = false;
                entity.isActive = false;
            }
        }
    }

    async afterInsert(event: InsertEvent<Employee>): Promise<any | void>  {
        if (event.entity) {
            const { entity } = event;
            await this.calculateTotalEmployees(entity, event.manager);
        }
    }

    async afterRemove(event: RemoveEvent<Employee>): Promise<any | void> {
        if (event.entity) {
            const { entity } = event;
            await this.calculateTotalEmployees(entity, event.manager);
        }
    }

    /**
     * Generate employee public profile slug
     */
    createSlug(entity: Employee) {
        if (entity.user.firstName || entity.user.lastName) { // Use first & last name to create slug
            const { firstName, lastName } = entity.user;
            entity.profile_link = generateSlug(`${firstName} ${lastName}`);
        } else if (entity.user.username) { // Use username to create slug if first & last name not found
            const { username } = entity.user;
            entity.profile_link = generateSlug(`${username}`);
        } else { // Use email to create slug if nothing found
            const { email } = entity.user;
            entity.profile_link = generateSlug(`${retrieveNameFromEmail(email)}`);
        }
    }

    /**
     * Handler request for count total employee
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