import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";
import { getDummyImage } from "./../core/utils";
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
        if (event.entity) {
            const { entity } = event;
            entity.membersCount = (entity.members) ? entity.members.length : 0;
            if (!entity.imageUrl && entity.name) {
                const name = entity.name.toLowerCase().split(' ').slice(0, 2).map((elem) => elem[0]).join('');
                entity.imageUrl = getDummyImage(330, 300, name.toUpperCase());
            }
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