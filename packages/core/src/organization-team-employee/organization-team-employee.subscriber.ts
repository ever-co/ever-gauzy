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
     * Called after entity is removed from the database.
     *
     * @param entity
     * @param em
     */
    async afterEntityDelete(entity: OrganizationTeamEmployee): Promise<void> {
        try {
            if (entity.id) {
                console.log(`BEFORE TEAM MEMBER ENTITY WITH ID ${entity.id} REMOVED`);
            }
        } catch (error) {
            console.error('OrganizationTeamEmployeeSubscriber: An error occurred during the afterEntityDelete process:', error);
        }
    }
}
