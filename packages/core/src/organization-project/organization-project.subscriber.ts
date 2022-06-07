import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";
import { OrganizationProject } from "./organization-project.entity";

@EventSubscriber()
export class OrganizationProjectSubscriber implements EntitySubscriberInterface<OrganizationProject> {
    /**
    * Indicates that this subscriber only listen to OrganizationProject events.
    */
    listenTo() {
        return OrganizationProject;
    }

    /**
    * Called before organization project insertion.
    */
    beforeInsert(event: InsertEvent<OrganizationProject>) {
        if (event) {
            const { entity } = event;
            entity.membersCount = (entity.members) ? entity.members.length : 0;
        }
    }

    /**
    * Called before organization project update.
    */
    beforeUpdate(event: UpdateEvent<OrganizationProject>) {
        if (event) {
            const { entity, databaseEntity } = event;
            if (entity && entity.members) {
                entity.membersCount = entity.members.length;
            } else if (databaseEntity && databaseEntity.members) {
                entity.membersCount = databaseEntity.members.length;
            }
        }
    }
}