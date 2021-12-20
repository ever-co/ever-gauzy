import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import { getUserDummyImage } from "./../core/utils";
import { User } from "./user.entity";

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {

    /**
    * Indicates that this subscriber only listen to User events.
    */
    listenTo() {
        return User;
    }

    /**
     * Called before user insertion.
     */
    beforeInsert(event: InsertEvent<User>) {
        const entity = event.entity;
        if (!entity.imageUrl) {
            entity.imageUrl = getUserDummyImage(entity);
        }
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: User) {
        entity.name = `${entity.firstName} ${entity.lastName}`;
        entity.employeeId = entity.employee ? entity.employee.id : null;
    }
}