import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import { Employee } from "./employee.entity";
import { getUserDummyImage } from "./../core/utils";

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
            if (!entity.user.imageUrl) {
                entity.user.imageUrl = getUserDummyImage(entity.user)
            }
        }
    }
}