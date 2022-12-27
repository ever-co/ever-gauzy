import { RequestContext } from "core/context";
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from "typeorm";
import { OrganizationTeam } from "./organization-team.entity";

@EventSubscriber()
export class OrganizationTeamSubscriber implements EntitySubscriberInterface<OrganizationTeam> {

    /**
    * Indicates that this subscriber only listen to OrganizationTeam events.
    */
    listenTo() {
        return OrganizationTeam;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: OrganizationTeam, event?: LoadEvent<OrganizationTeam>): void | Promise<any> {
        try {
            if (entity) {
                if (entity.prefix) {
                    entity.prefix = entity.prefix.toUpperCase();
                } else if (!entity.prefix) {
                    const prefix = entity.name;
                    if(prefix) {
                        entity.prefix =  prefix.substring(0, 3).toUpperCase();
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<OrganizationTeam>): void | Promise<any> {
        try {
            const entity = event.entity;
            if (entity) { entity.createdById = RequestContext.currentUserId(); }
        } catch (error) {
            console.log(error);
        }
    }
}