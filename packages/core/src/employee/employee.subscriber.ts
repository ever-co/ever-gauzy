import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
import { Employee } from "./employee.entity";

@EventSubscriber()
export class EmployeeSubscriber implements EntitySubscriberInterface<Employee> {

    /**
    * Indicates that this subscriber only listen to Screenshot events.
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
}