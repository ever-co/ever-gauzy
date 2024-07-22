import { EventSubscriber } from "typeorm";
import { OrganizationTeamEmployee } from "./organization-team-employee.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class OrganizationTeamEmployeeSubscriber extends BaseEntityEventSubscriber<OrganizationTeamEmployee> {

    /**
    * Indicates that this subscriber only listen to OrganizationTeamEmployee events.
    */
    listenTo() {
        return OrganizationTeamEmployee;
    }

    /**
     * Called after an OrganizationTeamEmployee entity is removed from the database. This method logs
     * an action indicating that the team member entity has been removed.
     *
     * @param entity The OrganizationTeamEmployee entity that was just deleted.
     * @returns {Promise<void>} A promise that resolves when the post-delete processing is complete.
     */
    async afterEntityDelete(entity: OrganizationTeamEmployee): Promise<void> {
        try {
            if (entity.id) {
                console.log(`AFTER TEAM MEMBER ENTITY WITH ID ${entity.id} REMOVED`);
            }
        } catch (error) {
            console.error('OrganizationTeamEmployeeSubscriber: An error occurred during the afterEntityDelete process:', error);
        }
    }
}
