import { EntitySubscriberInterface, EventSubscriber, RemoveEvent } from "typeorm";
import { OrganizationTeamEmployee } from "./organization-team-employee.entity";

@EventSubscriber()
export class OrganizationTeamEmployeeSubscriber implements EntitySubscriberInterface<OrganizationTeamEmployee> {

    /**
    * Indicates that this subscriber only listen to OrganizationTeamEmployee events.
    */
    listenTo() {
        return OrganizationTeamEmployee;
    }

    /**
     * Called after entity is removed from the database.
     *
     * @param event
     */
    async afterRemove(event: RemoveEvent<OrganizationTeamEmployee>): Promise<any | void> {
        try {
            if (event.entityId) {
                console.log(`BEFORE TEAM MEMBER ENTITY WITH ID ${event.entityId} REMOVED`);
            }
        } catch (error) {
            console.log(error);
        }
    }
}
