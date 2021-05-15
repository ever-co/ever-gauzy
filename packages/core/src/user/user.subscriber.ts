import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: User) {
        entity.name = `${entity.firstName} ${entity.lastName}`;
        entity.employeeId = entity.employee ? entity.employee.id : null;
    }
}