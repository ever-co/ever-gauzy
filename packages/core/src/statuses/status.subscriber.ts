import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { Status } from "./status.entity";

@EventSubscriber()
export class StatusSubscriber implements EntitySubscriberInterface<Status> {

    /**
    * Indicates that this subscriber only listen to Status events.
    */
    listenTo() {
        return Status;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: Status | Partial<Status>, event?: LoadEvent<Status>): void | Promise<any> {}
}