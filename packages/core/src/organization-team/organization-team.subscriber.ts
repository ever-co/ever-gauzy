import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: OrganizationTeam) {
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
    }
}